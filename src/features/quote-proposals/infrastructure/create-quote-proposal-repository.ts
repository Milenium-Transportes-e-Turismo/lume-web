import 'server-only';

import { getTenantApiConfig } from '@/env.server';

import type { QuoteProposalRepository } from '../application';
import { LumeApiQuoteProposalRepository } from './tenant-api-quote-proposal-repository';

export function createQuoteProposalRepository(accessToken: string): QuoteProposalRepository {
  if (!accessToken.trim()) {
    throw new Error('An authenticated Tenant API access token is required.');
  }

  const tenantApi = getTenantApiConfig();

  return new LumeApiQuoteProposalRepository(
    tenantApi.baseUrl,
    accessToken,
    fetch,
    tenantApi.timeoutMs,
  );
}
