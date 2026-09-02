import 'server-only';

import { getServerEnv } from '@/env.server';
import {
  AuthenticationGatewayError,
  shouldRefreshApiToken,
  type ApiAuthentication,
} from '@/features/auth/application';
import { isSessionValid } from '@/features/auth/domain';
import {
  createCookieApiTokenStorage,
  createCookieSessionStorage,
  createTenantApiAuthenticationGateway,
} from '@/features/auth/infrastructure';

import { TenantAdministrationError, type TenantAdministrationGateway } from '../application';
import { createTenantAdministrationGateway } from '../infrastructure';

async function executeAuthenticatedTenantOperation<T>(
  operation: (gateway: TenantAdministrationGateway) => Promise<T>,
  canRefreshCookies: boolean,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, storedTokens] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);

  if (
    getServerEnv().AUTH_SIMULATION_ENABLED &&
    session !== null &&
    isSessionValid(session) &&
    storedTokens === null
  ) {
    throw new TenantAdministrationError(
      'service-unavailable',
      'A administração da Tenant API não está disponível no modo simulado.',
    );
  }

  if (session === null || !isSessionValid(session) || storedTokens === null) {
    await Promise.allSettled([sessionStorage.remove(), tokenStorage.remove()]);
    throw new TenantAdministrationError('unauthorized', 'Sua sessão local expirou.');
  }

  let tokens = storedTokens;

  async function refreshAuthentication(): Promise<ApiAuthentication> {
    try {
      const refreshed = await createTenantApiAuthenticationGateway().refresh(tokens.refreshToken);
      await Promise.all([
        sessionStorage.save(refreshed.session),
        tokenStorage.save(refreshed.tokens),
      ]);
      tokens = refreshed.tokens;
      return refreshed;
    } catch (error) {
      await Promise.allSettled([sessionStorage.remove(), tokenStorage.remove()]);

      if (error instanceof AuthenticationGatewayError) {
        throw new TenantAdministrationError(
          error.code === 'invalid-response' ? 'invalid-response' : 'unauthorized',
          'Sua sessão local expirou. Entre novamente.',
        );
      }

      throw new TenantAdministrationError(
        'service-unavailable',
        'Não foi possível renovar a sessão local.',
      );
    }
  }

  if (shouldRefreshApiToken(tokens)) {
    if (!canRefreshCookies) {
      throw new TenantAdministrationError(
        'unauthorized',
        'Sua sessão precisa ser renovada antes desta operação.',
      );
    }

    await refreshAuthentication();
  }

  try {
    return await operation(createTenantAdministrationGateway(tokens.accessToken));
  } catch (error) {
    if (!(error instanceof TenantAdministrationError) || error.code !== 'unauthorized') {
      throw error;
    }

    if (!canRefreshCookies) {
      throw error;
    }
  }

  await refreshAuthentication();
  return operation(createTenantAdministrationGateway(tokens.accessToken));
}

export function executeAuthenticatedTenantRequest<T>(
  operation: (gateway: TenantAdministrationGateway) => Promise<T>,
): Promise<T> {
  return executeAuthenticatedTenantOperation(operation, false);
}

export function executeAuthenticatedTenantMutation<T>(
  operation: (gateway: TenantAdministrationGateway) => Promise<T>,
): Promise<T> {
  return executeAuthenticatedTenantOperation(operation, true);
}
