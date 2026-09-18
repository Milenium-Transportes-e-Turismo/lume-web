import 'server-only';

import { cookies } from 'next/headers';

import { getServerEnv, getSessionSecret } from '@/env.server';

import type { SessionStorage } from '../../application';
import { createLocalDemoSession } from '../../simulation/create-local-demo-session';
import { CookieSessionStorage } from './cookie-session-storage';

export async function createCookieSessionStorage(): Promise<SessionStorage> {
  if (getServerEnv().AUTH_LOCAL_AUTO_LOGIN) {
    return {
      get: async () => createLocalDemoSession(),
      save: async () => {},
      remove: async () => {},
    };
  }

  const cookieStore = await cookies();

  return new CookieSessionStorage(
    cookieStore,
    getSessionSecret('SESSION_SECRET is required to create the session storage.'),
  );
}
