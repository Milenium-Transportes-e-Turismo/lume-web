import 'server-only';
import { getTenantApiConfig } from '@/env.server';
import { allowedTransportPath, TransportError, transportResponseSchema } from '../domain/contracts';

export class TransportGateway {
  constructor(
    private readonly accessToken: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  async request(path: string, method = 'GET', query = '', body?: unknown): Promise<unknown> {
    if (!allowedTransportPath(path, method))
      throw new TransportError(
        400,
        'Operação de transporte inválida.',
        'INVALID_TRANSPORT_OPERATION',
      );
    const config = getTenantApiConfig();
    const target = path.startsWith('lookups/registrations')
      ? path.replace('lookups/', '/')
      : '/transport/' + path;
    let response: Response;
    try {
      response = await this.fetcher(config.baseUrl.replace(/\/+$/, '') + target + query, {
        method,
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.max(config.timeoutMs, 30_000)),
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + this.accessToken,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new TransportError(
        503,
        'A API está indisponível. Tente novamente.',
        'TRANSPORT_UNAVAILABLE',
      );
    }
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      const code = typeof value?.code === 'string' ? value.code : 'HTTP_' + response.status;
      const message =
        response.status === 409
          ? 'O registro mudou. Recarregue os dados antes de tentar novamente.'
          : response.status === 401
            ? 'Sua sessão expirou. Entre novamente.'
            : response.status === 403
              ? 'Você não possui permissão para esta operação.'
              : response.status >= 500
                ? 'A operação está indisponível. Tente novamente.'
                : typeof value?.message === 'string'
                  ? value.message
                  : 'A API recusou a operação. Confira os campos.';
      throw new TransportError(response.status, message, code);
    }
    const parsed = transportResponseSchema(path, method).safeParse(value);
    if (!parsed.success)
      throw new TransportError(
        502,
        'A API retornou dados incompatíveis.',
        'TRANSPORT_INVALID_RESPONSE',
      );
    return parsed.data;
  }
}
