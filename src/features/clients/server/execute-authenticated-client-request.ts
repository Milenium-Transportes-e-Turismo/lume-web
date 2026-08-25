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

import { ClientError, type ClientGateway } from '../application/client-gateway';
import { createClientGateway } from '../infrastructure/create-client-gateway';

async function execute<T>(
  operation: (gateway: ClientGateway) => Promise<T>,
  canRefreshCookies: boolean,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, storedTokens] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);
  if (session === null || !isSessionValid(session) || storedTokens === null) {
    throw new ClientError('unauthorized', 'Sua sessão expirou.');
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
        throw new ClientError('unauthorized', 'Sua sessão expirou. Entre novamente.');
      }
      throw new ClientError('service-unavailable', 'Não foi possível renovar a sessão.');
    }
  }
  if (shouldRefreshApiToken(tokens)) {
    if (!canRefreshCookies) {
      throw new ClientError('unauthorized', 'Atualize a sessão antes desta operação.');
    }
    await refresh();
  }
  try {
    return await operation(createClientGateway(tokens.accessToken));
  } catch (error) {
    if (!(error instanceof ClientError) || error.code !== 'unauthorized' || !canRefreshCookies) {
      throw error;
    }
  }
  await refresh();
  return operation(createClientGateway(tokens.accessToken));
}

export function executeAuthenticatedClientRequest<T>(
  operation: (gateway: ClientGateway) => Promise<T>,
) {
  return execute(operation, false);
}

export function executeAuthenticatedClientMutation<T>(
  operation: (gateway: ClientGateway) => Promise<T>,
) {
  return execute(operation, true);
}
