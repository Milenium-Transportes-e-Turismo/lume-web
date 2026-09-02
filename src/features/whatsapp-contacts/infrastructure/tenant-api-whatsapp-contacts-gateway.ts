import 'server-only';

import { getTenantApiConfig } from '@/env.server';

export async function proxyWhatsAppContactsRequest(
  accessToken: string,
  request: Request,
  upstreamPath: string,
): Promise<Response> {
  const tenantApi = getTenantApiConfig('LUME_TENANT_API_URL is required.');
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const url = new URL(request.url);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
  };
  if (hasBody && request.body !== null) {
    init.body = request.body;
    init.duplex = 'half';
  }
  const upstream = await fetch(
    `${tenantApi.baseUrl}/whatsapp/contacts${upstreamPath}${url.search}`,
    init,
  );
  if (upstream.status < 500) return upstream;
  return Response.json(
    { message: 'Não foi possível concluir a operação com o contato.' },
    { status: upstream.status },
  );
}
