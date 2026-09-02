import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import { TenantApiRegistrationDataReviewGateway } from './tenant-api-registration-data-review-gateway';

export function createRegistrationDataReviewGateway(accessToken: string) {
  const tenantApi = getTenantApiConfig();
  return new TenantApiRegistrationDataReviewGateway(
    tenantApi.baseUrl,
    accessToken,
    fetch,
    tenantApi.timeoutMs,
  );
}
