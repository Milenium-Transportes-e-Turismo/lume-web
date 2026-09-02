import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getServerEnv, getSessionSecret } from '@/env.server';
import { shouldRefreshApiToken } from '@/features/auth/application';
import {
  API_TOKEN_COOKIE_NAME,
  decryptApiAuthenticationTokens,
} from '@/features/auth/infrastructure/api-token-storage';

const SESSION_REFRESH_PATH = '/auth/refresh-session';
const SESSION_EXPIRED_PATH = '/auth/session-expired';

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.method !== 'GET') {
    return NextResponse.next();
  }

  if (getServerEnv().AUTH_SIMULATION_ENABLED) {
    return NextResponse.next();
  }

  const encryptedTokens = request.cookies.get(API_TOKEN_COOKIE_NAME)?.value;

  if (encryptedTokens === undefined || encryptedTokens.trim().length === 0) {
    return NextResponse.next();
  }

  let sessionSecret: string;
  try {
    sessionSecret = getSessionSecret();
  } catch {
    return redirectTo(request, SESSION_EXPIRED_PATH);
  }

  const tokens = await decryptApiAuthenticationTokens(encryptedTokens, sessionSecret);

  if (tokens === null) {
    return redirectTo(request, SESSION_EXPIRED_PATH);
  }

  if (!shouldRefreshApiToken(tokens)) {
    return NextResponse.next();
  }

  const refreshUrl = new URL(SESSION_REFRESH_PATH, request.url);
  refreshUrl.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(refreshUrl);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/users/:path*',
    '/license/:path*',
    '/ai-agents/:path*',
    '/whatsapp-channels/:path*',
    '/whatsapp-conversations/:path*',
    '/knowledge/:path*',
    '/registration-data-reviews/:path*',
    '/quote-proposals/:path*',
    '/profile/:path*',
    '/support/:path*',
    '/documents/:path*',
    '/document-management/:path*',
  ],
};
