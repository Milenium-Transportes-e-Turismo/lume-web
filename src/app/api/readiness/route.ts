import { NextResponse } from 'next/server';

import { resolveTenantApiBaseUrl, resolveTenantApiTimeout } from '@/features/auth/infrastructure';
import { assertSessionSecret } from '@/features/auth/infrastructure/session-storage/session-cookie-crypto';

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
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error('SESSION_SECRET is required.');
  if (unsafeSessionSecrets.has(sessionSecret)) {
    throw new Error('SESSION_SECRET must not use a documented placeholder.');
  }
  assertSessionSecret(sessionSecret);

  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.AUTH_SIMULATION_ENABLED !== 'false') {
    throw new Error('AUTH_SIMULATION_ENABLED must be false in production.');
  }
  if (process.env.LUME_TENANT_WHATSAPP_DATA_SOURCE !== 'api') {
    throw new Error('LUME_TENANT_WHATSAPP_DATA_SOURCE must be api in production.');
  }
}

export async function GET() {
  let tenantApiUrl: string;
  let timeoutMs: number;

  try {
    assertRuntimeConfiguration();
    tenantApiUrl = resolveTenantApiBaseUrl(process.env.LUME_TENANT_API_URL);
    timeoutMs = resolveTenantApiTimeout(process.env.LUME_TENANT_API_TIMEOUT_MS);
  } catch {
    return readinessResponse('not-ready', 'not-checked', 'invalid');
  }

  try {
    const response = await fetch(`${tenantApiUrl}/health/ready`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok
      ? readinessResponse('ready', 'ready', 'valid')
      : readinessResponse('not-ready', 'unavailable', 'valid');
  } catch {
    return readinessResponse('not-ready', 'unavailable', 'valid');
  }
}
