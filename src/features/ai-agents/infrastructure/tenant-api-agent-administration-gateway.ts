import 'server-only';

import { z } from 'zod';

import {
  AgentAdministrationError,
  type AgentAdministrationErrorCode,
  type AgentAdministrationGateway,
} from '../application';

type Fetcher = typeof fetch;

const isoDate = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const nullableIsoDate = isoDate.nullable();
const nullableNonnegativeInteger = z.number().int().nonnegative().nullable();
const promptVersionSchema = z.object({
  id: z.string().uuid(),
  kind: z.string().min(1),
  version: z.number().int().positive(),
  status: z.string().min(1),
  contentHash: z.string().min(1),
  activatedAt: nullableIsoDate,
});
const runtimeConfigurationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  provider: z.string().min(1),
  model: z.string().min(1),
  credentialVersion: z.number().int().positive().nullable(),
  status: z.string().min(1),
  activatedAt: nullableIsoDate,
  deactivatedAt: nullableIsoDate,
});
const agentSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  type: z.string().min(1),
  status: z.string().min(1),
  contexts: z.array(z.string().min(1)),
  customerFacing: z.boolean(),
  platformManaged: z.boolean(),
  promptVersions: z.array(promptVersionSchema),
  runtimeConfigs: z.array(runtimeConfigurationSchema),
  configurationStatus: z.enum(['ready', 'incomplete']),
  technicalConfigurationMutable: z.literal(false),
});
const attemptSchema = z.object({
  id: z.string().uuid(),
  attemptNumber: z.number().int().positive(),
  provider: z.string().min(1),
  model: z.string().min(1),
  status: z.string().min(1),
  latencyMs: nullableNonnegativeInteger,
  inputTokens: nullableNonnegativeInteger,
  outputTokens: nullableNonnegativeInteger,
  totalTokens: nullableNonnegativeInteger,
  errorCode: z.string().nullable(),
  startedAt: isoDate,
  completedAt: nullableIsoDate,
});
const toolCallSchema = z.object({
  id: z.string().uuid(),
  toolId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  status: z.string().min(1),
  resultSummary: z.unknown(),
  authorizationReason: z.string().nullable(),
  errorCode: z.string().nullable(),
  startedAt: isoDate,
  completedAt: nullableIsoDate,
  createdAt: isoDate,
});
const knowledgeSourceSchema = z.object({
  documentVersionId: z.string().uuid(),
  chunkId: z.string().uuid(),
  documentVersionNumber: z.number().int().positive(),
  chunkOrdinal: z.number().int().nonnegative(),
  pageNumber: z.number().int().positive().nullable(),
  retrievalRank: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).nullable(),
  retrievedAt: isoDate,
});
const executionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  agentType: z.string().min(1),
  serviceSessionId: z.string().uuid().nullable(),
  source: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  status: z.string().min(1),
  latencyMs: nullableNonnegativeInteger,
  inputTokens: nullableNonnegativeInteger,
  outputTokens: nullableNonnegativeInteger,
  totalTokens: nullableNonnegativeInteger,
  errorCode: z.string().nullable(),
  startedAt: isoDate,
  completedAt: nullableIsoDate,
  createdAt: isoDate,
  attempts: z.array(attemptSchema),
  toolCalls: z.array(toolCallSchema),
  knowledgeSources: z.array(knowledgeSourceSchema),
});
const executionPageSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(executionSchema),
});
const instructionResultSchema = z.object({
  agentId: z.string().uuid(),
  promptVersionId: z.string().uuid(),
  version: z.number().int().positive(),
  contentHash: z.string().min(1),
  idempotent: z.boolean(),
});
const instructionVersionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.string().min(1),
  content: z.string(),
  contentHash: z.string().min(1),
  activatedAt: nullableIsoDate,
  deactivatedAt: nullableIsoDate,
  createdAt: isoDate,
});
const rollbackResultSchema = instructionResultSchema.extend({
  sourceVersionId: z.string().uuid(),
});
const apiErrorSchema = z.object({
  code: z.unknown().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
});

function errorCode(status: number): AgentAdministrationErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 413 || status === 422) return 'validation';
  return 'service-unavailable';
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AgentAdministrationError(
      'invalid-response',
      'A Tenant API retornou dados de agentes incompatíveis com o contrato.',
      'INVALID_API_RESPONSE',
    );
  }
  return result.data;
}

export class TenantApiAgentAdministrationGateway implements AgentAdministrationGateway {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 5_000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/u, '');
  }

  async listAgents() {
    return parse(z.array(agentSchema), await this.request('/agents'));
  }

  async listExecutions(agentId: string, page = 1, limit = 25) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    return parse(
      executionPageSchema,
      await this.request(`/agents/${encodeURIComponent(agentId)}/executions?${query.toString()}`),
    );
  }

  async listTenantInstructionVersions(agentId: string) {
    return parse(
      z.array(instructionVersionSchema),
      await this.request(`/agents/${encodeURIComponent(agentId)}/tenant-instructions`),
    );
  }

  async updateTenantInstructions(
    agentId: string,
    input: {
      readonly commandId: string;
      readonly expectedVersion: number;
      readonly content: string;
    },
  ) {
    return parse(
      instructionResultSchema,
      await this.request(`/agents/${encodeURIComponent(agentId)}/tenant-instructions`, {
        method: 'POST',
        body: input,
      }),
    );
  }

  async rollbackTenantInstructions(
    agentId: string,
    versionId: string,
    input: { readonly commandId: string; readonly expectedVersion: number },
  ) {
    return parse(
      rollbackResultSchema,
      await this.request(
        `/agents/${encodeURIComponent(agentId)}/tenant-instructions/${encodeURIComponent(versionId)}/rollback`,
        { method: 'POST', body: input },
      ),
    );
  }

  private async request(
    path: string,
    input: { readonly method?: string; readonly body?: unknown } = {},
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
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
      throw new AgentAdministrationError(
        'service-unavailable',
        'Não foi possível conectar à Tenant API para consultar os agentes.',
        'AGENT_API_UNAVAILABLE',
      );
    }
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
      const rawMessage = parsed.success ? parsed.data.message : undefined;
      const message = Array.isArray(rawMessage) ? rawMessage.join(' ') : rawMessage;
      const rawCode = parsed.success ? parsed.data.code : undefined;
      throw new AgentAdministrationError(
        errorCode(response.status),
        message?.trim() || 'A Tenant API recusou a operação do agente.',
        typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/u.test(rawCode)
          ? rawCode
          : `HTTP_${response.status}`,
      );
    }
    return response.json().catch(() => {
      throw new AgentAdministrationError(
        'invalid-response',
        'A Tenant API retornou uma resposta inválida para agentes.',
        'INVALID_API_RESPONSE',
      );
    });
  }
}
