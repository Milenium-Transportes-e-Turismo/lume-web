import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import { TenantApiAgentAdministrationGateway } from './tenant-api-agent-administration-gateway';

export function createAgentAdministrationGateway(accessToken: string) {
  const tenantApi = getTenantApiConfig();
  return new TenantApiAgentAdministrationGateway(
    tenantApi.baseUrl,
    accessToken,
    fetch,
    tenantApi.timeoutMs,
  );
}
