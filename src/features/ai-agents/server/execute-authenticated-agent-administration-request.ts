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

import { AgentAdministrationError, type AgentAdministrationGateway } from '../application';
import { createAgentAdministrationGateway } from '../infrastructure';

async function executeAuthenticatedOperation<T>(
  operation: (gateway: AgentAdministrationGateway) => Promise<T>,
  canRefreshCookies: boolean,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, storedTokens] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);

  if (session === null || !isSessionValid(session) || storedTokens === null) {
    await Promise.allSettled([sessionStorage.remove(), tokenStorage.remove()]);
    throw new AgentAdministrationError(
      'unauthorized',
      'Sua sessão local expirou.',
      'SESSION_EXPIRED',
    );
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
      await Promise.allSettled([sessionStorage.remove(), tokenStorage.remove()]);
      throw new AgentAdministrationError(
        error instanceof AuthenticationGatewayError && error.code === 'invalid-response'
          ? 'invalid-response'
          : 'unauthorized',
        'Sua sessão local expirou. Entre novamente.',
        'SESSION_EXPIRED',
      );
    }
  }

  if (shouldRefreshApiToken(tokens)) {
    if (!canRefreshCookies) {
      throw new AgentAdministrationError(
        'unauthorized',
        'Sua sessão precisa ser renovada antes desta operação.',
        'SESSION_REFRESH_REQUIRED',
      );
    }
    await refresh();
  }

  try {
    return await operation(createAgentAdministrationGateway(tokens.accessToken));
  } catch (error) {
    if (
      !(error instanceof AgentAdministrationError) ||
      error.code !== 'unauthorized' ||
      !canRefreshCookies
    ) {
      throw error;
    }
  }

  await refresh();
  return operation(createAgentAdministrationGateway(tokens.accessToken));
}

export function executeAuthenticatedAgentAdministrationRequest<T>(
  operation: (gateway: AgentAdministrationGateway) => Promise<T>,
) {
  return executeAuthenticatedOperation(operation, false);
}

export function executeAuthenticatedAgentAdministrationMutation<T>(
  operation: (gateway: AgentAdministrationGateway) => Promise<T>,
) {
  return executeAuthenticatedOperation(operation, true);
}
