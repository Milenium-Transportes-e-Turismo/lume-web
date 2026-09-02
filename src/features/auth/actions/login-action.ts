'use server';

import { getServerEnv } from '@/env.server';

import {
  AuthenticationGatewayError,
  saveAuthenticatedSession,
  type ApiAuthenticationTokens,
  type ApiTokenStorage,
  type AuthenticationGateway,
  type PasswordSetupChallenge,
  type SessionStorage,
} from '../application';
import { createAuthenticatedSession, type AuthenticatedSession } from '../domain';
import {
  createCookieApiTokenStorage,
  createCookieSessionStorage,
  createTenantApiAuthenticationGateway,
} from '../infrastructure';
import { AUTH_FALLBACK_ERROR_CODES, type AuthFailureFeedback } from '../lib/auth-error-feedback';
import { loginSchema } from '../lib/login-schema';
import { passwordChangeActionSchema } from '../lib/password-change-schema';
import { findSimulatedUserByCredentials, type SimulatedUser } from '../simulation';

export type LoginActionFailure = AuthFailureFeedback & {
  readonly passwordSetupChallenge?: PasswordSetupChallenge;
};

export type LoginActionSuccess = {
  readonly success: true;
  readonly destination: '/dashboard' | '/documents';
};

export type LoginActionResult = LoginActionFailure | LoginActionSuccess;

const INVALID_CREDENTIALS_MESSAGE =
  'Usuário ou senha inválidos. Se o problema persistir, contate o administrador.';
const API_UNAVAILABLE_MESSAGE =
  'Não foi possível conectar ao serviço de autenticação. Tente novamente ou contate o administrador.';

function createSimulatedSession(user: SimulatedUser, rememberDevice: boolean) {
  const sessionId = crypto.randomUUID();

  return createAuthenticatedSession({
    sessionId,
    userId: user.id,
    name: user.name,
    type: 'employee',
    departments: user.departments,
    isActive: user.isActive,
    rememberDevice,
  });
}

export async function loginAction(input: unknown): Promise<LoginActionResult> {
  const validation = loginSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message ?? 'Informe dados de acesso válidos.',
      errorCode: AUTH_FALLBACK_ERROR_CODES.validation,
    };
  }

  const environment = getServerEnv();
  const simulationEnabled = environment.AUTH_SIMULATION_ENABLED;
  let session: AuthenticatedSession;
  let apiTokens: ApiAuthenticationTokens | null = null;
  let authenticationGateway: AuthenticationGateway | null = null;
  let sessionStorage: SessionStorage | null = null;
  let apiTokenStorage: ApiTokenStorage | null = null;

  if (simulationEnabled) {
    const simulatedUser = findSimulatedUserByCredentials(
      validation.data.identifier,
      validation.data.password,
    );

    if (simulatedUser === null || !simulatedUser.isActive) {
      return {
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE,
        errorCode: 'INVALID_CREDENTIALS',
      };
    }

    session = createSimulatedSession(simulatedUser, validation.data.remember);
  } else {
    try {
      authenticationGateway = createTenantApiAuthenticationGateway();
      const authentication = await authenticationGateway.authenticate(validation.data);

      session = authentication.session;
      apiTokens = authentication.tokens;
    } catch (error) {
      if (error instanceof AuthenticationGatewayError && error.code === 'invalid-credentials') {
        return {
          success: false,
          message: INVALID_CREDENTIALS_MESSAGE,
          errorCode: error.publicCode,
        };
      }

      if (
        error instanceof AuthenticationGatewayError &&
        [
          'account-password-setup-required',
          'account-inactive',
          'account-suspended',
          'account-unavailable',
        ].includes(error.code)
      ) {
        return {
          success: false,
          message: error.message,
          errorCode: error.publicCode,
          ...(error.passwordSetupChallenge
            ? { passwordSetupChallenge: error.passwordSetupChallenge }
            : {}),
        };
      }

      if (error instanceof AuthenticationGatewayError) {
        return {
          success: false,
          message:
            error.code === 'request-timeout'
              ? 'O serviço de autenticação demorou para responder. Tente novamente.'
              : API_UNAVAILABLE_MESSAGE,
          errorCode: error.publicCode,
        };
      }

      return {
        success: false,
        message: 'Não foi possível acessar sua conta. Tente novamente ou contate o administrador.',
        errorCode: AUTH_FALLBACK_ERROR_CODES.unexpected,
      };
    }
  }

  try {
    [sessionStorage, apiTokenStorage] = await Promise.all([
      createCookieSessionStorage(),
      createCookieApiTokenStorage(),
    ]);

    await saveAuthenticatedSession(sessionStorage, session);

    if (apiTokens === null) {
      await apiTokenStorage.remove();
    } else {
      await apiTokenStorage.save(apiTokens);
    }
  } catch {
    if (authenticationGateway !== null && apiTokens !== null) {
      try {
        await authenticationGateway.logout(apiTokens.refreshToken);
      } catch {
        // The local login still fails safely even if remote cleanup is unavailable.
      }
    }

    await Promise.allSettled([sessionStorage?.remove(), apiTokenStorage?.remove()]);

    return {
      success: false,
      message: 'Não foi possível iniciar sua sessão. Tente novamente.',
      errorCode: AUTH_FALLBACK_ERROR_CODES.sessionInitialization,
    };
  }

  return {
    success: true,
    destination:
      session.user.documentAccessMode === 'document-portal' ? '/documents' : '/dashboard',
  };
}

export async function completePasswordChangeAction(input: {
  readonly token: string;
  readonly newPassword: string;
}): Promise<LoginActionFailure | { readonly success: true; readonly message: string }> {
  const validation = passwordChangeActionSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues[0]?.message ?? 'Revise os dados da nova senha.',
      errorCode: AUTH_FALLBACK_ERROR_CODES.validation,
    };
  }

  try {
    await createTenantApiAuthenticationGateway().completePasswordChange(
      validation.data.token,
      validation.data.newPassword,
    );
    return {
      success: true,
      message: 'Senha criada com sucesso. Entre novamente com sua nova senha.',
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof AuthenticationGatewayError
          ? `${error.message} Solicite um novo link ou contate o administrador.`
          : 'Não foi possível criar a nova senha. Contate o administrador.',
      errorCode:
        error instanceof AuthenticationGatewayError
          ? error.publicCode
          : AUTH_FALLBACK_ERROR_CODES.unexpected,
    };
  }
}
