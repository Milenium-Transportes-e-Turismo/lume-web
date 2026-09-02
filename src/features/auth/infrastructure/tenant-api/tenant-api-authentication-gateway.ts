import { z } from 'zod';

import { DEFAULT_TENANT_API_TIMEOUT_MS } from '@/env';

export { resolveTenantApiBaseUrl, resolveTenantApiTimeout } from '@/env';

import {
  AuthenticationGatewayError,
  type ApiAuthentication,
  type AuthenticationResult,
  type AuthenticationCredentials,
  type AuthenticationGateway,
  type PasswordSetupChallenge,
} from '../../application';
import { AUTHENTICATED_SESSION_VERSION, type Permission, type User } from '../../domain';
import { normalizePublicErrorCode } from '../../lib/auth-error-feedback';

type Fetcher = typeof fetch;

export interface TenantApiAuthenticationGatewayOptions {
  readonly baseUrl: string;
  readonly fetcher?: Fetcher;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

const isoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Data inválida.',
});

const permissionSchema = z.string().refine((value) => /^[a-z0-9-]+:[a-z0-9-]+$/.test(value), {
  message: 'Permissão inválida.',
});

const apiUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['employee', 'candidate', 'client']),
  departments: z.array(z.string().min(1)),
  permissions: z.array(permissionSchema),
  clientCategory: z
    .enum(['legal-entity', 'individual', 'continuous-charter', 'eventual-charter'])
    .nullable(),
  routingCompanyId: z.string().uuid().nullable().optional(),
  isActive: z.boolean(),
  isAdministrator: z.boolean().optional(),
  documentAccessMode: z.enum(['standard', 'document-portal', 'client']).optional(),
});

const apiAuthenticationSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(40),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
  session: z.object({
    version: z.literal(AUTHENTICATED_SESSION_VERSION),
    id: z.string().min(1),
    user: apiUserSchema,
    issuedAt: isoDateSchema,
    expiresAt: isoDateSchema,
    rememberDevice: z.boolean(),
  }),
});
const apiCurrentIdentitySchema = z.object({
  companyId: z.string().min(1),
  user: apiUserSchema,
});
const accountStateErrorSchema = z.object({
  code: z.enum(['ACCOUNT_PASSWORD_SETUP_REQUIRED', 'ACCOUNT_INACTIVE', 'ACCOUNT_SUSPENDED']),
});
const apiErrorSchema = z.object({
  code: z.string().optional(),
  message: z.unknown().optional(),
  details: z.unknown().optional(),
});
const passwordSetupChallengeSchema = z.object({
  challengeToken: z.string().min(1),
  expiresAt: isoDateSchema,
  reason: z.literal('first-access'),
});

interface ApiErrorResponse {
  readonly code: string;
  readonly message?: string;
  readonly details?: unknown;
}

const accountStateByApiCode = {
  ACCOUNT_PASSWORD_SETUP_REQUIRED: {
    code: 'account-password-setup-required',
    message:
      'A senha inicial não pode ser usada para entrar. Use “Esqueci minha senha” ou contate o administrador.',
  },
  ACCOUNT_INACTIVE: {
    code: 'account-inactive',
    message: 'Este acesso está desativado. Contate o administrador.',
  },
  ACCOUNT_SUSPENDED: {
    code: 'account-suspended',
    message: 'Este acesso está suspenso. Contate o administrador.',
  },
} as const;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function createRequestSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function fallbackPublicCodeForStatus(status: number): string {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 423) return 'ACCOUNT_SUSPENDED';
  if (status === 429) return 'TOO_MANY_REQUESTS';
  if (status >= 500) return 'INTERNAL_ERROR';
  return `HTTP_ERROR_${status}`;
}

async function readApiError(response: Response): Promise<ApiErrorResponse> {
  const fallbackCode = fallbackPublicCodeForStatus(response.status);

  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    if (!parsed.success) return { code: fallbackCode };

    return {
      code: normalizePublicErrorCode(parsed.data.code, fallbackCode),
      message:
        typeof parsed.data.message === 'string' && parsed.data.message.trim() !== ''
          ? parsed.data.message
          : undefined,
      details: parsed.data.details,
    };
  } catch {
    return { code: fallbackCode };
  }
}

