import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';

import type { User } from '@/features/auth/domain';
import { createWhatsAppConversationFixture } from '@/features/whatsapp-conversations/testing/whatsapp-conversation-fixture';

import { CommercialNotificationCenter } from './commercial-notification-center';
import {
  getDepartmentNotificationsAction,
  markDepartmentNotificationReadAction,
} from './department-notification-action';

const toastAdd = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@/shared/ui/toast', () => ({
  toast: { add: (...args: unknown[]) => toastAdd(...args) },
}));

jest.mock('./department-notification-action', () => ({
  getDepartmentNotificationsAction: jest.fn(),
  markDepartmentNotificationReadAction: jest.fn(),
}));

const mockedDepartmentNotifications = jest.mocked(getDepartmentNotificationsAction);
const mockedMarkNotificationRead = jest.mocked(markDepartmentNotificationReadAction);
const mockedUsePathname = jest.mocked(usePathname);
const originalFetch = global.fetch;

function employee(
  departments: readonly string[],
  permissions: User['permissions'] = [
    'whatsapp-conversations:manage',
    'profile:view',
    'support:view',
  ],
): User {
  return {
    id: 'employee-notifications',
    name: 'Atendente',
    type: 'employee',
    departments,
    permissions,
    clientCategory: null,
    isActive: true,
  };
}

