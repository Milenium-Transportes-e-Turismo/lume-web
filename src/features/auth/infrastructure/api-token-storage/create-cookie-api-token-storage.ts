import 'server-only';

import { cookies } from 'next/headers';

import { getSessionSecret } from '@/env.server';

import type { ApiTokenStorage } from '../../application';
import { CookieApiTokenStorage } from './cookie-api-token-storage';

export async function createCookieApiTokenStorage(): Promise<ApiTokenStorage> {
  const cookieStore = await cookies();

  return new CookieApiTokenStorage(
    cookieStore,
    getSessionSecret('SESSION_SECRET is required to create the API token storage.'),
  );
}
