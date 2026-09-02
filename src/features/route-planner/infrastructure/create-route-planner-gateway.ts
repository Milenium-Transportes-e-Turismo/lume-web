import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import type { RoutePlannerGateway } from '../application/route-planner-gateway';
import { TenantApiRoutePlannerGateway } from './tenant-api-route-planner-gateway';

export function createRoutePlannerGateway(accessToken: string): RoutePlannerGateway {
  const tenantApi = getTenantApiConfig();

  return new TenantApiRoutePlannerGateway(
    tenantApi.baseUrl,
    accessToken,
    fetch,
    Math.max(30_000, tenantApi.timeoutMs),
  );
}
