import 'server-only';

import { z } from 'zod';
import { getTenantApiConfig } from '@/env.server';
import { WhatsAppConversationRepositoryError } from '@/features/whatsapp-conversations/application';

export const contactExportPreviewSchema = z.object({
  total: z.number().int().nonnegative(),
  batch: z.number().int().positive(),
  batchSize: z.number().int().positive(),
  totalBatches: z.number().int().positive(),
  contacts: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      phones: z.array(z.string()),
      emails: z.array(z.string()),
    }),
  ),
});

export async function proxyRegistrationContactExport(accessToken: string, request: Request) {
  const config = getTenantApiConfig('LUME_TENANT_API_URL is required.');
  const url = new URL(request.url);
  const batch = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .safeParse(url.searchParams.get('batch') ?? 1);
  if (!batch.success) return Response.json({ message: 'Lote inválido.' }, { status: 400 });
  let body: string | undefined;
  if (request.method === 'POST') {
    const parsed = z
      .object({ commandId: z.string().uuid(), batch: z.number().int().min(1).max(100000) })
      .strict()
      .safeParse(await request.clone().json().catch(() => null));
    if (!parsed.success)
      return Response.json({ message: 'Pedido de exportação inválido.' }, { status: 400 });
    body = JSON.stringify(parsed.data);
  }
  const response = await fetch(
    config.baseUrl +
      '/registrations/contact-export' +
      (request.method === 'GET' ? '?batch=' + batch.data : ''),
    {
      method: request.method,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        Accept: request.method === 'POST' ? 'text/csv' : 'application/json',
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
    },
  );
  if (response.status === 401) {
    throw new WhatsAppConversationRepositoryError(
      'unauthorized',
      'Sua sessão expirou. Entre novamente.',
    );
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: unknown;
      code?: unknown;
    } | null;
    return Response.json(
      {
        code: typeof error?.code === 'string' ? error.code : 'HTTP_' + response.status,
        message:
          response.status < 500 && typeof error?.message === 'string'
            ? error.message
            : 'Não foi possível exportar os contatos.',
      },
      { status: response.status },
    );
  }
  if (request.method === 'GET') {
    const parsed = contactExportPreviewSchema.safeParse(await response.json());
    if (!parsed.success)
      return Response.json(
        { message: 'Resposta inválida ao carregar os contatos.' },
        { status: 502 },
      );
    return Response.json(parsed.data, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (!response.headers.get('content-type')?.startsWith('text/csv')) {
    return Response.json({ message: 'Arquivo de exportação inválido.' }, { status: 502 });
  }
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Disposition':
        response.headers.get('content-disposition') ??
        'attachment; filename="lume-google-contacts.csv"',
    },
  });
}
