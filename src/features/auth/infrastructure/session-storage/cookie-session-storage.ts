import { getServerEnv } from '@/env.server';

import type { SessionStorage } from '../../application';
import type { AuthenticatedSession } from '../../domain';
import {
  assertSessionSecret,
  decryptAuthenticatedSession,
  encryptAuthenticatedSession,
} from './session-cookie-crypto';

export const SESSION_COOKIE_NAME = 'milenium_session';
export const SESSION_COOKIE_CHUNK_SIZE = 3_500;
export const MAX_SESSION_COOKIE_CHUNKS = 4;

export function getSessionCookieChunkName(cookieName: string, index: number): string {
  return index === 0 ? cookieName : `${cookieName}.${index}`;
}

export const SESSION_COOKIE_NAMES = Array.from({ length: MAX_SESSION_COOKIE_CHUNKS }, (_, index) =>
  getSessionCookieChunkName(SESSION_COOKIE_NAME, index),
);

export interface SessionCookieOptions {
  readonly expires: Date;
  readonly httpOnly: true;
  readonly path: string;
  readonly priority: 'high';
  readonly sameSite: 'lax';
  readonly secure: boolean;
}

export interface SessionCookieStore {
  get(name: string): { readonly value: string } | undefined;
  set(name: string, value: string, options: SessionCookieOptions): void;
  delete(name: string): void;
}

export interface CookieSessionStorageOptions {
  readonly cookieName?: string;
  readonly secure?: boolean;
}

export class CookieSessionStorage implements SessionStorage {
  private readonly cookieName: string;
  private readonly secure: boolean;

  constructor(
    private readonly cookieStore: SessionCookieStore,
    private readonly sessionSecret: string,
    options: CookieSessionStorageOptions = {},
  ) {
    assertSessionSecret(sessionSecret);

    this.cookieName = options.cookieName ?? SESSION_COOKIE_NAME;
    this.secure = options.secure ?? getServerEnv().NODE_ENV === 'production';
  }

  async save(session: AuthenticatedSession): Promise<void> {
    const expires = new Date(session.expiresAt);

    if (Number.isNaN(expires.getTime())) {
      throw new Error('Cannot save an authenticated session with an invalid expiration date.');
    }

    const encryptedSession = await encryptAuthenticatedSession(session, this.sessionSecret);
    const chunks = encryptedSession.match(new RegExp(`.{1,${SESSION_COOKIE_CHUNK_SIZE}}`, 'g')) ?? [
      '',
    ];

    if (chunks.length > MAX_SESSION_COOKIE_CHUNKS) {
      throw new Error('Authenticated session exceeds the supported cookie capacity.');
    }

    const cookieOptions: SessionCookieOptions = {
      expires,
      httpOnly: true,
      path: '/',
      priority: 'high',
      sameSite: 'lax',
      secure: this.secure,
    };

    chunks.forEach((chunk, index) => {
      this.cookieStore.set(getSessionCookieChunkName(this.cookieName, index), chunk, cookieOptions);
    });

    for (let index = chunks.length; index < MAX_SESSION_COOKIE_CHUNKS; index += 1) {
      this.cookieStore.delete(getSessionCookieChunkName(this.cookieName, index));
    }
  }

  async get(): Promise<AuthenticatedSession | null> {
    const firstChunk = this.cookieStore.get(this.cookieName)?.value;

    if (firstChunk === undefined) {
      return null;
    }

    let encryptedSession = firstChunk;

    for (let index = 1; index < MAX_SESSION_COOKIE_CHUNKS; index += 1) {
      const chunk = this.cookieStore.get(getSessionCookieChunkName(this.cookieName, index))?.value;

      if (chunk === undefined) break;
      encryptedSession += chunk;
    }

    return decryptAuthenticatedSession(encryptedSession, this.sessionSecret);
  }

  remove(): Promise<void> {
    for (let index = 0; index < MAX_SESSION_COOKIE_CHUNKS; index += 1) {
      this.cookieStore.delete(getSessionCookieChunkName(this.cookieName, index));
    }

    return Promise.resolve();
  }
}
