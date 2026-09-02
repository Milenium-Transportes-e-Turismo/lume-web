import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import type { TenantAdministrationGateway } from '../application';
import { TenantApiAdministrationGateway } from './tenant-api-administration-gateway';

export function createTenantAdministrationGateway(
  accessToken: string,
): TenantAdministrationGateway {
  const tenantApi = getTenantApiConfig();

  return new TenantApiAdministrationGateway(
    tenantApi.baseUrl,
    accessToken,
    fetch,
    tenantApi.timeoutMs,
  );
}
