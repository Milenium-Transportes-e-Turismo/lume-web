import 'server-only';

import { resolveTenantApiBaseUrl, resolveTenantApiTimeout } from '@/features/auth/infrastructure';

import type { ClientGateway } from '../application/client-gateway';
import { TenantApiClientGateway } from './tenant-api-client-gateway';

export function createClientGateway(accessToken: string): ClientGateway {
  return new TenantApiClientGateway(
    resolveTenantApiBaseUrl(process.env.LUME_TENANT_API_URL),
    accessToken,
    fetch,
    resolveTenantApiTimeout(process.env.LUME_TENANT_API_TIMEOUT_MS),
  );
}
