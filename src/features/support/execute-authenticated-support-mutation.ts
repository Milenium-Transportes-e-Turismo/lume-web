import 'server-only';

import {
  AuthenticationGatewayError,
  shouldRefreshApiToken,
  type ApiAuthentication,
} from '@/features/auth/application';
import { getTenantApiConfig } from '@/env.server';
import { isSessionValid } from '@/features/auth/domain';
import {
  createCookieApiTokenStorage,
  createCookieSessionStorage,
  createTenantApiAuthenticationGateway,
} from '@/features/auth/infrastructure';

import {
  SupportGatewayError,
  TenantApiSupportGateway,
  type SupportGateway,
} from './support-gateway';

export async function executeAuthenticatedSupportMutation<T>(
  operation: (gateway: SupportGateway) => Promise<T>,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, storedTokens] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);
  if (session === null || !isSessionValid(session) || storedTokens === null) {
    await Promise.allSettled([sessionStorage.remove(), tokenStorage.remove()]);
    throw new SupportGatewayError('unauthorized', 'Sua sessão expirou. Entre novamente.');
  }

  let tokens = storedTokens;
  const createGateway = () => {
    const tenantApi = getTenantApiConfig();

    return new TenantApiSupportGateway(
      tenantApi.baseUrl,
      tokens.accessToken,
      fetch,
      tenantApi.timeoutMs,
    );
  };

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
      throw new SupportGatewayError(
        error instanceof AuthenticationGatewayError && error.code === 'invalid-response'
          ? 'invalid-response'
          : 'unauthorized',
        'Sua sessão expirou. Entre novamente.',
      );
    }
  }

  if (shouldRefreshApiToken(tokens)) await refreshAuthentication();

  try {
    return await operation(createGateway());
  } catch (error) {
    if (!(error instanceof SupportGatewayError) || error.code !== 'unauthorized') throw error;
  }

  await refreshAuthentication();
  return operation(createGateway());
}
