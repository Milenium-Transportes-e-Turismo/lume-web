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

import {
  WhatsAppConversationRepositoryError,
  type WhatsAppConversationRepository,
} from '../application';
import { createWhatsAppConversationRepository } from '../infrastructure';

async function executeAuthenticatedWhatsAppOperation<T>(
  operation: (repository: WhatsAppConversationRepository, accessToken: string) => Promise<T>,
  canRefreshCookies: boolean,
): Promise<T> {
  const [sessionStorage, tokenStorage] = await Promise.all([
    createCookieSessionStorage(),
    createCookieApiTokenStorage(),
  ]);
  const [session, storedTokens] = await Promise.all([sessionStorage.get(), tokenStorage.get()]);

  if (getServerEnv().AUTH_SIMULATION_ENABLED && session !== null && isSessionValid(session)) {
    return operation(await createWhatsAppConversationRepository(), '');
  }

  if (session === null || !isSessionValid(session) || storedTokens === null) {
    if (canRefreshCookies) {
      await Promise.allSettled([sessionStorage.remove(), tokenStorage.remove()]);
    }
    throw new WhatsAppConversationRepositoryError('unauthorized', 'Sua sessão local expirou.');
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
        throw new WhatsAppConversationRepositoryError(
          error.code === 'invalid-response' ? 'invalid-response' : 'unauthorized',
          'Sua sessão expirou. Entre novamente.',
        );
      }

      throw new WhatsAppConversationRepositoryError(
        'service-unavailable',
        'Não foi possível renovar a sessão local.',
      );
    }
  }

  if (shouldRefreshApiToken(tokens)) {
    if (!canRefreshCookies) {
      throw new WhatsAppConversationRepositoryError(
        'unauthorized',
        'Sua sessão precisa ser renovada antes desta operação.',
      );
    }
    await refreshAuthentication();
  }

  try {
    return await operation(
      await createWhatsAppConversationRepository(tokens.accessToken),
      tokens.accessToken,
    );
  } catch (error) {
    if (
      !(error instanceof WhatsAppConversationRepositoryError) ||
      error.code !== 'unauthorized' ||
      !canRefreshCookies
    ) {
      throw error;
    }
  }

  await refreshAuthentication();
  return operation(
    await createWhatsAppConversationRepository(tokens.accessToken),
    tokens.accessToken,
  );
}

export function executeAuthenticatedWhatsAppRequest<T>(
  operation: (repository: WhatsAppConversationRepository, accessToken: string) => Promise<T>,
): Promise<T> {
  return executeAuthenticatedWhatsAppOperation(operation, false);
}

export function executeAuthenticatedWhatsAppMutation<T>(
  operation: (repository: WhatsAppConversationRepository, accessToken: string) => Promise<T>,
): Promise<T> {
  return executeAuthenticatedWhatsAppOperation(operation, true);
}
