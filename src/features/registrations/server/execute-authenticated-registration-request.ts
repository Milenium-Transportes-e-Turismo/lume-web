import 'server-only';

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

import { RegistrationGatewayError, type RegistrationGateway } from '../application';
import { createRegistrationGateway } from '../infrastructure';

async function execute<T>(
  operation: (gateway: RegistrationGateway, accessToken: string) => Promise<T>,
  canRefreshCookies: boolean,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, storedTokens] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);
  if (session === null || !isSessionValid(session) || storedTokens === null) {
    throw new RegistrationGatewayError('unauthorized', 'Sua sessão expirou.');
  }
  let tokens = storedTokens;
  async function refresh(): Promise<ApiAuthentication> {
    try {
      const authentication = await createTenantApiAuthenticationGateway().refresh(
        tokens.refreshToken,
      );
      await Promise.all([
        sessionStorage.save(authentication.session),
        tokenStorage.save(authentication.tokens),
      ]);
      tokens = authentication.tokens;
      return authentication;
    } catch (error) {
      if (error instanceof AuthenticationGatewayError) {
        throw new RegistrationGatewayError('unauthorized', 'Sua sessão expirou. Entre novamente.');
      }
      throw new RegistrationGatewayError(
        'service-unavailable',
        'Não foi possível renovar a sessão.',
      );
    }
  }
  if (shouldRefreshApiToken(tokens)) {
    if (!canRefreshCookies) {
      throw new RegistrationGatewayError('unauthorized', 'Atualize a sessão antes desta operação.');
    }
    await refresh();
  }
  try {
    return await operation(createRegistrationGateway(tokens.accessToken), tokens.accessToken);
  } catch (error) {
    if (
      !(error instanceof RegistrationGatewayError) ||
      error.code !== 'unauthorized' ||
      !canRefreshCookies
    ) {
      throw error;
    }
  }
  await refresh();
  return operation(createRegistrationGateway(tokens.accessToken), tokens.accessToken);
}

export function executeAuthenticatedRegistrationRequest<T>(
  operation: (gateway: RegistrationGateway) => Promise<T>,
) {
  return execute((gateway) => operation(gateway), false);
}

export function executeAuthenticatedRegistrationMutation<T>(
  operation: (gateway: RegistrationGateway) => Promise<T>,
) {
  return execute((gateway) => operation(gateway), true);
}

export function executeAuthenticatedRegistrationTokenMutation<T>(
  operation: (accessToken: string) => Promise<T>,
) {
  return execute((_gateway, accessToken) => operation(accessToken), true);
}
