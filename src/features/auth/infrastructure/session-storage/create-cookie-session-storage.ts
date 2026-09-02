import 'server-only';

import { cookies } from 'next/headers';

import { getSessionSecret } from '@/env.server';

import type { SessionStorage } from '../../application';
import { CookieSessionStorage } from './cookie-session-storage';

export async function createCookieSessionStorage(): Promise<SessionStorage> {
  const cookieStore = await cookies();

  return new CookieSessionStorage(
    cookieStore,
    getSessionSecret('SESSION_SECRET is required to create the session storage.'),
  );
}
