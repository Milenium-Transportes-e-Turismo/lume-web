import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import type { RegistrationGateway } from '../application';
import { TenantApiRegistrationGateway } from './tenant-api-registration-gateway';

export function createRegistrationGateway(accessToken: string): RegistrationGateway {
  const tenantApi = getTenantApiConfig();

  return new TenantApiRegistrationGateway(
    tenantApi.baseUrl,
    accessToken,
    fetch,
    tenantApi.timeoutMs,
  );
}
