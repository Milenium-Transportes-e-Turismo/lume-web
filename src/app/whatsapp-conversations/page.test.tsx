/** @jest-environment node */

import { redirect } from 'next/navigation';

import {
  AUTHENTICATED_SESSION_VERSION,
  type AuthenticatedSession,
  type Permission,
} from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { WhatsAppConversationRepositoryError } from '@/features/whatsapp-conversations/application';
import { WhatsAppConversationsPage } from '@/features/whatsapp-conversations/pages';
import {
  getWhatsAppConversationPageForDashboard,
  getWhatsAppServiceAssignmentTargetsForDashboard,
} from '@/features/whatsapp-conversations/server';

import Page from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/features/auth/server', () => ({
  getCurrentAuthenticatedSession: jest.fn(),
}));

jest.mock('@/features/whatsapp-conversations/server', () => ({
  getWhatsAppConversationPageForDashboard: jest.fn(),
  getWhatsAppServiceAssignmentTargetsForDashboard: jest.fn(),
}));

const mockedGetCurrentAuthenticatedSession = jest.mocked(getCurrentAuthenticatedSession);
const mockedGetConversations = jest.mocked(getWhatsAppConversationPageForDashboard);
const mockedGetAssignmentTargets = jest.mocked(getWhatsAppServiceAssignmentTargetsForDashboard);
const mockedRedirect = jest.mocked(redirect);

function createSession(
  permissions: readonly Permission[],
  departments: readonly string[] = ['commercial'],
): AuthenticatedSession {
  return {
    version: AUTHENTICATED_SESSION_VERSION,
    id: 'session-commercial-001',
    user: {
      id: 'commercial-001',
      name: 'Usuário Comercial',
      type: 'employee',
      departments,
      permissions,
      clientCategory: null,
      isActive: true,
    },
    issuedAt: '2026-07-21T12:00:00.000Z',
    expiresAt: '2026-07-21T20:00:00.000Z',
    rememberDevice: false,
  };
}

describe('WhatsApp conversations page route', () => {
  beforeEach(() => {
    mockedRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
    mockedGetAssignmentTargets.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('redirects a visitor without a session to login', async () => {
    mockedGetCurrentAuthenticatedSession.mockResolvedValue(null);

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/login');
    expect(mockedGetConversations).not.toHaveBeenCalled();
  });

  it('redirects a user without conversation management permission', async () => {
    mockedGetCurrentAuthenticatedSession.mockResolvedValue(createSession(['dashboard:view']));

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/dashboard');
    expect(mockedGetConversations).not.toHaveBeenCalled();
  });

  it('loads the workspace for an operations employee with service:view', async () => {
    mockedGetCurrentAuthenticatedSession.mockResolvedValue(
      createSession(['service:view'], ['operations']),
    );
    mockedGetConversations.mockResolvedValue({
      conversations: [],
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
      metrics: {
        total: 0,
        botActive: 0,
        attendantActive: 0,
        automationPaused: 0,
        unreadMessages: 0,
        unreadConversations: 0,
        awaitingProposal: 0,
      },
    });

    await Page();

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(mockedGetConversations).toHaveBeenCalledTimes(1);
    expect(mockedGetAssignmentTargets).not.toHaveBeenCalled();
  });

  it('loads data through the server layer for an authorized user', async () => {
    const session = createSession(['dashboard:view', 'service:view', 'service:transfer']);
    mockedGetCurrentAuthenticatedSession.mockResolvedValue(session);
    mockedGetConversations.mockResolvedValue({
      conversations: [],
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
      metrics: {
        total: 0,
        botActive: 0,
        attendantActive: 0,
        automationPaused: 0,
        unreadMessages: 0,
        unreadConversations: 0,
        awaitingProposal: 0,
      },
    });

    const page = await Page();

    expect(mockedGetConversations).toHaveBeenCalledTimes(1);
    expect(mockedGetAssignmentTargets).toHaveBeenCalledTimes(1);
    expect(page.type).toBe(WhatsAppConversationsPage);
    expect(page.props).toEqual({
      session,
      conversations: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      metrics: {
        total: 0,
        botActive: 0,
        attendantActive: 0,
        automationPaused: 0,
        unreadMessages: 0,
        unreadConversations: 0,
        awaitingProposal: 0,
      },
      initialError: null,
      assignmentTargets: [],
    });
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('renders a retryable initial error when the Tenant API is unavailable', async () => {
    const session = createSession(['dashboard:view', 'whatsapp-conversations:manage']);
    mockedGetCurrentAuthenticatedSession.mockResolvedValue(session);
    mockedGetConversations.mockRejectedValue(
      new WhatsAppConversationRepositoryError('service-unavailable', 'Tenant API indisponível.'),
    );

    const page = await Page();

    expect(page.props).toEqual({
      session,
      conversations: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      metrics: {
        total: 0,
        botActive: 0,
        attendantActive: 0,
        automationPaused: 0,
        unreadMessages: 0,
        unreadConversations: 0,
        awaitingProposal: 0,
      },
      initialError: 'Tenant API indisponível.',
      assignmentTargets: [],
    });
  });
});
