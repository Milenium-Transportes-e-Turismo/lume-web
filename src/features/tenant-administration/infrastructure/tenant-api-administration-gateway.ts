import { z } from 'zod';

import {
  TenantAdministrationError,
  type TenantAdministrationErrorCode,
  type TenantAdministrationGateway,
} from '../application';
import type { CreateTenantUserInput, UpdateTenantUserInput } from '../domain';

type Fetcher = typeof fetch;

const isoDate = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const userSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    username: z.string().min(1),
    email: z.string().email(),
    cpf: z.string().nullable(),
    type: z.enum(['employee', 'candidate', 'client']),
    routingCompanyId: z
      .string()
      .uuid()
      .nullish()
      .transform((value) => value ?? null),
    departments: z.array(z.string()),
    isAdministrator: z.boolean(),
    documentAccessMode: z.enum(['standard', 'document-portal', 'client']).optional(),
    jobTitle: z.string().nullable().default(null),
    maritalStatus: z
      .enum(['single', 'married', 'stable-union', 'divorced', 'widowed', 'not-informed'])
      .nullable()
      .default(null),
    militaryDocumentStatus: z
      .enum(['applicable', 'not-applicable', 'pending-confirmation'])
      .default('pending-confirmation'),
    dependents: z
      .array(
        z.object({
          name: z.string(),
          birthDate: z.string(),
          relationship: z.string().optional(),
        }),
      )
      .default([]),
    permissionCodes: z.array(z.string()).optional(),
    permissions: z.array(z.string()),
    clientCategory: z.enum(['legal-entity', 'individual']).nullable(),
    isActive: z.boolean(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
    suspendedUntil: isoDate.nullable().optional(),
    suspensionReason: z.string().nullable().optional(),
    mustChangePassword: z.boolean().default(false),
    hasProfilePicture: z.boolean().default(false),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .transform((user) => ({
    ...user,
    permissionCodes: user.permissionCodes ?? [],
    status: user.status ?? (user.isActive ? ('active' as const) : ('inactive' as const)),
    suspendedUntil: user.suspendedUntil ?? null,
    suspensionReason: user.suspensionReason ?? null,
  }));
const userListSchema = z.object({
  data: z.array(userSchema),
  meta: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
const deleteUserResultSchema = z.object({ deleted: z.literal(true) });
const apiUsageSummarySchema = z.object({
  period: z.object({ from: isoDate, to: isoDate }),
  totals: z.object({
    requests: z.number().int().nonnegative(),
    requestBytes: z.number().int().nonnegative(),
    responseBytes: z.number().int().nonnegative(),
    averageDurationMs: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    activeUsers: z.number().int().nonnegative(),
  }),
  daily: z.array(
    z.object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      requests: z.number().int().nonnegative(),
      bytes: z.number().int().nonnegative(),
    }),
  ),
  users: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      email: z.string().email().nullable(),
      requests: z.number().int().nonnegative(),
      bytes: z.number().int().nonnegative(),
      averageDurationMs: z.number().int().nonnegative(),
    }),
  ),
  actions: z.array(
    z.object({
      action: z.string().min(1),
      requests: z.number().int().nonnegative(),
      bytes: z.number().int().nonnegative(),
      averageDurationMs: z.number().int().nonnegative(),
    }),
  ),
});
const apiUsageRequestListSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      action: z.string().min(1),
      result: z.string().min(1),
      statusCode: z.number().int(),
      requestBytes: z.number().int().nonnegative(),
      responseBytes: z.number().int().nonnegative(),
      durationMs: z.number().int().nonnegative(),
      createdAt: isoDate,
      user: z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        email: z.string().email().nullable(),
      }),
    }),
  ),
  meta: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
