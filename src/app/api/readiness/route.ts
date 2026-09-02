import { NextResponse } from 'next/server';

import { getTenantApiConfig } from '@/env.server';

export const dynamic = 'force-dynamic';

function readinessResponse(status: 'ready' | 'not-ready', upstream: 'ready' | 'unavailable') {
  return NextResponse.json(
    {
      status,
      service: 'lume-tenant-web',
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

export async function GET() {
  let tenantApi: ReturnType<typeof getTenantApiConfig>;

  try {
    tenantApi = getTenantApiConfig();
  } catch {
    return readinessResponse('not-ready', 'unavailable');
  }

  try {
    const response = await fetch(`${tenantApi.baseUrl}/health/ready`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(tenantApi.timeoutMs),
    });

    return response.ok
      ? readinessResponse('ready', 'ready')
      : readinessResponse('not-ready', 'unavailable');
  } catch {
    return readinessResponse('not-ready', 'unavailable');
  }
}
