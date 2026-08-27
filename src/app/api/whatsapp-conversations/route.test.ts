/** @jest-environment node */

import {
  AUTHENTICATED_SESSION_VERSION,
  type AuthenticatedSession,
  type Permission,
} from '@/features/auth/domain';
import { WhatsAppConversationRepositoryError } from '@/features/whatsapp-conversations/application';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import {
  pollWhatsAppConversationForDashboard,
  pollWhatsAppConversationPageForDashboard,
  searchWhatsAppMessagesForDashboard,
} from '@/features/whatsapp-conversations/server';
import { createWhatsAppConversationFixture } from '@/features/whatsapp-conversations/testing/whatsapp-conversation-fixture';

import { GET } from './route';

jest.mock('@/features/auth/server', () => ({
  getCurrentAuthenticatedSession: jest.fn(),
}));
jest.mock('@/features/whatsapp-conversations/server', () => ({
  pollWhatsAppConversationForDashboard: jest.fn(),
  pollWhatsAppConversationPageForDashboard: jest.fn(),
  searchWhatsAppMessagesForDashboard: jest.fn(),
}));

const mockedSession = jest.mocked(getCurrentAuthenticatedSession);
const mockedPollDetail = jest.mocked(pollWhatsAppConversationForDashboard);
const mockedPollList = jest.mocked(pollWhatsAppConversationPageForDashboard);
const mockedSearch = jest.mocked(searchWhatsAppMessagesForDashboard);

function session(permissions: readonly Permission[]): AuthenticatedSession {
  return {
    version: AUTHENTICATED_SESSION_VERSION,
    id: 'session-001',
    user: {
      id: 'user-001',
      name: 'Usuário',
      type: 'employee',
      departments: ['commercial'],
      permissions,
      clientCategory: null,
      isActive: true,
    },
    issuedAt: '2026-07-25T12:00:00.000Z',
    expiresAt: '2026-07-25T20:00:00.000Z',
    rememberDevice: false,
  };
}

describe('WhatsApp polling route', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects polling without permission to view WhatsApp conversations', async () => {
    mockedSession.mockResolvedValue(session(['dashboard:view']));

    const response = await GET(new Request('http://localhost/api/whatsapp-conversations'));

    expect(response.status).toBe(403);
    expect(mockedPollList).not.toHaveBeenCalled();
  });

  it('returns the tenant-scoped list through the authenticated server layer', async () => {
    const conversation = createWhatsAppConversationFixture();
    mockedSession.mockResolvedValue(session(['whatsapp-conversations:view']));
    mockedPollList.mockResolvedValue({
      conversations: [conversation],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
      metrics: {
        total: 1,
        botActive: 1,
        attendantActive: 0,
        automationPaused: 0,
        unreadMessages: 0,
        unreadConversations: 0,
        awaitingProposal: 0,
      },
    });

    const response = await GET(new Request('http://localhost/api/whatsapp-conversations'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      conversations: [conversation],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      metrics: {
        total: 1,
        botActive: 1,
        attendantActive: 0,
        automationPaused: 0,
        unreadMessages: 0,
        unreadConversations: 0,
        awaitingProposal: 0,
      },
    });
    expect(mockedPollList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 25,
      search: undefined,
      department: undefined,
      control: undefined,
      requestStatus: undefined,
      archive: 'active',
    });
  });

  it('forwards pagination and humanized filters without loading every page', async () => {
    mockedSession.mockResolvedValue(session(['whatsapp-conversations:view']));
    mockedPollList.mockResolvedValue({
      conversations: [],
      page: 4,
      pageSize: 25,
      total: 126,
      totalPages: 6,
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

    const response = await GET(
      new Request(
        'http://localhost/api/whatsapp-conversations?page=4&pageSize=25&search=Ana&department=commercial&control=paused&requestStatus=under-review',
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedPollList).toHaveBeenCalledWith({
      page: 4,
      pageSize: 25,
      search: 'Ana',
      department: 'commercial',
      control: 'paused',
      requestStatus: 'under-review',
      archive: 'active',
    });
  });

  it('preserves the rate-limit response so polling can apply backoff', async () => {
    mockedSession.mockResolvedValue(session(['whatsapp-conversations:manage']));
    mockedPollList.mockRejectedValue(
      new WhatsAppConversationRepositoryError(
        'too-many-requests',
        'Aguarde alguns instantes antes de atualizar novamente.',
      ),
    );

    const response = await GET(new Request('http://localhost/api/whatsapp-conversations'));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      message: 'Aguarde alguns instantes antes de atualizar novamente.',
    });
  });

  it('loads the selected page of a conversation history', async () => {
    const conversation = createWhatsAppConversationFixture();
    mockedSession.mockResolvedValue(session(['whatsapp-conversations:manage']));
    mockedPollDetail.mockResolvedValue(conversation);

    const response = await GET(
      new Request(
        `http://localhost/api/whatsapp-conversations?conversationId=${conversation.id}&messagePage=4`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedPollDetail).toHaveBeenCalledWith(conversation.id, 4);
  });

  it('searches the complete conversation history through the authenticated server layer', async () => {
    const conversation = createWhatsAppConversationFixture();
    mockedSession.mockResolvedValue(session(['whatsapp-conversations:manage']));
    mockedSearch.mockResolvedValue({
      messages: conversation.messages,
      page: 1,
      pageSize: 50,
      total: conversation.messages.length,
      totalPages: conversation.messages.length > 0 ? 1 : 0,
    });

    const response = await GET(
      new Request(
        `http://localhost/api/whatsapp-conversations?conversationId=${conversation.id}&messageSearch=orçamento`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedSearch).toHaveBeenCalledWith(conversation.id, 'orçamento', 1);
  });
});
