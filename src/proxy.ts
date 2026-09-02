import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

  const encryptedTokens = request.cookies.get(API_TOKEN_COOKIE_NAME)?.value;

  if (encryptedTokens === undefined) {
    return NextResponse.next();
  }

  const sessionSecret = process.env.SESSION_SECRET;

  if (sessionSecret === undefined) {
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
    '/whatsapp-conversations/:path*',
    '/quote-proposals/:path*',
    '/routing/:path*',
    '/registrations/:path*',
    '/registration-reconciliation/:path*',
    '/contacts/:path*',
    '/clients/:path*',
    '/administration/:path*',
    '/profile/:path*',
    '/support/:path*',
    '/documents/:path*',
    '/document-management/:path*',
  ],
};
