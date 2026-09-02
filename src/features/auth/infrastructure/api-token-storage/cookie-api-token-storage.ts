import { getServerEnv } from '@/env.server';

import type { ApiAuthenticationTokens, ApiTokenStorage } from '../../application';
import type { SessionCookieStore } from '../session-storage/cookie-session-storage';
import { assertSessionSecret } from '../session-storage/session-cookie-crypto';
import {
  decryptApiAuthenticationTokens,
  encryptApiAuthenticationTokens,
} from './api-token-cookie-crypto';

export const API_TOKEN_COOKIE_NAME = 'lume_tenant_api_tokens';

export interface CookieApiTokenStorageOptions {
  readonly cookieName?: string;
  readonly path?: string;
  readonly secure?: boolean;
}

export class CookieApiTokenStorage implements ApiTokenStorage {
  private readonly cookieName: string;
  private readonly path: string;
  private readonly secure: boolean;

  constructor(
    private readonly cookieStore: SessionCookieStore,
    private readonly sessionSecret: string,
    options: CookieApiTokenStorageOptions = {},
  ) {
    assertSessionSecret(sessionSecret);

    this.cookieName = options.cookieName ?? API_TOKEN_COOKIE_NAME;
    this.path = options.path ?? '/';
    this.secure = options.secure ?? getServerEnv().NODE_ENV === 'production';
  }

  async save(tokens: ApiAuthenticationTokens): Promise<void> {
    const expires = new Date(tokens.refreshTokenExpiresAt);

    if (Number.isNaN(expires.getTime())) {
      throw new Error('Cannot save API tokens with an invalid expiration date.');
    }

    const encryptedTokens = await encryptApiAuthenticationTokens(tokens, this.sessionSecret);

    this.cookieStore.set(this.cookieName, encryptedTokens, {
      expires,
      httpOnly: true,
      path: this.path,
      priority: 'high',
      sameSite: 'lax',
      secure: this.secure,
    });
  }

  async get(): Promise<ApiAuthenticationTokens | null> {
    const encryptedTokens = this.cookieStore.get(this.cookieName)?.value;

    if (encryptedTokens === undefined) {
      return null;
    }

    return decryptApiAuthenticationTokens(encryptedTokens, this.sessionSecret);
  }

  remove(): Promise<void> {
    this.cookieStore.delete(this.cookieName);

    return Promise.resolve();
  }
}
