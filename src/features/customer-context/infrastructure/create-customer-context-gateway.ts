import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import { TenantApiCustomerContextGateway } from './tenant-api-customer-context-gateway';

export function createCustomerContextGateway(accessToken: string) {
  const tenantApi = getTenantApiConfig();
  return new TenantApiCustomerContextGateway(
    tenantApi.baseUrl,
    accessToken,
    fetch,
    tenantApi.timeoutMs,
  );
}
