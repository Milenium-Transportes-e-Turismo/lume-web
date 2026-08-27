import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { RegistrationGatewayError, type RegistrationGateway } from '../application';

type Fetcher = typeof fetch;

const nullableString = z.string().nullable();
const roleSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
  active: z.boolean().optional(),
});
const tagSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  color: nullableString,
  active: z.boolean().optional(),
});
const phoneSchema = z
  .object({
    id: z.string().uuid().optional(),
    number: z.string(),
    originalValue: nullableString.optional(),
    normalizedValue: z.string().optional(),
    type: z.enum(['mobile', 'commercial', 'residential', 'other']),
    isPrimary: z.boolean(),
    hasWhatsApp: z.boolean(),
    whatsappContactId: z.string().uuid().nullable().optional(),
    activeFrom: nullableString.optional(),
    activeUntil: nullableString.optional(),
  })
  .passthrough();
const emailSchema = z
  .object({
    id: z.string().uuid().optional(),
    address: z.string(),
    type: z.enum(['personal', 'commercial', 'financial', 'other']),
    isPrimary: z.boolean(),
  })
  .passthrough();
const relatedRegistrationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['pf', 'pj']),
  displayName: z.string(),
});
const relationshipSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(['incoming', 'outgoing']),
  type: z.string(),
  jobTitle: nullableString,
  department: nullableString,
  isPrimary: z.boolean(),
  notes: nullableString,
  version: z.number().int(),
  relatedRegistration: relatedRegistrationSchema,
});
const registrationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['pf', 'pj']),
  status: z.enum(['active', 'inactive']),
  displayName: z.string(),
  firstName: nullableString,
  lastName: nullableString,
  individualName: nullableString,
  legalName: z.string(),
  tradeName: nullableString,
  cpf: nullableString,
  cnpj: nullableString,
  avicExternalId: nullableString,
  roles: z.array(roleSchema),
  tags: z.array(tagSchema),
  phones: z.array(phoneSchema),
  emails: z.array(emailSchema),
  relationships: z.array(relationshipSchema),
  externalReferences: z.array(
    z
      .object({
        id: z.string().uuid(),
        provider: z.string(),
        resourceType: z.string(),
        externalResourceId: z.string(),
        syncStatus: nullableString,
        lastSyncedAt: nullableString,
      })
      .passthrough(),
  ),
  version: z.number().int(),
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
const batchSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  fileSha256: z.string(),
  source: z.string(),
  status: z.enum(['processing', 'completed', 'completed-with-errors', 'failed']),
  metadata: z.record(z.string(), z.unknown()),
  counts: z.record(z.string(), z.unknown()),
  totalRows: z.number().int(),
  importedRows: z.number().int(),
  duplicateRows: z.number().int(),
  ignoredRows: z.number().int(),
  errorRows: z.number().int(),
  errorMessage: nullableString,
  completedAt: nullableString,
  createdAt: z.string(),
  updatedAt: z.string(),
});
const sourceSchema = z.object({
  id: z.string().uuid(),
  matchRule: nullableString,
  score: z.number().int().nullable(),
  evidence: nullableString,
  isPrimary: z.boolean(),
  externalRecord: z.object({
    id: z.string().uuid(),
    kind: z.enum(['pdf-customer', 'whatsapp-contact']),
    sourceSheet: z.string(),
    sourceRow: z.number().int(),
    externalId: z.string(),
    rawPayload: z.record(z.string(), z.unknown()),
    normalizedPayload: z.record(z.string(), z.unknown()),
    technicalRecord: z.boolean(),
  }),
});
const candidateSchema = z.object({
  id: z.string().uuid(),
  batch: z.object({
    id: z.string().uuid(),
    fileName: z.string(),
    source: z.string(),
    createdAt: z.string(),
  }),
  status: z.enum([
    'imported',
    'processing',
    'insufficient-data',
    'ready-for-decision',
    'ambiguous',
    'in-review',
    'unidentified',
    'ignored',
    'approved',
    'promoted',
    'error',
  ]),
  suggestedType: z.enum(['pf', 'pj']).nullable(),
  confirmedType: z.enum(['pf', 'pj']).nullable(),
  displayName: nullableString,
  normalizedName: nullableString,
  documentOriginal: nullableString,
  documentNormalized: nullableString,
  documentValid: z.boolean().nullable(),
  phoneOriginal: nullableString,
  phoneNormalized: nullableString,
  city: nullableString,
  state: nullableString,
  confidence: z.number().int(),
  priority: z.number().int(),
  suggestedRoles: z.array(z.unknown()),
  evidence: z.array(z.unknown()),
  qualityIssues: z.array(z.string()),
  minimumDataComplete: z.boolean(),
  confirmedPayload: z.record(z.string(), z.unknown()).nullable(),
  whatsappConversationId: z.string().uuid().nullable(),
  reviewedAt: nullableString,
  promotedRegistration: relatedRegistrationSchema.nullable(),
  promotedAt: nullableString,
  version: z.number().int(),
  sources: z.array(sourceSchema),
  decisions: z.array(
    z
      .object({
        id: z.string().uuid(),
        action: z.string(),
        actorName: z.string(),
        note: nullableString,
        createdAt: z.string(),
      })
      .passthrough(),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function listSchema<T extends z.ZodType>(schema: T) {
  return z.object({ items: z.array(schema), total: z.number().int().nonnegative() });
}

function queryString(values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export class TenantApiRegistrationGateway implements RegistrationGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  catalog() {
    return this.json(
      '/registrations/catalog',
      z.object({ roles: z.array(roleSchema), tags: z.array(tagSchema) }),
    );
  }

  list(query: Record<string, string | number | undefined> = {}) {
    return this.json(`/registrations${queryString(query)}`, listSchema(registrationSchema));
  }

  get(id: string) {
    return this.json(`/registrations/${encodeURIComponent(id)}`, registrationSchema);
  }

  create(input: Record<string, unknown>) {
    return this.json('/registrations', registrationSchema, {
      method: 'POST',
      body: { ...input, commandId: randomUUID() },
    });
  }

  update(id: string, input: Record<string, unknown>) {
    return this.json(`/registrations/${encodeURIComponent(id)}`, registrationSchema, {
      method: 'PATCH',
      body: { ...input, commandId: randomUUID() },
    });
  }

  history(id: string) {
    return this.json(`/registrations/${encodeURIComponent(id)}/history`, z.array(historySchema));
  }

  createRelationship(id: string, input: Record<string, unknown>) {
    return this.json(
      `/registrations/${encodeURIComponent(id)}/relationships`,
      z.record(z.string(), z.unknown()),
      { method: 'POST', body: { ...input, commandId: randomUUID() } },
    );
  }

  updateRelationship(id: string, relationshipId: string, input: Record<string, unknown>) {
    return this.json(
      `/registrations/${encodeURIComponent(id)}/relationships/${encodeURIComponent(relationshipId)}`,
      z.record(z.string(), z.unknown()),
      { method: 'PATCH', body: { ...input, commandId: randomUUID() } },
    );
  }

  removeRelationship(id: string, relationshipId: string, expectedVersion: number) {
    return this.json(
      `/registrations/${encodeURIComponent(id)}/relationships/${encodeURIComponent(relationshipId)}`,
      z.object({ removed: z.literal(true) }),
      {
        method: 'DELETE',
        body: { commandId: randomUUID(), expectedVersion },
      },
    );
  }

  listBatches() {
    return this.json('/registration-reconciliation/imports', z.array(batchSchema));
  }

  listCandidates(query: Record<string, string | number | boolean | undefined> = {}) {
    return this.json(
      `/registration-reconciliation/candidates${queryString(query)}`,
      listSchema(candidateSchema).extend({
        counts: z.record(z.string(), z.number().int().nonnegative()),
      }),
    );
  }

  getCandidate(id: string) {
    return this.json(
      `/registration-reconciliation/candidates/${encodeURIComponent(id)}`,
      candidateSchema,
    );
  }

  reviewCandidate(id: string, input: Record<string, unknown>) {
    return this.json(
      `/registration-reconciliation/candidates/${encodeURIComponent(id)}/review`,
      candidateSchema,
      { method: 'PATCH', body: { ...input, commandId: randomUUID() } },
    );
  }

  promoteCandidate(id: string, expectedVersion: number) {
    return this.json(
      `/registration-reconciliation/candidates/${encodeURIComponent(id)}/promote`,
      candidateSchema,
      { method: 'POST', body: { commandId: randomUUID(), expectedVersion } },
    );
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
      throw new RegistrationGatewayError(
        'invalid-response',
        'A API retornou uma resposta inválida.',
      );
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new RegistrationGatewayError(
        'invalid-response',
        'A API retornou dados de Cadastro incompatíveis.',
      );
    }
    return parsed.data;
  }

  private async request(
    path: string,
    input: { method?: string; body?: unknown } = {},
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
      throw new RegistrationGatewayError(
        'service-unavailable',
        'Não foi possível conectar à API de Cadastros.',
      );
    }
  }

  private async throwResponseError(response: Response): Promise<never> {
    let message = `A API respondeu com o status ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
      }
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
    throw new RegistrationGatewayError(code, message);
  }
}
