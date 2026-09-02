import 'server-only';

import { z } from 'zod';

import {
  KnowledgeGatewayError,
  type KnowledgeGateway,
  type KnowledgeGatewayErrorCode,
  type KnowledgeMetadataInput,
} from '../application';
import {
  KNOWLEDGE_GAP_STATUSES,
  KNOWLEDGE_SCOPES,
  KNOWLEDGE_SUGGESTION_STATUSES,
  KNOWLEDGE_VERSION_STATUSES,
  KNOWLEDGE_VISIBILITIES,
  type KnowledgeGapStatus,
  type KnowledgeSuggestionStatus,
} from '../domain';

type Fetcher = typeof fetch;

const isoDateSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const nullableIsoDateSchema = isoDateSchema.nullable();
const jsonRecordSchema = z.record(z.string(), z.unknown());
const originalSchema = z
  .object({
    available: z.literal(true),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .nullable();
const chunkSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().nonnegative(),
  pageNumber: z.number().int().positive().nullable(),
  content: z.string(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  tokenCount: z.number().int().nonnegative().nullable(),
  provenance: jsonRecordSchema,
});
const versionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(KNOWLEDGE_VERSION_STATUSES),
  content: z.string().nullable(),
  original: originalSchema,
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/u)
    .nullable(),
  provenance: jsonRecordSchema,
  effectiveFrom: nullableIsoDateSchema,
  effectiveUntil: nullableIsoDateSchema,
  publishedAt: nullableIsoDateSchema,
  createdAt: isoDateSchema,
  chunks: z.array(chunkSchema).optional().default([]),
});
const baseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  enabled: z.boolean(),
  archivedAt: nullableIsoDateSchema,
  documentCount: z.number().int().nonnegative(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
const departmentSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  isDefault: z.boolean(),
});
const documentFields = {
  id: z.string().uuid(),
  knowledgeBaseId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  sourceType: z.enum(['article', 'file']),
  scope: z.enum(KNOWLEDGE_SCOPES),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES),
  departmentIds: z.array(z.string().uuid()),
  archivedAt: nullableIsoDateSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
} as const;
const documentSummarySchema = z.object({
  ...documentFields,
  latestVersion: versionSchema.nullable(),
});
const documentSchema = z.object({ ...documentFields, versions: z.array(versionSchema) });
const suggestionSchema = z.object({
  id: z.string().uuid(),
  serviceSessionId: z.string().uuid().nullable(),
  agentExecutionId: z.string().uuid().nullable(),
  resultingDocumentId: z.string().uuid().nullable(),
  title: z.string().min(1),
  proposedContent: z.string(),
  evidence: jsonRecordSchema,
  status: z.enum(KNOWLEDGE_SUGGESTION_STATUSES),
  reviewedByUserId: z.string().uuid().nullable(),
  reviewedAt: nullableIsoDateSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
const gapSchema = z.object({
  id: z.string().uuid(),
  serviceSessionId: z.string().uuid().nullable(),
  agentExecutionId: z.string().uuid().nullable(),
  topic: z.string().min(1),
  occurrenceCount: z.number().int().positive(),
  status: z.enum(KNOWLEDGE_GAP_STATUSES),
  evidence: jsonRecordSchema,
  firstObservedAt: isoDateSchema,
  lastObservedAt: isoDateSchema,
  resolvedAt: nullableIsoDateSchema,
});
const mutationSchema = z.object({}).passthrough();
const apiErrorSchema = z.object({
  code: z.unknown().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
});

function gatewayCode(status: number): KnowledgeGatewayErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if ([400, 413, 422].includes(status)) return 'validation';
  return 'service-unavailable';
}

function publicCode(value: unknown, status: number): string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/u.test(value)
    ? value
    : `HTTP_${status}`;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new KnowledgeGatewayError(
      'invalid-response',
      'A Tenant API retornou dados de knowledge incompatíveis com o contrato.',
      'INVALID_API_RESPONSE',
    );
  }
  return parsed.data;
}

function query(path: string, key: string, value?: string): string {
  return value ? `${path}?${key}=${encodeURIComponent(value)}` : path;
}

