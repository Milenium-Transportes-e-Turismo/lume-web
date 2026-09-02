import 'server-only';

import { z } from 'zod';

import {
  RegistrationDataReviewGatewayError,
  type RegistrationDataReviewGateway,
  type RegistrationDataReviewGatewayErrorCode,
} from '../application';
import { REGISTRATION_DATA_REVIEW_STATUSES, type RegistrationDataReviewStatus } from '../domain';

type Fetcher = typeof fetch;
const isoDate = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const reviewSchema = z.object({
  id: z.string().uuid(),
  registrationId: z.string().uuid(),
  whatsappContactId: z.string().uuid().nullable(),
  serviceSessionId: z.string().uuid().nullable(),
  agentExecutionId: z.string().uuid().nullable(),
  field: z.string().min(1),
  currentValue: z.unknown(),
  proposedValue: z.unknown(),
  source: z.enum(['whatsapp', 'internal', 'automation']),
  status: z.enum(REGISTRATION_DATA_REVIEW_STATUSES),
  reviewedByUserId: z.string().uuid().nullable(),
  reviewedAt: isoDate.nullable(),
  reviewReason: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
const decisionSchema = z.object({
  reviewId: z.string().uuid(),
  registrationId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  reviewedByUserId: z.string().uuid(),
  reviewedAt: isoDate,
  idempotent: z.boolean().optional(),
});
const apiErrorSchema = z.object({
  code: z.unknown().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
});

function errorCode(status: number): RegistrationDataReviewGatewayErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if ([400, 422].includes(status)) return 'validation';
  return 'service-unavailable';
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new RegistrationDataReviewGatewayError(
      'invalid-response',
      'A Tenant API retornou revisões cadastrais incompatíveis com o contrato.',
      'INVALID_API_RESPONSE',
    );
  }
  return parsed.data;
}

export class TenantApiRegistrationDataReviewGateway implements RegistrationDataReviewGateway {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 5_000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/u, '');
  }

  async list(status?: RegistrationDataReviewStatus) {
    const path = status
      ? `/registration-data-reviews?status=${encodeURIComponent(status)}`
      : '/registration-data-reviews';
    return parse(z.array(reviewSchema), await this.request(path));
  }

  async decide(reviewId: string, input: Parameters<RegistrationDataReviewGateway['decide']>[1]) {
    return parse(
      decisionSchema,
      await this.request(`/registration-data-reviews/${encodeURIComponent(reviewId)}/decision`, {
        method: 'POST',
        body: input,
      }),
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
      throw new RegistrationDataReviewGatewayError(
        'service-unavailable',
        'Não foi possível conectar à Tenant API para consultar as revisões.',
        'REGISTRATION_REVIEW_API_UNAVAILABLE',
      );
    }
    if (!response.ok) {
      const value = await response.json().catch(() => null);
      const parsed = apiErrorSchema.safeParse(value);
      const raw = parsed.success ? parsed.data.message : undefined;
      const message = Array.isArray(raw) ? raw.join(' ') : raw;
      const code = parsed.success ? parsed.data.code : undefined;
      throw new RegistrationDataReviewGatewayError(
        errorCode(response.status),
        message?.trim() || 'A Tenant API recusou a operação de revisão cadastral.',
        typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/u.test(code)
          ? code
          : `HTTP_${response.status}`,
      );
    }
    return response.json().catch(() => {
      throw new RegistrationDataReviewGatewayError(
        'invalid-response',
        'A Tenant API retornou uma resposta inválida para revisão cadastral.',
        'INVALID_API_RESPONSE',
      );
    });
  }
}
