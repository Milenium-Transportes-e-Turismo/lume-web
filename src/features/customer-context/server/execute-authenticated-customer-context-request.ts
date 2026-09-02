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

import { CustomerContextGatewayError, type CustomerContextGateway } from '../application';
import { createCustomerContextGateway } from '../infrastructure';

async function executeAuthenticatedOperation<T>(
  operation: (gateway: CustomerContextGateway) => Promise<T>,
  canRefreshCookies: boolean,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, storedTokens] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);
  if (session === null || !isSessionValid(session) || storedTokens === null) {
    await Promise.allSettled([sessionStorage.remove(), tokenStorage.remove()]);
    throw new CustomerContextGatewayError(
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
      throw new CustomerContextGatewayError(
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
      throw new CustomerContextGatewayError(
        'unauthorized',
        'Sua sessão precisa ser renovada antes desta operação.',
        'SESSION_REFRESH_REQUIRED',
      );
    }
    await refresh();
  }

  try {
    return await operation(createCustomerContextGateway(tokens.accessToken));
  } catch (error) {
    if (
      !(error instanceof CustomerContextGatewayError) ||
      error.code !== 'unauthorized' ||
      !canRefreshCookies
    ) {
      throw error;
    }
  }
  await refresh();
  return operation(createCustomerContextGateway(tokens.accessToken));
}

export function executeAuthenticatedCustomerContextRequest<T>(
  operation: (gateway: CustomerContextGateway) => Promise<T>,
) {
  return executeAuthenticatedOperation(operation, false);
}

export function executeAuthenticatedCustomerContextMutation<T>(
  operation: (gateway: CustomerContextGateway) => Promise<T>,
) {
  return executeAuthenticatedOperation(operation, true);
}
