import { NextResponse } from 'next/server';

import { RegistrationGatewayError } from '@/features/registrations/application';
import { executeAuthenticatedRegistrationTokenMutation } from '@/features/registrations/server';

export const dynamic = 'force-dynamic';

function status(error: RegistrationGatewayError): number {
  if (error.code === 'unauthorized') return 401;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'not-found') return 404;
  if (error.code === 'conflict') return 409;
  if (error.code === 'validation') return 400;
  return 503;
}

async function proxy(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const path = (await context.params).path ?? [];
  if (request.method !== 'POST' || path.join('/') !== 'imports') {
    return NextResponse.json({ message: 'Operação de conciliação inválida.' }, { status: 404 });
  }
  try {
    return await executeAuthenticatedRegistrationTokenMutation(async (accessToken) => {
      const baseUrl = process.env.LUME_TENANT_API_URL;
      if (!baseUrl) throw new Error('LUME_TENANT_API_URL is required.');
      const headers = new Headers({
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      });
      const contentType = request.headers.get('content-type');
      if (contentType) headers.set('Content-Type', contentType);
      const init: RequestInit & { duplex?: 'half' } = {
        method: 'POST',
        cache: 'no-store',
        headers,
        signal: AbortSignal.timeout(240_000),
      };
      if (request.body) {
        init.body = request.body;
        init.duplex = 'half';
      }
      const upstream = await fetch(
        `${baseUrl.replace(/\/+$/, '')}/registration-reconciliation/imports`,
        init,
      );
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        },
      });
    });
  } catch (error) {
    if (error instanceof RegistrationGatewayError) {
      return NextResponse.json({ message: error.message }, { status: status(error) });
    }
    return NextResponse.json(
      { message: 'Não foi possível importar a planilha de conciliação.' },
      { status: 503 },
    );
  }
}

export const POST = proxy;
