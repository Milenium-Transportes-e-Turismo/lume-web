import 'server-only';

import { getServerEnv } from '@/env.server';

export async function sanitizeWhatsAppHistoryImportResponse(upstream: Response): Promise<Response> {
  if (upstream.status < 500) return upstream;

  return Response.json(
    {
      message:
        'Não foi possível iniciar a importação. Tente novamente e, se o problema continuar, contate o suporte.',
    },
    {
      status: upstream.status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}

export async function proxyWhatsAppHistoryImportRequest(
  accessToken: string,
  request: Request,
  upstreamPath: string,
): Promise<Response> {
  const environment = getServerEnv();
  if (environment.LUME_TENANT_API_URL === undefined) {
    throw new Error('LUME_TENANT_API_URL is required.');
  }

  const headers = new Headers({
    Accept: request.headers.get('accept') ?? 'application/json',
    Authorization: `Bearer ${accessToken}`,
  });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    cache: 'no-store',
    headers,
    signal: AbortSignal.timeout(environment.LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS),
  };
  if (hasBody && request.body !== null) {
    init.body = request.body;
    init.duplex = 'half';
  }

  const upstream = await fetch(
    `${environment.LUME_TENANT_API_URL}/whatsapp/history-imports${upstreamPath}`,
    init,
  );
  return sanitizeWhatsAppHistoryImportResponse(upstream);
}
