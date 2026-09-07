import 'server-only';

import { z } from 'zod';

import {
  WhatsAppChannelGatewayError,
  type CreateWhatsAppChannelInput,
  type ExecuteWhatsAppChannelActionInput,
  type UpdateWhatsAppChannelInput,
  type WhatsAppChannelGateway,
  type WhatsAppChannelGatewayErrorCode,
} from '../application';
import {
  WHATSAPP_CHANNEL_CONNECTION_STATUSES,
  WHATSAPP_CHANNEL_ORGANIZATIONAL_STATUSES,
  WHATSAPP_CHANNEL_ROUTING_MODES,
  type WhatsAppChannelAction,
} from '../domain';

type Fetcher = typeof fetch;

const isoDateSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const channelSchema = z.object({
  agentsEnabled: z.boolean().optional().default(true),
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  phoneNumber: z.string().min(1),
  evolutionInstanceName: z.string().min(1),
  evolutionInstanceId: z.string().min(1).nullable(),
  departmentId: z.string().uuid().nullable(),
  routingMode: z.enum(WHATSAPP_CHANNEL_ROUTING_MODES),
  organizationalStatus: z.enum(WHATSAPP_CHANNEL_ORGANIZATIONAL_STATUSES),
  connectionStatus: z.enum(WHATSAPP_CHANNEL_CONNECTION_STATUSES),
  allowedAutomaticTargetDepartmentIds: z.array(z.string().uuid()),
  version: z.number().int().positive(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
const qrCodeSchema = z.object({
  code: z.string().nullable(),
  base64: z
    .string()
    .min(1)
    .refine(
      (value) => /^(?:data:image\/(?:png|jpeg|webp);base64,)?[A-Za-z0-9+/=\r\n]+$/u.test(value),
      'O QR code retornado usa um formato de imagem não permitido.',
    ),
});
const operationSchema = z.object({
  channel: channelSchema,
  qrCode: qrCodeSchema.nullable(),
  providerIssue: z.object({ reason: z.string().min(1), message: z.string().min(1) }).nullable(),
  infrastructureCleanupPending: z.boolean().optional().default(false),
});
const apiErrorSchema = z.object({
  code: z.unknown().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
  details: z
    .object({ currentVersion: z.number().int().positive().optional() })
    .passthrough()
    .optional(),
});

function errorCode(status: number): WhatsAppChannelGatewayErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 413 || status === 422) return 'validation';
  return 'service-unavailable';
}

function normalizePublicCode(value: unknown, status: number): string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/u.test(value)
    ? value
    : `HTTP_${status}`;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new WhatsAppChannelGatewayError(
      'invalid-response',
      'A Tenant API retornou canais WhatsApp incompatíveis com o contrato.',
      'INVALID_API_RESPONSE',
    );
  }
  return result.data;
}

export class TenantApiWhatsAppChannelGateway implements WhatsAppChannelGateway {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 5_000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/u, '');
  }

  async pairing(channelId: string) {
    return parse(
      operationSchema.omit({ infrastructureCleanupPending: true }).extend({
        connectionStatus: z.enum(WHATSAPP_CHANNEL_CONNECTION_STATUSES),
      }),
      await this.request(
        '/whatsapp/channels/' + encodeURIComponent(channelId) + '/pairing',
        {},
        20_000,
      ),
    );
  }

  async listDepartments() {
    return parse(
      z.array(z.object({ id: z.string().uuid(), name: z.string().min(1) })),
      await this.request('/whatsapp/channels/departments'),
    );
  }

  async list() {
    return parse(z.array(channelSchema), await this.request('/whatsapp/channels'));
  }

  async get(channelId: string) {
    return parse(
      channelSchema,
      await this.request(`/whatsapp/channels/${encodeURIComponent(channelId)}`),
    );
  }

  async create(input: CreateWhatsAppChannelInput) {
    return parse(
      operationSchema,
      await this.request('/whatsapp/channels', { method: 'POST', body: input }),
    );
  }

  async update(channelId: string, input: UpdateWhatsAppChannelInput) {
    return parse(
      channelSchema,
      await this.request(`/whatsapp/channels/${encodeURIComponent(channelId)}`, {
        method: 'PATCH',
        body: input,
      }),
    );
  }

  async executeAction(
    channelId: string,
    action: WhatsAppChannelAction,
    input: ExecuteWhatsAppChannelActionInput,
  ) {
    return parse(
      operationSchema,
      await this.request(`/whatsapp/channels/${encodeURIComponent(channelId)}/actions/${action}`, {
        method: 'POST',
        body: input,
      }),
    );
  }

  private async request(
    path: string,
    input: { readonly method?: string; readonly body?: unknown } = {},
    timeoutMs = this.timeoutMs,
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
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new WhatsAppChannelGatewayError(
        'service-unavailable',
        'Não foi possível conectar à Tenant API para gerenciar os canais.',
        'CHANNEL_API_UNAVAILABLE',
      );
    }

    if (!response.ok) {
      const value = await response.json().catch(() => null);
      const parsed = apiErrorSchema.safeParse(value);
      const rawMessage = parsed.success ? parsed.data.message : undefined;
      const message = Array.isArray(rawMessage) ? rawMessage.join(' ') : rawMessage;
      throw new WhatsAppChannelGatewayError(
        errorCode(response.status),
        message?.trim() || 'A Tenant API recusou a operação do canal.',
        normalizePublicCode(parsed.success ? parsed.data.code : undefined, response.status),
        parsed.success ? (parsed.data.details?.currentVersion ?? null) : null,
      );
    }

    return response.json().catch(() => {
      throw new WhatsAppChannelGatewayError(
        'invalid-response',
        'A Tenant API retornou uma resposta inválida para o canal.',
        'INVALID_API_RESPONSE',
      );
    });
  }
}
