import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import type { ClientGateway } from '../application/client-gateway';
import { TenantApiClientGateway } from './tenant-api-client-gateway';

export function createClientGateway(accessToken: string): ClientGateway {
  const tenantApi = getTenantApiConfig();

  return new TenantApiClientGateway(tenantApi.baseUrl, accessToken, fetch, tenantApi.timeoutMs);
}
