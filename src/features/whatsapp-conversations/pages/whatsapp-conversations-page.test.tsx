import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import { AUTHENTICATED_SESSION_VERSION, type AuthenticatedSession } from '@/features/auth/domain';

import { createWhatsAppConversationFixture } from '../testing/whatsapp-conversation-fixture';
import { WhatsAppConversationsPage } from './whatsapp-conversations-page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: jest.fn(),
}));
jest.mock('@/features/auth/components', () => ({
  LogoutButton: () => <button type="button">Sair</button>,
}));
jest.mock('../components', () => ({
  ConversationWorkspace: ({
    initialConversations,
    initialError,
  }: {
    initialConversations: readonly unknown[];
    initialError?: string | null;
  }) => (
    <>
      <p>Atendimento comercial</p>
      <h1>Painel WhatsApp</h1>
      <div data-testid="conversation-workspace">
        {initialConversations.length} carregadas {initialError}
      </div>
    </>
  ),
}));

const mockedUsePathname = jest.mocked(usePathname);

const session: AuthenticatedSession = {
  version: AUTHENTICATED_SESSION_VERSION,
  id: 'session-commercial',
  user: {
    id: 'commercial-001',
    name: 'Usuário Comercial',
    type: 'employee',
    departments: ['commercial'],
    permissions: ['dashboard:view', 'whatsapp-conversations:manage'],
    clientCategory: null,
    isActive: true,
  },
  issuedAt: '2026-07-21T12:00:00.000Z',
  expiresAt: '2026-07-21T20:00:00.000Z',
  rememberDevice: false,
};

describe('WhatsAppConversationsPage', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/whatsapp-conversations');
  });

  afterEach(() => {
    mockedUsePathname.mockReset();
  });

  it('renders the real management overview and forwards initial errors', () => {
    const conversations = [
      createWhatsAppConversationFixture(),
      createWhatsAppConversationFixture({
        id: '00000000-0000-4000-8000-000000000102',
        conversationState: 'human-active',
        flowStep: 'human-service',
        unreadCount: 0,
      }),
    ];

    render(
      <WhatsAppConversationsPage
        session={session}
        conversations={conversations}
        initialError="Falha inicial"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Painel WhatsApp' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Painel WhatsApp' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('Atendimento comercial')).toBeInTheDocument();
    expect(screen.getByText(/2 carregadas Falha inicial/)).toBeInTheDocument();
  });
});
