/** @jest-environment node */

import { NextRequest } from 'next/server';

import type { ApiAuthenticationTokens } from '@/features/auth/application';
import {
  API_TOKEN_COOKIE_NAME,
  encryptApiAuthenticationTokens,
} from '@/features/auth/infrastructure/api-token-storage';

import { config, proxy } from './proxy';

const SESSION_SECRET = 'test-session-secret-with-at-least-32-bytes';

function tokens(accessTokenExpiresAt: string): ApiAuthenticationTokens {
  return {
    accessToken: 'access-token',
    refreshToken: 'r'.repeat(40),
    accessTokenExpiresAt,
    refreshTokenExpiresAt: '2027-07-25T00:00:00.000Z',
  };
}

async function authenticatedRequest(
  accessTokenExpiresAt: string,
  method = 'GET',
): Promise<NextRequest> {
  const encryptedTokens = await encryptApiAuthenticationTokens(
    tokens(accessTokenExpiresAt),
    SESSION_SECRET,
  );

  return new NextRequest('http://localhost:3000/users?page=2', {
    method,
    headers: {
      Cookie: `${API_TOKEN_COOKIE_NAME}=${encryptedTokens}`,
    },
  });
}

describe('tenant session proxy', () => {
  const originalSessionSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = SESSION_SECRET;
  });

  afterAll(() => {
    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }
  });

  it('continues a request whose access token is still valid', async () => {
    const request = await authenticatedRequest(new Date(Date.now() + 60_000).toISOString());

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('protects every authenticated workspace with the session proxy', () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining([
        '/quote-proposals/:path*',
        '/routing/:path*',
        '/registrations/:path*',
        '/registration-reconciliation/:path*',
        '/contacts/:path*',
        '/clients/:path*',
        '/administration/:path*',
      ]),
    );
  });

  it('redirects an expiring access token to the refresh Route Handler', async () => {
    const request = await authenticatedRequest(new Date(Date.now() + 10_000).toISOString());

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/refresh-session?returnTo=%2Fusers%3Fpage%3D2',
    );
  });

  it('does not intercept a Server Action POST', async () => {
    const request = await authenticatedRequest(new Date(Date.now() - 10_000).toISOString(), 'POST');

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('routes an unreadable token cookie through local session cleanup', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        Cookie: `${API_TOKEN_COOKIE_NAME}=invalid-token`,
      },
    });

    const response = await proxy(request);

    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/session-expired');
  });
});
