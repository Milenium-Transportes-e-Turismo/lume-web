import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { ClientError, type ClientGateway } from '../application/client-gateway';

type Fetcher = typeof fetch;
const nullableString = z.string().nullable();
const phoneSchema = z.object({ number: z.string(), description: nullableString.optional() });
const clientSchema = z.object({
  id: z.string().uuid(),
  taxId: z.string(),
  legalName: z.string(),
  tradeName: nullableString,
  costCenter: nullableString,
  clientType: z.enum(['pf', 'pj']),
  avicExternalId: nullableString,
  individualName: nullableString,
  cpf: nullableString,
  individualEmail: nullableString,
  individualWhatsapp: nullableString,
  individualPhones: z.array(phoneSchema),
  cnpj: nullableString,
  legalEmail: nullableString,
  legalWhatsapp: nullableString,
  legalPhones: z.array(phoneSchema),
  status: z.enum(['active', 'inactive', 'suspended']),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const commentSchema = z.object({
  id: z.string().uuid(),
  comment: z.string(),
  authorName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const historySchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  actorName: nullableString,
  beforeSnapshot: z.record(z.string(), z.unknown()).nullable(),
  afterSnapshot: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.size > 0 ? `?${query}` : '';
}

export class TenantApiClientGateway implements ClientGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  list(query: Parameters<ClientGateway['list']>[0] = {}) {
    return this.json(
      `/clients${queryString(query)}`,
      z.object({ items: z.array(clientSchema), total: z.number().int().nonnegative() }),
    );
  }

  create(input: Record<string, unknown>) {
    return this.json('/clients', clientSchema, {
      method: 'POST',
      body: { ...input, commandId: randomUUID() },
    });
  }

  update(id: string, input: Record<string, unknown>) {
    return this.json(`/clients/${encodeURIComponent(id)}`, clientSchema, {
      method: 'PATCH',
      body: { ...input, commandId: randomUUID() },
    });
  }

  get(id: string) {
    return this.json(`/clients/${encodeURIComponent(id)}`, clientSchema);
  }

  listComments(id: string) {
    return this.json(`/clients/${encodeURIComponent(id)}/comments`, z.array(commentSchema));
  }

  addComment(id: string, comment: string) {
    return this.json(`/clients/${encodeURIComponent(id)}/comments`, commentSchema, {
      method: 'POST',
      body: { commandId: randomUUID(), comment },
    });
  }

  updateComment(id: string, commentId: string, comment: string) {
    return this.json(
      `/clients/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
      commentSchema,
      { method: 'PATCH', body: { commandId: randomUUID(), comment } },
    );
  }

  removeComment(id: string, commentId: string) {
    return this.json(
      `/clients/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}?commandId=${randomUUID()}`,
      z.object({ removed: z.literal(true) }),
      { method: 'DELETE' },
    );
  }

  listHistory(id: string) {
    return this.json(`/clients/${encodeURIComponent(id)}/history`, z.array(historySchema));
  }

  private async json<T>(
    path: string,
    schema: z.ZodType<T>,
    input: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const response = await this.request(path, input);
    if (!response.ok) await this.throwResponseError(response);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ClientError('invalid-response', 'A API retornou uma resposta inválida.');
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new ClientError('invalid-response', 'A API retornou dados de clientes incompatíveis.');
    }
    return parsed.data;
  }

  private async request(
    path: string,
    input: { method?: string; body?: unknown },
  ): Promise<Response> {
    try {
      return await this.fetcher(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
        method: input.method ?? 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          ...(input.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new ClientError('service-unavailable', 'Não foi possível conectar à API de clientes.');
    }
  }

  private async throwResponseError(response: Response): Promise<never> {
    let message = `A API respondeu com o status ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message)
        message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    } catch {}
    const code =
      response.status === 401
        ? 'unauthorized'
        : response.status === 403
          ? 'forbidden'
          : response.status === 404
            ? 'not-found'
            : response.status === 409
              ? 'conflict'
              : response.status < 500
                ? 'validation'
                : 'service-unavailable';
    throw new ClientError(code, message);
  }
}
