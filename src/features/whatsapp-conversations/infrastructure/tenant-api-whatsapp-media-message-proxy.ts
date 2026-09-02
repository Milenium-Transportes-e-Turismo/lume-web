import 'server-only';

import { getTenantApiConfig } from '@/env.server';

export async function proxyWhatsAppMediaMessage(
  accessToken: string,
  conversationId: string,
  request: Request,
): Promise<Response> {
  const tenantApi = getTenantApiConfig('LUME_TENANT_API_URL is required.');
  if (request.body === null) throw new Error('A mensagem não contém um arquivo.');

  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    cache: 'no-store',
    headers,
    body: request.body,
    duplex: 'half',
    signal: AbortSignal.timeout(600_000),
  };

  return fetch(
    `${tenantApi.baseUrl}/whatsapp/conversations/${encodeURIComponent(conversationId)}/media-messages`,
    init,
  );
}
