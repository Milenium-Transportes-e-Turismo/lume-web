import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import type { AuthenticationGateway } from '../../application';
import { TenantApiAuthenticationGateway } from './tenant-api-authentication-gateway';

export function createTenantApiAuthenticationGateway(): AuthenticationGateway {
  const tenantApi = getTenantApiConfig();

  return new TenantApiAuthenticationGateway({
    baseUrl: tenantApi.baseUrl,
    timeoutMs: tenantApi.timeoutMs,
  });
}