export class TenantApiKnowledgeGateway implements KnowledgeGateway {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 5_000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/u, '');
  }

  async listDepartments() {
    return parse(z.array(departmentSchema), await this.request('/knowledge/departments'));
  }

  async listBases() {
    return parse(z.array(baseSchema), await this.request('/knowledge/bases'));
  }

  createBase(input: {
    readonly commandId: string;
    readonly name: string;
    readonly description?: string;
  }) {
    return this.mutation('/knowledge/bases', 'POST', input);
  }

  async listDocuments(knowledgeBaseId?: string) {
    return parse(
      z.array(documentSummarySchema),
      await this.request(query('/knowledge/documents', 'knowledgeBaseId', knowledgeBaseId)),
    );
  }

  async getDocument(documentId: string) {
    return parse(
      documentSchema,
      await this.request(`/knowledge/documents/${encodeURIComponent(documentId)}`),
    );
  }

  createArticle(input: KnowledgeMetadataInput & { readonly content: string }) {
    return this.mutation('/knowledge/articles', 'POST', input);
  }

  uploadOriginal(input: KnowledgeMetadataInput & { readonly file: File }) {
    const body = new FormData();
    body.set('file', input.file);
    body.set('commandId', input.commandId);
    body.set('knowledgeBaseId', input.knowledgeBaseId);
    body.set('title', input.title);
    if (input.description) body.set('description', input.description);
    body.set('scope', input.scope);
    body.set('visibility', input.visibility);
    body.set('departmentIds', JSON.stringify(input.departmentIds));
    if (input.effectiveFrom) body.set('effectiveFrom', input.effectiveFrom);
    if (input.effectiveUntil) body.set('effectiveUntil', input.effectiveUntil);
    return this.mutation('/knowledge/files', 'POST', body);
  }

  createNextDraft(documentId: string, input: Parameters<KnowledgeGateway['createNextDraft']>[1]) {
    return this.mutation(
      `/knowledge/documents/${encodeURIComponent(documentId)}/drafts`,
      'POST',
      input,
    );
  }

  updateDraft(
    documentId: string,
    versionId: string,
    input: Parameters<KnowledgeGateway['updateDraft']>[2],
  ) {
    return this.mutation(
      `/knowledge/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/draft`,
      'PATCH',
      input,
    );
  }

  publishVersion(
    documentId: string,
    versionId: string,
    input: Parameters<KnowledgeGateway['publishVersion']>[2],
  ) {
    return this.versionMutation(documentId, versionId, 'publish', input);
  }

  archiveVersion(
    documentId: string,
    versionId: string,
    input: Parameters<KnowledgeGateway['archiveVersion']>[2],
  ) {
    return this.versionMutation(documentId, versionId, 'archive', input);
  }

  archiveDocument(documentId: string, input: Parameters<KnowledgeGateway['archiveDocument']>[1]) {
    return this.mutation(
      `/knowledge/documents/${encodeURIComponent(documentId)}/archive`,
      'POST',
      input,
    );
  }

  async getOriginal(documentId: string, versionId: string): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.baseUrl}/knowledge/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/original`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
    } catch {
      throw new KnowledgeGatewayError(
        'service-unavailable',
        'Não foi possível conectar à Tenant API para baixar o original.',
        'KNOWLEDGE_API_UNAVAILABLE',
      );
    }
    if (!response.ok) {
      const value = await response.json().catch(() => null);
      const parsed = apiErrorSchema.safeParse(value);
      const raw = parsed.success ? parsed.data.message : undefined;
      throw new KnowledgeGatewayError(
        gatewayCode(response.status),
        (Array.isArray(raw) ? raw.join(' ') : raw)?.trim() || 'A Tenant API recusou o download.',
        publicCode(parsed.success ? parsed.data.code : undefined, response.status),
      );
    }
    return response;
  }

  async listSuggestions(status?: KnowledgeSuggestionStatus) {
    return parse(
      z.array(suggestionSchema),
      await this.request(query('/knowledge/suggestions', 'status', status)),
    );
  }

  reviewSuggestion(
    suggestionId: string,
    input: Parameters<KnowledgeGateway['reviewSuggestion']>[1],
  ) {
    return this.mutation(
      `/knowledge/suggestions/${encodeURIComponent(suggestionId)}/review`,
      'POST',
      input,
    );
  }

  async listGaps(status?: KnowledgeGapStatus) {
    return parse(
      z.array(gapSchema),
      await this.request(query('/knowledge/gaps', 'status', status)),
    );
  }

  reviewGap(gapId: string, input: Parameters<KnowledgeGateway['reviewGap']>[1]) {
    return this.mutation(`/knowledge/gaps/${encodeURIComponent(gapId)}/review`, 'POST', input);
  }

  private versionMutation(
    documentId: string,
    versionId: string,
    action: 'publish' | 'archive',
    input: { readonly commandId: string; readonly expectedVersion: number },
  ) {
    return this.mutation(
      `/knowledge/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/${action}`,
      'POST',
      input,
    );
  }

  private async mutation(path: string, method: 'POST' | 'PATCH', body: unknown) {
    return parse(mutationSchema, await this.request(path, { method, body }));
  }

  private async request(
    path: string,
    input: { readonly method?: string; readonly body?: unknown } = {},
  ): Promise<unknown> {
    const formData = input.body instanceof FormData;
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: input.method ?? 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          ...(input.body === undefined || formData ? {} : { 'Content-Type': 'application/json' }),
        },
        body:
          input.body === undefined ? undefined : formData ? input.body : JSON.stringify(input.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new KnowledgeGatewayError(
        'service-unavailable',
        'Não foi possível conectar à Tenant API para consultar knowledge.',
        'KNOWLEDGE_API_UNAVAILABLE',
      );
    }

    if (!response.ok) {
      const value = await response.json().catch(() => null);
      const parsed = apiErrorSchema.safeParse(value);
      const raw = parsed.success ? parsed.data.message : undefined;
      const message = Array.isArray(raw) ? raw.join(' ') : raw;
      throw new KnowledgeGatewayError(
        gatewayCode(response.status),
        message?.trim() || 'A Tenant API recusou a operação de knowledge.',
        publicCode(parsed.success ? parsed.data.code : undefined, response.status),
      );
    }

    return response.json().catch(() => {
      throw new KnowledgeGatewayError(
        'invalid-response',
        'A Tenant API retornou uma resposta inválida para knowledge.',
        'INVALID_API_RESPONSE',
      );
    });
  }
}
