import 'server-only';

import { resolveTenantApiBaseUrl, resolveTenantApiTimeout } from '@/features/auth/infrastructure';

import type { RoutePlannerGateway } from '../application/route-planner-gateway';
import { TenantApiRoutePlannerGateway } from './tenant-api-route-planner-gateway';

export function createRoutePlannerGateway(accessToken: string): RoutePlannerGateway {
  return new TenantApiRoutePlannerGateway(
    resolveTenantApiBaseUrl(process.env.LUME_TENANT_API_URL),
    accessToken,
    fetch,
    Math.max(30_000, resolveTenantApiTimeout(process.env.LUME_TENANT_API_TIMEOUT_MS)),
  );
}
