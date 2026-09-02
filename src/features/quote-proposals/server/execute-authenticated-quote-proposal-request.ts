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

import { QuoteProposalRepositoryError, type QuoteProposalRepository } from '../application';
import { createQuoteProposalRepository } from '../infrastructure';

async function executeAuthenticatedQuoteProposalOperation<T>(
  operation: (repository: QuoteProposalRepository) => Promise<T>,
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
    throw new QuoteProposalRepositoryError(
      'service-unavailable',
      'Os orçamentos da Tenant API não estão disponíveis no modo simulado.',
    );
  }

  if (session === null || !isSessionValid(session) || storedTokens === null) {
    if (canRefreshCookies) {
      await Promise.allSettled([sessionStorage.remove(), tokenStorage.remove()]);
    }
    throw new QuoteProposalRepositoryError('unauthorized', 'Sua sessão local expirou.');
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
        throw new QuoteProposalRepositoryError(
          error.code === 'invalid-response' ? 'invalid-response' : 'unauthorized',
          'Sua sessão expirou. Entre novamente.',
        );
      }

      throw new QuoteProposalRepositoryError(
        'service-unavailable',
        'Não foi possível renovar a sessão local.',
      );
    }
  }

  if (shouldRefreshApiToken(tokens)) {
    if (!canRefreshCookies) {
      throw new QuoteProposalRepositoryError(
        'unauthorized',
        'Sua sessão precisa ser renovada antes desta operação.',
      );
    }
    await refreshAuthentication();
  }

  try {
    return await operation(createQuoteProposalRepository(tokens.accessToken));
  } catch (error) {
    if (
      !(error instanceof QuoteProposalRepositoryError) ||
      error.code !== 'unauthorized' ||
      !canRefreshCookies
    ) {
      throw error;
    }
  }

  await refreshAuthentication();
  return operation(createQuoteProposalRepository(tokens.accessToken));
}

export function executeAuthenticatedQuoteProposalRequest<T>(
  operation: (repository: QuoteProposalRepository) => Promise<T>,
): Promise<T> {
  return executeAuthenticatedQuoteProposalOperation(operation, false);
}

export function executeAuthenticatedQuoteProposalMutation<T>(
  operation: (repository: QuoteProposalRepository) => Promise<T>,
): Promise<T> {
  return executeAuthenticatedQuoteProposalOperation(operation, true);
}
