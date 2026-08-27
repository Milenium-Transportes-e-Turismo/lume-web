import 'server-only';

import { resolveTenantApiBaseUrl, resolveTenantApiTimeout } from '@/features/auth/infrastructure';

import type { RegistrationGateway } from '../application';
import { TenantApiRegistrationGateway } from './tenant-api-registration-gateway';

export function createRegistrationGateway(accessToken: string): RegistrationGateway {
  return new TenantApiRegistrationGateway(
    resolveTenantApiBaseUrl(process.env.LUME_TENANT_API_URL),
    accessToken,
    fetch,
    resolveTenantApiTimeout(process.env.LUME_TENANT_API_TIMEOUT_MS),
  );
}
