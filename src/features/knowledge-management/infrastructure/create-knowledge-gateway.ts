import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import { TenantApiKnowledgeGateway } from './tenant-api-knowledge-gateway';

export function createKnowledgeGateway(accessToken: string) {
  const tenantApi = getTenantApiConfig();
  return new TenantApiKnowledgeGateway(tenantApi.baseUrl, accessToken, fetch, tenantApi.timeoutMs);
}
