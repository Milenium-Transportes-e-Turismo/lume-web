/** @jest-environment node */

import { redirect } from 'next/navigation';

import {
  AUTHENTICATED_SESSION_VERSION,
  type AuthenticatedSession,
  type Permission,
} from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { QuoteProposalRepositoryError } from '@/features/quote-proposals/application';
import { getPendingQuoteProposalsForDashboard } from '@/features/quote-proposals/server';

import Page from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));
jest.mock('@/features/auth/server', () => ({
  getCurrentAuthenticatedSession: jest.fn(),
}));
jest.mock('@/features/quote-proposals/server', () => ({
  getPendingQuoteProposalsForDashboard: jest.fn().mockResolvedValue({ items: [], total: 2 }),
  getSentQuoteProposalsForDashboard: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  getApprovedQuoteProposalsForDashboard: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  getCancelledQuoteProposalsForDashboard: jest.fn().mockResolvedValue({ items: [], total: 0 }),
}));

const mockedSession = jest.mocked(getCurrentAuthenticatedSession);
const mockedRedirect = jest.mocked(redirect);
const mockedPending = jest.mocked(getPendingQuoteProposalsForDashboard);

function createSession(
  permissions: readonly Permission[],
  departments: readonly string[] = ['commercial'],
  isAdministrator = false,
): AuthenticatedSession {
  return {
    version: AUTHENTICATED_SESSION_VERSION,
    id: 'session-001',
    user: {
      id: 'employee-001',
      name: 'Usuário Comercial',
      type: 'employee',
      departments,
      permissions,
      clientCategory: null,
      isActive: true,
      isAdministrator,
    },
    issuedAt: '2026-07-21T12:00:00.000Z',
    expiresAt: '2026-07-21T20:00:00.000Z',
    rememberDevice: false,
  };
}

describe('quote proposals parent route', () => {
  beforeEach(() => {
    mockedRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('redirects a visitor without a session to login', async () => {
    mockedSession.mockResolvedValue(null);

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/login');
  });

  it('protects the route with permission and Commercial scope', async () => {
    mockedSession.mockResolvedValue(createSession(['dashboard:view']));

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
    expect(mockedRedirect).toHaveBeenCalledWith('/dashboard');

    mockedSession.mockResolvedValue(
      createSession(['whatsapp-conversations:manage'], ['operations']),
    );
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
    expect(mockedRedirect).toHaveBeenLastCalledWith('/dashboard');
  });

  it('renders all queues as tabs and honors the requested tab', async () => {
    mockedSession.mockResolvedValue(createSession(['whatsapp-conversations:manage']));

    const result = await Page({ searchParams: Promise.resolve({ tab: 'approved' }) });

    expect(result.props.initialTab).toBe('approved');
    expect(result.props.pendingTotal).toBe(2);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('renders the queues for an administrator without Commercial department', async () => {
    mockedSession.mockResolvedValue(createSession([], [], true));

    const result = await Page({ searchParams: Promise.resolve({}) });

    expect(result.props.pendingTotal).toBe(2);
    expect(result.props.canManage).toBe(true);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('não entrega detalhes técnicos à fila quando a consulta falha', async () => {
    mockedSession.mockResolvedValue(createSession(['whatsapp-conversations:manage']));
    mockedPending.mockRejectedValueOnce(
      new QuoteProposalRepositoryError(
        'service-unavailable',
        'A Tenant API recebeu HTTP 503 do n8n.',
      ),
    );

    const result = await Page({ searchParams: Promise.resolve({}) });

    expect(result.props.errors.pending).toBe('Não foi possível carregar os orçamentos pendentes.');
    expect(result.props.errors.pending).not.toMatch(/Tenant API|HTTP 503|n8n/i);
  });
});