describe('CommercialNotificationCenter', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/dashboard');
    window.localStorage.clear();
    mockedDepartmentNotifications.mockResolvedValue({
      success: true,
      summary: {
        items: [
          {
            id: 'commercial.pending-quote-proposals',
            type: 'quote-proposal-pending',
            department: 'commercial',
            title: '2 orçamentos pendentes',
            description: 'A fila Comercial possui orçamentos aguardando envio.',
            href: '/quote-proposals',
            count: 2,
            unreadCount: 2,
            read: false,
          },
        ],
        total: 2,
        unreadTotal: 2,
      },
    });
    mockedMarkNotificationRead.mockResolvedValue({
      success: true,
      receipt: {
        notificationId: 'commercial.pending-quote-proposals',
        pendingTotal: 2,
        unreadTotal: 0,
        markedRead: 2,
        readAt: '2026-07-29T01:00:00.000Z',
      },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        conversations: [
          createWhatsAppConversationFixture({
            id: 'paused-commercial',
            department: 'commercial',
            conversationState: 'sent-to-human',
          }),
          createWhatsAppConversationFixture({
            id: 'active-commercial',
            department: 'commercial',
            conversationState: 'bot-active',
          }),
        ],
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('exibe no Drawer apenas pendências comerciais atuais', async () => {
    const user = userEvent.setup();
    render(<CommercialNotificationCenter user={employee(['commercial'])} />);

    const trigger = await screen.findByRole('button', {
      name: 'Notificações: 3 não visualizadas',
    });
    await user.click(trigger);

    expect(await screen.findByText('Notificações')).toBeInTheDocument();
    expect(screen.getByText('2 orçamentos pendentes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2 orçamentos pendentes/ })).toHaveAttribute(
      'href',
      '/quote-proposals?tab=pending',
    );
    expect(screen.getByText('Ana Paula')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ana Paula/ })).toHaveAttribute(
      'href',
      '/whatsapp-conversations?conversationId=paused-commercial',
    );
    expect(screen.queryByText('active-commercial')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Notificações', hidden: true }),
      ).toBeInTheDocument(),
    );
    expect(mockedMarkNotificationRead).toHaveBeenCalledWith('commercial.pending-quote-proposals');
    await waitFor(() =>
      expect(
        window.localStorage.getItem('lume:notification-read-fallback:v1:employee-notifications'),
      ).not.toContain('commercial.pending-quote-proposals'),
    );
  });

  it('mantém o sino no header sem consultar dados comerciais de outros departamentos', async () => {
    mockedDepartmentNotifications.mockResolvedValueOnce({
      success: true,
      summary: { items: [], total: 0, unreadTotal: 0 },
    });

    render(<CommercialNotificationCenter user={employee(['operations'])} />);

    expect(screen.getByRole('button', { name: 'Notificações' })).toBeVisible();
    await waitFor(() => expect(mockedDepartmentNotifications).toHaveBeenCalledTimes(1));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('suspende consultas paralelas durante a importação de históricos', async () => {
    mockedUsePathname.mockReturnValue('/whatsapp-conversations/import');

    const { container } = render(
      <CommercialNotificationCenter user={employee(['commercial'])} />,
    );

    expect(container).toBeEmptyDOMElement();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(mockedDepartmentNotifications).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('traduz o departamento da notificação sem expor o código interno', async () => {
    const user = userEvent.setup();
    mockedDepartmentNotifications.mockResolvedValueOnce({
      success: true,
      summary: {
        items: [
          {
            id: 'personnel.attendance-pending',
            type: 'attendance-pending',
            department: 'personnel-department',
            title: 'Atendimento pendente',
            description: 'Existe um atendimento aguardando a equipe.',
            href: '/dashboard',
            count: 1,
            unreadCount: 1,
            read: false,
          },
        ],
        total: 1,
        unreadTotal: 1,
      },
    });

    render(<CommercialNotificationCenter user={employee(['operations'])} />);
    await user.click(
      await screen.findByRole('button', { name: 'Notificações: 1 não visualizadas' }),
    );

    expect(await screen.findByText('Departamento Pessoal')).toBeInTheDocument();
    expect(screen.queryByText('personnel-department')).not.toBeInTheDocument();
  });

  it('recebe notificações comerciais sem expor a lista de conversas sem permissão', async () => {
    render(
      <CommercialNotificationCenter
        user={employee(['commercial'], ['profile:view', 'support:view'])}
      />,
    );

    expect(
      await screen.findByRole('button', { name: 'Notificações: 2 não visualizadas' }),
    ).toBeVisible();
    expect(mockedDepartmentNotifications).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('mantém pendências visualizadas no Drawer e sinaliza somente novos itens', async () => {
    const interaction = userEvent.setup();
    render(<CommercialNotificationCenter user={employee(['commercial'])} />);

    const trigger = await screen.findByRole('button', {
      name: 'Notificações: 3 não visualizadas',
    });
    await interaction.click(trigger);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Notificações', hidden: true }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('2 orçamentos pendentes')).toBeVisible();

    await interaction.click(screen.getByRole('button', { name: 'Fechar' }));
    mockedDepartmentNotifications.mockResolvedValueOnce({
      success: true,
      summary: {
        items: [
          {
            id: 'commercial.pending-quote-proposals',
            type: 'quote-proposal-pending',
            department: 'commercial',
            title: '3 orçamentos pendentes',
            description: 'A fila Comercial possui orçamentos aguardando envio.',
            href: '/quote-proposals',
            count: 3,
            unreadCount: 1,
            read: false,
          },
        ],
        total: 3,
        unreadTotal: 1,
      },
    });

    window.dispatchEvent(new CustomEvent('quote-proposals:count', { detail: 3 }));

    expect(
      await screen.findByRole('button', { name: 'Notificações: 1 não visualizadas' }),
    ).toBeVisible();
  });

  it('mantém o fallback local somente quando a Tenant API falha ao confirmar a leitura', async () => {
    const interaction = userEvent.setup();
    mockedMarkNotificationRead.mockRejectedValueOnce(new Error('Falha de transporte'));
    render(<CommercialNotificationCenter user={employee(['commercial'])} />);

    await interaction.click(
      await screen.findByRole('button', {
        name: 'Notificações: 3 não visualizadas',
      }),
    );
    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          description:
            'A notificação foi marcada neste dispositivo, mas não foi possível sincronizar a leitura.',
        }),
      ),
    );
    expect(screen.queryByRole('alert', { hidden: true })).not.toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Fechar' }));

    window.dispatchEvent(new CustomEvent('quote-proposals:count', { detail: 2 }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Notificações' })).toBeVisible());
    expect(
      window.localStorage.getItem('lume:notification-read-fallback:v1:employee-notifications'),
    ).toContain('"commercial.pending-quote-proposals":2');
  });
});
