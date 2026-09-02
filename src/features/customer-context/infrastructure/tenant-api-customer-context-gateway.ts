import 'server-only';

import { z } from 'zod';

import {
  CustomerContextGatewayError,
  type CustomerContextGateway,
  type CustomerContextGatewayErrorCode,
} from '../application';
import {
  CUSTOMER_PROFILE_KEYS,
  sanitizeCustomerContextValue,
  type CustomerContextDetailSection,
} from '../domain';

type Fetcher = typeof fetch;
const isoDate = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const nullableUuid = z.string().uuid().nullable();
const profileKeySchema = z.enum(CUSTOMER_PROFILE_KEYS);
const relatedCompanySchema = z.object({
  registrationId: z.string().uuid(),
  displayName: z.string(),
  relationshipType: z.string(),
  jobTitle: z.string().nullable(),
  department: z.string().nullable(),
});
const profileItemSchema = z.object({
  suggestionId: z.string().uuid(),
  key: profileKeySchema,
  value: z.string(),
  approvedAt: isoDate,
});
const serviceSchema = z.object({
  serviceSessionId: z.string().uuid(),
  status: z.string(),
  controlMode: z.string(),
  departmentId: nullableUuid,
  priority: z.string(),
  pendingActionCount: z.number().int().nonnegative(),
  updatedAt: isoDate,
});
const quoteSchema = z.object({
  quoteRequestId: z.string().uuid(),
  status: z.string(),
  serviceType: z.string().nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  departureDate: z.string().nullable(),
  updatedAt: isoDate,
});
const pendingSchema = z.object({
  kind: z.enum(['service', 'quote', 'case']),
  id: z.string(),
  status: z.string(),
  updatedAt: isoDate,
});
const summarySchema = z.object({
  serviceSessionId: z.string().uuid(),
  whatsappContactId: z.string().uuid(),
  identity: z
    .object({
      registrationId: z.string().uuid(),
      kind: z.enum(['personal', 'company']),
      displayName: z.string(),
      confirmedAt: isoDate,
    })
    .nullable(),
  relatedCompanies: z.array(relatedCompanySchema),
  approvedProfile: z.array(profileItemSchema),
  recentServices: z.array(serviceSchema),
  recentQuotes: z.array(quoteSchema),
  pending: z.array(pendingSchema),
  limits: z.object({
    relatedCompanies: z.number().int().nonnegative(),
    approvedProfile: z.number().int().nonnegative(),
    recentServices: z.number().int().nonnegative(),
    recentQuotes: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  }),
});
const detailSchema = z.object({
  section: z.enum(['relationships', 'profile', 'services', 'quotes', 'pending']),
  items: z.array(z.unknown()),
  limit: z.number().int().positive(),
  hasMore: z.boolean(),
});
const suggestionSchema = z.object({
  id: z.string().uuid(),
  whatsappContactId: z.string().uuid(),
  registrationId: nullableUuid,
  serviceSessionId: nullableUuid,
  agentExecutionId: nullableUuid,
  profileKey: profileKeySchema,
  suggestedValue: z.string(),
  rationale: z.string().nullable(),
  origin: z.unknown(),
  status: z.enum(['pending', 'approved', 'ignored']),
  reviewedByUserId: nullableUuid,
  reviewedAt: isoDate.nullable(),
  reviewReason: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
const decisionSchema = z.object({
  suggestionId: z.string().uuid(),
  status: z.enum(['approved', 'ignored']),
  reviewedByUserId: z.string().uuid(),
  reviewedAt: isoDate,
  idempotent: z.boolean().optional(),
});
const apiErrorSchema = z.object({
  code: z.unknown().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
});

function codeFor(status: number): CustomerContextGatewayErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if ([400, 413, 422].includes(status)) return 'validation';
  return 'service-unavailable';
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new CustomerContextGatewayError(
      'invalid-response',
      'A Tenant API retornou contexto do cliente incompatível com o contrato.',
      'INVALID_API_RESPONSE',
    );
  }
  return parsed.data;
}

export class TenantApiCustomerContextGateway implements CustomerContextGateway {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 5_000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/u, '');
  }

  async getSummary(serviceSessionId: string) {
    return parse(
      summarySchema,
      await this.request(`/customer-context/sessions/${encodeURIComponent(serviceSessionId)}`),
    );
  }

  async getDetails(serviceSessionId: string, section: CustomerContextDetailSection, limit = 20) {
    const query = new URLSearchParams({ section, limit: String(limit) });
    const page = parse(
      detailSchema,
      await this.request(
        `/customer-context/sessions/${encodeURIComponent(serviceSessionId)}/details?${query.toString()}`,
      ),
    );
    return { ...page, items: page.items.map((item) => sanitizeCustomerContextValue(item)) };
  }

  async listSuggestions(input: Parameters<CustomerContextGateway['listSuggestions']>[0]) {
    const query = new URLSearchParams({
      serviceSessionId: input.serviceSessionId,
      limit: String(input.limit ?? 100),
    });
    if (input.status) query.set('status', input.status);
    return parse(
      z.array(suggestionSchema),
      await this.request(`/customer-context/profile-suggestions?${query.toString()}`),
    ).map((suggestion) => ({
      ...suggestion,
      origin: sanitizeCustomerContextValue(suggestion.origin),
    }));
  }

  async decideSuggestion(
    suggestionId: string,
    input: Parameters<CustomerContextGateway['decideSuggestion']>[1],
  ) {
    return parse(
      decisionSchema,
      await this.request(
        `/customer-context/profile-suggestions/${encodeURIComponent(suggestionId)}/decision`,
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
      throw new CustomerContextGatewayError(
        'service-unavailable',
        'Não foi possível conectar à Tenant API para consultar o contexto do cliente.',
        'CUSTOMER_CONTEXT_API_UNAVAILABLE',
      );
    }
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
      const raw = parsed.success ? parsed.data.message : undefined;
      const message = Array.isArray(raw) ? raw.join(' ') : raw;
      const rawCode = parsed.success ? parsed.data.code : undefined;
      throw new CustomerContextGatewayError(
        codeFor(response.status),
        message?.trim() || 'A Tenant API recusou a operação de contexto do cliente.',
        typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/u.test(rawCode)
          ? rawCode
          : `HTTP_${response.status}`,
      );
    }
    return response.json().catch(() => {
      throw new CustomerContextGatewayError(
        'invalid-response',
        'A Tenant API retornou uma resposta inválida para contexto do cliente.',
        'INVALID_API_RESPONSE',
      );
    });
  }
}
