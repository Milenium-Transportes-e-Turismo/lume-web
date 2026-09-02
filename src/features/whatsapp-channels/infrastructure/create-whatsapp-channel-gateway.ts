import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import { TenantApiWhatsAppChannelGateway } from './tenant-api-whatsapp-channel-gateway';

export function createWhatsAppChannelGateway(accessToken: string) {
  const tenantApi = getTenantApiConfig();
  return new TenantApiWhatsAppChannelGateway(
    tenantApi.baseUrl,
    accessToken,
    fetch,
    tenantApi.timeoutMs,
  );
}
