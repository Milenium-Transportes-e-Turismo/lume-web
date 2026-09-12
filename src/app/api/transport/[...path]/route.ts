import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allowedTransportPath, TransportError } from '@/features/transport/domain/contracts';
import { executeTransport } from '@/features/transport/server/execute-transport';

const queryKeys = new Set([
  'registrationId',
  'page',
  'pageSize',
  'search',
  'kind',
  'role',
  'active',
  'status',
  'cursor',
  'limit',
  'vehicleId',
  'from',
  'to',
  'contractId',
  'type',
]);
const command = z
  .object({
    commandId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .passthrough();
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path.join('/');
    if (!allowedTransportPath(path, request.method))
      throw new TransportError(400, 'Operação inválida.', 'INVALID_TRANSPORT_OPERATION');
    const params = new URL(request.url).searchParams;
    for (const key of params.keys())
      if (!queryKeys.has(key))
        throw new TransportError(400, 'Filtro inválido.', 'INVALID_TRANSPORT_FILTER');
    if (
      params.has('registrationId') &&
      (params.getAll('registrationId').length !== 1 ||
        !z.uuid().safeParse(params.get('registrationId')).success)
    )
      throw new TransportError(400, 'Cadastro inválido.', 'INVALID_TRANSPORT_FILTER');
    if (['imports', 'records', 'issues', 'analysis'].includes(path) || path.endsWith('/rejections'))
      params.set('limit', '25');
    else if (
      [
        'companies',
        'fleet',
        'catalogs',
        'affiliations',
        'contracts',
        'routes',
        'contracts/candidates',
        'lookups/registrations',
      ].includes(path)
    )
      params.set('pageSize', '25');
    let body: unknown;
    if (request.method !== 'GET') {
      const raw = await request.text();
      if (raw.length > 32_768)
        throw new TransportError(413, 'Solicitação muito grande.', 'HTTP_413');
      let decoded: unknown;
      try {
        decoded = JSON.parse(raw);
      } catch {
        throw new TransportError(400, 'O corpo da solicitação é inválido.', 'INVALID_JSON');
      }
      const parsed = command.safeParse(decoded);
      if (!parsed.success)
        throw new TransportError(400, 'Comando inválido.', 'INVALID_TRANSPORT_COMMAND');
      body = parsed.data;
      if (
        Object.keys(parsed.data).some((key) =>
          ['companyId', 'tenantId', 'accessToken', 'authorization'].includes(key),
        )
      )
        throw new TransportError(400, 'Campo inválido.', 'INVALID_TRANSPORT_FIELD');
    }
    const value = await executeTransport((gateway) =>
      gateway.request(path, request.method, params.size ? '?' + params : '', body),
    );
    return NextResponse.json(value, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const known = error instanceof TransportError;
    return NextResponse.json(
      {
        message: known ? error.message : 'Não foi possível concluir a operação.',
        code: known ? error.code : 'TRANSPORT_UNEXPECTED_ERROR',
      },
      { status: known ? error.status : 502 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
