import 'server-only';

import { getServerEnv } from '@/env.server';

import type { WhatsAppConversationRepository } from '../application';
import { LumeApiWhatsAppConversationRepository } from './tenant-api-whatsapp-conversation-repository';

export async function createWhatsAppConversationRepository(
  accessToken?: string,
  nodeEnvironment?: string,
): Promise<WhatsAppConversationRepository> {
  const environment = getServerEnv(
    nodeEnvironment === undefined ? {} : { NODE_ENV: nodeEnvironment },
  );
  const dataSource = environment.LUME_TENANT_WHATSAPP_DATA_SOURCE;

  if (dataSource === 'mock') {
    const { MockWhatsAppConversationRepository } = await import('./mock');
    return new MockWhatsAppConversationRepository();
  }

  if (!accessToken?.trim()) {
    throw new Error('An authenticated Tenant API access token is required.');
  }

  if (environment.LUME_TENANT_API_URL === undefined) {
    throw new Error('LUME_TENANT_API_URL is required when simulated authentication is disabled.');
  }

  return new LumeApiWhatsAppConversationRepository(
    environment.LUME_TENANT_API_URL,
    accessToken,
    fetch,
    environment.LUME_TENANT_API_TIMEOUT_MS,
  );
}
