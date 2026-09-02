import { NextResponse } from 'next/server';

import { getServerEnv, getTenantApiConfig } from '@/env.server';

export const dynamic = 'force-dynamic';

const unsafeSessionSecrets = new Set(['replace-me', 'replace-with-at-least-32-random-characters']);

function readinessResponse(
  status: 'ready' | 'not-ready',
  upstream: 'ready' | 'unavailable' | 'not-checked',
  configuration: 'valid' | 'invalid',
) {
  return NextResponse.json(
    {
      status,
      service: 'lume-tenant-web',
      configuration,
      dependencies: {
        tenantApi: upstream,
      },
    },
    {
      status: status === 'ready' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

function assertRuntimeConfiguration() {
  const environment = getServerEnv();
  const sessionSecret = environment.SESSION_SECRET;
  if (!sessionSecret) throw new Error('SESSION_SECRET is required.');
  if (unsafeSessionSecrets.has(sessionSecret)) {
    throw new Error('SESSION_SECRET must not use a documented placeholder.');
  }
}

export async function GET() {
  let tenantApi: ReturnType<typeof getTenantApiConfig>;

  try {
    assertRuntimeConfiguration();
    tenantApi = getTenantApiConfig();
  } catch {
    return readinessResponse('not-ready', 'not-checked', 'invalid');
  }

  try {
    const response = await fetch(`${tenantApi.baseUrl}/health/ready`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(tenantApi.timeoutMs),
    });

    return response.ok
      ? readinessResponse('ready', 'ready', 'valid')
      : readinessResponse('not-ready', 'unavailable', 'valid');
  } catch {
    return readinessResponse('not-ready', 'unavailable', 'valid');
  }
}