const permissionCatalogSchema = z.object({
  resources: z.array(z.string()),
  actions: z.array(z.string()),
  actionsByResource: z.record(z.string(), z.array(z.string())),
  permissions: z.array(z.string()),
  permissionsByDepartment: z.record(z.string(), z.array(z.string())).default({}),
  implicitPermissions: z.array(z.string()).default([]),
});
const notificationSummarySchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string().min(1),
      department: z.string().min(1),
      title: z.string().min(1),
      description: z.string(),
      href: z.string().startsWith('/'),
      count: z.number().int().positive(),
      unreadCount: z.number().int().nonnegative(),
      read: z.boolean(),
    }),
  ),
  total: z.number().int().nonnegative(),
  unreadTotal: z.number().int().nonnegative(),
});
const notificationReadReceiptSchema = z.object({
  notificationId: z.string().min(1),
  pendingTotal: z.number().int().nonnegative(),
  unreadTotal: z.number().int().nonnegative(),
  markedRead: z.number().int().nonnegative(),
  readAt: isoDate,
});
const licenseStatusSchema = z.object({
  state: z.enum(['active', 'grace']),
  tenantId: z.string().min(1),
  installationId: z.string().min(1),
  plan: z.string().min(1),
  features: z.array(z.string()),
  expiresAt: isoDate,
  graceUntil: isoDate,
});
const profileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  profilePictureDataUrl: z.string().startsWith('data:image/').nullable(),
});
const apiErrorSchema = z.object({
  code: z.unknown().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
});
const publicErrorCodePattern = /^[A-Z][A-Z0-9_]{1,79}$/;

function statusCodeToError(status: number): TenantAdministrationErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 413 || status === 422) return 'validation';
  return 'service-unavailable';
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function parseApiResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new TenantAdministrationError(
      'invalid-response',
      'A API local retornou uma resposta incompatível com o frontend.',
    );
  }

  return parsed.data;
}

function fallbackPublicCodeForStatus(status: number): string {
  return `HTTP_${status}`;
}

function normalizePublicErrorCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && publicErrorCodePattern.test(value) ? value : fallback;
}

function canExposeApiErrorMessage(status: number): boolean {
  return [400, 401, 403, 404, 409, 422, 423, 429].includes(status);
}

async function readApiError(response: Response): Promise<{
  readonly message: string | null;
  readonly publicCode: string;
}> {
  const fallback = fallbackPublicCodeForStatus(response.status);

  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    if (!parsed.success) return { message: null, publicCode: fallback };

    const rawMessage = parsed.data.message;
    const message =
      rawMessage === undefined
        ? null
        : (Array.isArray(rawMessage) ? rawMessage.join(' ') : rawMessage).trim() || null;

    return {
      message,
      publicCode: normalizePublicErrorCode(parsed.data.code, fallback),
    };
  } catch {
    return { message: null, publicCode: fallback };
  }
}

