import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionSecret } from '@/env.server';
import { createTenantApiAuthenticationGateway } from '@/features/auth/infrastructure/tenant-api';
import {
  API_TOKEN_COOKIE_NAME,
  CookieApiTokenStorage,
} from '@/features/auth/infrastructure/api-token-storage';
import {
  CookieSessionStorage,
  SESSION_COOKIE_NAMES,
  type SessionCookieStore,
} from '@/features/auth/infrastructure/session-storage';
import { resolveSessionRefreshReturnTo } from '@/features/auth/lib/session-refresh-return-to';

function redirectResponse(_request: NextRequest, path: string): NextResponse {
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: path },
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function responseCookieStore(request: NextRequest, response: NextResponse): SessionCookieStore {
  return {
    get(name) {
      return request.cookies.get(name);
    },
    set(name, value, options) {
      response.cookies.set(name, value, options);
    },
    delete(name) {
      response.cookies.delete(name);
    },
  };
}

function clearAuthenticationCookies(response: NextResponse): void {
  SESSION_COOKIE_NAMES.forEach((cookieName) => response.cookies.delete(cookieName));
  response.cookies.delete(API_TOKEN_COOKIE_NAME);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = resolveSessionRefreshReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const successResponse = redirectResponse(request, returnTo);

  try {
    const sessionSecret = getSessionSecret();

    const cookieStore = responseCookieStore(request, successResponse);
    const sessionStorage = new CookieSessionStorage(cookieStore, sessionSecret);
    const tokenStorage = new CookieApiTokenStorage(cookieStore, sessionSecret);
    const currentTokens = await tokenStorage.get();

    if (currentTokens === null) {
      throw new Error('Tenant API tokens are unavailable.');
    }

    const authentication = await createTenantApiAuthenticationGateway().refresh(
      currentTokens.refreshToken,
    );

    await Promise.all([
      sessionStorage.save(authentication.session),
      tokenStorage.save(authentication.tokens),
    ]);

    return successResponse;
  } catch {
    const failureResponse = redirectResponse(request, '/login');
    clearAuthenticationCookies(failureResponse);
    return failureResponse;
  }
}