function isRequestTimeout(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

function mapApiUser(user: z.infer<typeof apiUserSchema>): User {
  if (user.type === 'client' && user.clientCategory !== null) {
    return {
      id: user.id,
      name: user.name,
      type: 'client',
      departments: user.departments,
      permissions: user.permissions as Permission[],
      clientCategory: user.clientCategory,
      routingCompanyId: user.routingCompanyId ?? null,
      isActive: user.isActive,
      ...(user.isAdministrator === undefined ? {} : { isAdministrator: user.isAdministrator }),
      documentAccessMode: 'client',
    };
  }

  return {
    id: user.id,
    name: user.name,
    type: 'employee',
    departments: user.departments,
    permissions: user.permissions as Permission[],
    clientCategory: null,
    isActive: user.isActive,
    ...(user.isAdministrator === undefined ? {} : { isAdministrator: user.isAdministrator }),
    ...(user.documentAccessMode === undefined
      ? {}
      : { documentAccessMode: user.documentAccessMode }),
  };
}

export class TenantApiAuthenticationGateway implements AuthenticationGateway {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(options: TenantApiAuthenticationGatewayOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TENANT_API_TIMEOUT_MS;
  }

  async authenticate(credentials: AuthenticationCredentials): Promise<AuthenticationResult> {
    return this.parseAuthentication(
      await this.requestAuthenticationBody('/auth/login', credentials, 'invalid-credentials'),
    );
  }

  async getCurrentIdentity(accessToken: string): Promise<User> {
    if (accessToken.trim() === '') {
      throw new AuthenticationGatewayError(
        'invalid-access-token',
        'O token de acesso não é válido.',
      );
    }

    const response = await this.request('/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      const apiError = await readApiError(response);
      throw new AuthenticationGatewayError(
        'invalid-access-token',
        'A identidade autenticada não está mais disponível.',
        apiError.code,
      );
    }

    if (!response.ok) {
      const apiError = await readApiError(response);
      throw new AuthenticationGatewayError(
        'service-unavailable',
        `A API respondeu com o status ${response.status}.`,
        apiError.code,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new AuthenticationGatewayError(
        'invalid-response',
        'A API retornou uma identidade que não é JSON.',
      );
    }

    const parsed = apiCurrentIdentitySchema.safeParse(body);
    if (!parsed.success || !parsed.data.user.isActive) {
      throw new AuthenticationGatewayError(
        'invalid-response',
        'A API retornou uma identidade incompatível com o frontend.',
      );
    }

    return mapApiUser(parsed.data.user);
  }

  async requestPasswordReset(identifier: string): Promise<void> {
    const response = await this.request('/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });

    if (response.ok) return;

    const apiError = await readApiError(response);
    const isNonEnumerableClientResponse =
      response.status >= 401 && response.status < 500 && response.status !== 429;
    if (isNonEnumerableClientResponse) return;

    if (response.status === 400) {
      throw new AuthenticationGatewayError(
        'validation-error',
        'Revise os dados informados para solicitar a recuperação.',
        apiError.code,
      );
    }

    throw new AuthenticationGatewayError(
      'service-unavailable',
      response.status === 429
        ? 'Muitas solicitações foram realizadas. Aguarde alguns instantes e tente novamente.'
        : 'A API não conseguiu registrar a solicitação de recuperação.',
      apiError.code,
    );
  }

  refresh(refreshToken: string): Promise<ApiAuthentication> {
    return this.requestAuthentication('/auth/refresh', { refreshToken }, 'invalid-refresh-token');
  }

  async logout(refreshToken: string): Promise<void> {
    const response = await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (response.status === 401) {
      return;
    }

    if (!response.ok) {
      throw new AuthenticationGatewayError(
        'service-unavailable',
        'A API recusou o encerramento da sessão.',
      );
    }
  }

  async completePasswordChange(token: string, newPassword: string): Promise<void> {
    const response = await this.request('/auth/password/change', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
    if (response.ok) return;

    const apiError = await readApiError(response);
    const message = apiError.message ?? 'Não foi possível criar a nova senha.';
    if (response.status === 400) {
      throw new AuthenticationGatewayError('validation-error', message, apiError.code);
    }
    if (response.status === 401) {
      throw new AuthenticationGatewayError('invalid-password-change-token', message, apiError.code);
    }

    throw new AuthenticationGatewayError(
      'service-unavailable',
      response.status === 429
        ? 'Muitas solicitações foram realizadas. Aguarde alguns instantes e tente novamente.'
        : message,
      apiError.code,
    );
  }

  private async requestAuthentication(
    path: string,
    body: AuthenticationCredentials | { readonly refreshToken: string },
    unauthorizedCode: 'invalid-credentials' | 'invalid-refresh-token',
  ): Promise<ApiAuthentication> {
    return this.parseAuthentication(
      await this.requestAuthenticationBody(path, body, unauthorizedCode),
    );
  }

  private async requestAuthenticationBody(
    path: string,
    body: AuthenticationCredentials | { readonly refreshToken: string },
    unauthorizedCode: 'invalid-credentials' | 'invalid-refresh-token',
  ): Promise<unknown> {
    const response = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const apiError = await readApiError(response);

      if (response.status === 401) {
        throw new AuthenticationGatewayError(
          unauthorizedCode,
          'A API rejeitou as credenciais apresentadas.',
          apiError.code,
        );
      }

      if (
        unauthorizedCode === 'invalid-credentials' &&
        (response.status === 403 || response.status === 423)
      ) {
        const accountStateResult = accountStateErrorSchema.safeParse(apiError);
        if (accountStateResult.success) {
          const accountState = accountStateByApiCode[accountStateResult.data.code];
          let passwordSetupChallenge: PasswordSetupChallenge | undefined;

          if (accountStateResult.data.code === 'ACCOUNT_PASSWORD_SETUP_REQUIRED') {
            const challenge = passwordSetupChallengeSchema.safeParse(apiError.details);
            if (!challenge.success) {
              throw new AuthenticationGatewayError(
                'invalid-response',
                'A API retornou um desafio de criação de senha incompatível com o frontend.',
              );
            }
            passwordSetupChallenge = {
              token: challenge.data.challengeToken,
              expiresAt: challenge.data.expiresAt,
              reason: challenge.data.reason,
            };
          }

          throw new AuthenticationGatewayError(
            accountState.code,
            accountState.message,
            apiError.code,
            passwordSetupChallenge,
          );
        }

        throw new AuthenticationGatewayError(
          'account-unavailable',
          'Esta conta não está disponível para acesso. Contate o administrador.',
          apiError.code,
        );
      }

      if (response.status === 400) {
        throw new AuthenticationGatewayError(
          'validation-error',
          'Revise os dados informados para entrar.',
          apiError.code,
        );
      }

      throw new AuthenticationGatewayError(
        'service-unavailable',
        response.status === 429
          ? 'Muitas tentativas foram realizadas. Aguarde alguns instantes e tente novamente.'
          : `A API respondeu com o status ${response.status}.`,
        apiError.code,
      );
    }

    let bodyValue: unknown;

    try {
      bodyValue = await response.json();
    } catch {
      throw new AuthenticationGatewayError(
        'invalid-response',
        'A API retornou uma resposta que não é JSON.',
      );
    }

    return bodyValue;
  }

  private parseAuthentication(bodyValue: unknown): ApiAuthentication {
    const parsedResponse = apiAuthenticationSchema.safeParse(bodyValue);

    if (!parsedResponse.success) {
      throw new AuthenticationGatewayError(
        'invalid-response',
        'A API retornou uma sessão incompatível com o frontend.',
      );
    }

    const authenticatedAt = this.now();
    const accessTokenExpiresAt = new Date(
      authenticatedAt.getTime() + parsedResponse.data.expiresIn * 1_000,
    ).toISOString();

    return {
      session: {
        version: parsedResponse.data.session.version,
        id: parsedResponse.data.session.id,
        user: mapApiUser(parsedResponse.data.session.user),
        issuedAt: parsedResponse.data.session.issuedAt,
        expiresAt: parsedResponse.data.session.expiresAt,
        rememberDevice: parsedResponse.data.session.rememberDevice,
      },
      tokens: {
        accessToken: parsedResponse.data.accessToken,
        refreshToken: parsedResponse.data.refreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt: parsedResponse.data.session.expiresAt,
      },
    };
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: createRequestSignal(this.timeoutMs),
      });
    } catch (error) {
      if (isRequestTimeout(error)) {
        throw new AuthenticationGatewayError(
          'request-timeout',
          'O serviço de autenticação excedeu o tempo limite de resposta.',
        );
      }

      throw new AuthenticationGatewayError(
        'service-unavailable',
        'Não foi possível estabelecer comunicação com a API.',
      );
    }
  }
}