function searchParams(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export class TenantApiAdministrationGateway implements TenantAdministrationGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 5_000,
  ) {}

  async listUsers(
    query: {
      page?: number;
      pageSize?: number;
      search?: string;
      department?: string;
      permission?: string;
      status?: 'active' | 'inactive' | 'suspended';
    } = {},
  ) {
    return parseApiResponse(
      userListSchema,
      await this.request(
        `/users${searchParams({
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
          search: query.search,
          department: query.department,
          permission: query.permission,
          status: query.status,
        })}`,
      ),
    );
  }

  async getUser(userId: string) {
    return parseApiResponse(userSchema, await this.request(`/users/${encodeURIComponent(userId)}`));
  }

  async createUser(input: CreateTenantUserInput) {
    return parseApiResponse(
      userSchema,
      await this.request('/users', { method: 'POST', body: input }),
    );
  }

  async updateUser(userId: string, input: UpdateTenantUserInput) {
    return parseApiResponse(
      userSchema,
      await this.request(`/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: input,
      }),
    );
  }

  async updateUserStatus(
    userId: string,
    input: {
      status: 'active' | 'inactive' | 'suspended';
      suspendedUntil?: string;
      suspensionReason?: string;
    },
  ) {
    return parseApiResponse(
      userSchema,
      await this.request(`/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        body: input,
      }),
    );
  }

  async deleteUser(userId: string, password: string) {
    return parseApiResponse(
      deleteUserResultSchema,
      await this.request(`/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        body: { password },
      }),
    );
  }

  async requestPasswordReset(userId: string) {
    return parseApiResponse(
      z.object({
        requested: z.literal(true),
        recipient: z.string().email(),
        expiresAt: isoDate,
      }),
      await this.request(`/users/${encodeURIComponent(userId)}/password-reset`, {
        method: 'POST',
      }),
    );
  }

  async listAuditOperations(query: {
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    userId?: string;
  }) {
    return parseApiResponse(
      z.object({
        data: z.array(
          z.object({
            id: z.string(),
            actor: z.string(),
            actorId: z.string().nullable(),
            createdAt: isoDate,
            module: z.string(),
            action: z.string(),
            result: z.string(),
            target: z.string(),
            targetId: z.string(),
            changes: z.array(z.string()),
            events: z.array(
              z.object({
                id: z.string(),
                code: z.string(),
                source: z.string(),
                targetType: z.string(),
                targetId: z.string(),
              }),
            ),
          }),
        ),
        meta: z.object({
          page: z.number(),
          pageSize: z.number(),
          total: z.number(),
          totalPages: z.number(),
        }),
      }),
      await this.request(
        '/administration/usage/operations' +
          searchParams({ ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 25 }),
      ),
    );
  }

  async getApiUsageSummary(query: { from?: string; to?: string } = {}) {
    return parseApiResponse(
      apiUsageSummarySchema,
      await this.request(
        `/administration/usage/summary${searchParams({ from: query.from, to: query.to })}`,
      ),
    );
  }

  async listApiUsageRequests(
    query: {
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
      userId?: string;
      status?: 'success' | 'client-error' | 'server-error';
    } = {},
  ) {
    return parseApiResponse(
      apiUsageRequestListSchema,
      await this.request(
        `/administration/usage/requests${searchParams({
          from: query.from,
          to: query.to,
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 25,
          userId: query.userId,
          status: query.status,
        })}`,
      ),
    );
  }

  async listPermissions() {
    return parseApiResponse(permissionCatalogSchema, await this.request('/permissions'));
  }

  async getNotifications() {
    return parseApiResponse(notificationSummarySchema, await this.request('/notifications'));
  }

  async markNotificationRead(notificationId: string) {
    return parseApiResponse(
      notificationReadReceiptSchema,
      await this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'POST',
      }),
    );
  }

  async getLicenseStatus() {
    return parseApiResponse(licenseStatusSchema, await this.request('/license/status'));
  }

  async getProfile() {
    return parseApiResponse(profileSchema, await this.request('/users/me/profile'));
  }

  async updateProfilePicture(dataUrl: string | null) {
    return parseApiResponse(
      profileSchema,
      await this.request('/users/me/profile-picture', {
        method: 'PUT',
        body: { dataUrl },
      }),
    );
  }

  async changeOwnPassword(input: {
    readonly currentPassword: string;
    readonly newPassword: string;
  }) {
    return parseApiResponse(
      z.object({
        changed: z.literal(true),
        sessionRevoked: z.literal(true),
      }),
      await this.request('/users/me/password', {
        method: 'PATCH',
        body: input,
      }),
    );
  }

  private async request(
    path: string,
    input: { method?: string; body?: unknown } = {},
    emptyResponse = false,
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await this.fetcher(`${normalizeBaseUrl(this.baseUrl)}${path}`, {
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
      throw new TenantAdministrationError(
        'service-unavailable',
        'Não foi possível conectar à API local.',
      );
    }

    if (!response.ok) {
      const apiError = await readApiError(response);

      if (response.status === 413) {
        throw new TenantAdministrationError(
          'validation',
          'A imagem excedeu o limite aceito pelo servidor. Selecione um arquivo de até 512 KB.',
          apiError.publicCode,
        );
      }

      throw new TenantAdministrationError(
        statusCodeToError(response.status),
        (canExposeApiErrorMessage(response.status) ? apiError.message : null) ??
          `A API respondeu com o status ${response.status}.`,
        apiError.publicCode,
      );
    }

    if (emptyResponse || response.status === 204) return null;

    try {
      return await response.json();
    } catch {
      throw new TenantAdministrationError(
        'invalid-response',
        'A API local retornou uma resposta inválida.',
      );
    }
  }
}
