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

import { RoutePlannerError, type RoutePlannerGateway } from '../application/route-planner-gateway';
import { createRoutePlannerGateway } from '../infrastructure/create-route-planner-gateway';

export async function executeAuthenticatedRoutePlannerMutation<T>(
  operation: (gateway: RoutePlannerGateway) => Promise<T>,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, storedTokens] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);
  if (session === null || !isSessionValid(session) || storedTokens === null) {
    throw new RoutePlannerError('unauthorized', 'Sua sessão expirou.');
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
        throw new RoutePlannerError('unauthorized', 'Sua sessão expirou. Entre novamente.');
      }
      throw new RoutePlannerError('service-unavailable', 'Não foi possível renovar a sessão.');
    }
  }
  if (shouldRefreshApiToken(tokens)) await refresh();
  try {
    return await operation(createRoutePlannerGateway(tokens.accessToken));
  } catch (error) {
    if (!(error instanceof RoutePlannerError) || error.code !== 'unauthorized') throw error;
  }
  await refresh();
  return operation(createRoutePlannerGateway(tokens.accessToken));
}
