import 'server-only';
import { AuthenticationGatewayError, shouldRefreshApiToken } from '@/features/auth/application';
import { isSessionValid } from '@/features/auth/domain';
import {
  createCookieApiTokenStorage,
  createCookieSessionStorage,
  createTenantApiAuthenticationGateway,
} from '@/features/auth/infrastructure';
import { TransportError } from '../domain/contracts';
import { TransportGateway } from '../infrastructure/transport-gateway';

export async function executeTransport<T>(
  operation: (gateway: TransportGateway) => Promise<T>,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, stored] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);
  if (!session || !isSessionValid(session) || !stored)
    throw new TransportError(401, 'Sua sessão expirou.', 'SESSION_EXPIRED');
  let tokens = stored;
  async function refresh() {
    try {
      const authentication = await createTenantApiAuthenticationGateway().refresh(
        tokens.refreshToken,
      );
      await Promise.all([
        sessionStorage.save(authentication.session),
        tokenStorage.save(authentication.tokens),
      ]);
      tokens = authentication.tokens;
    } catch (error) {
      throw error instanceof AuthenticationGatewayError
        ? new TransportError(401, 'Sua sessão expirou. Entre novamente.', 'SESSION_EXPIRED')
        : new TransportError(
            503,
            'Não foi possível renovar sua sessão.',
            'SESSION_REFRESH_UNAVAILABLE',
          );
    }
  }
  if (shouldRefreshApiToken(tokens)) await refresh();
  try {
    return await operation(new TransportGateway(tokens.accessToken));
  } catch (error) {
    if (!(error instanceof TransportError) || error.status !== 401) throw error;
  }
  await refresh();
  return operation(new TransportGateway(tokens.accessToken));
}
