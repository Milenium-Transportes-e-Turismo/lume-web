import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { findClientByPhoneAction } from '@/features/clients/actions/client-actions';
import {
  closeWhatsAppConversationAction,
  forwardWhatsAppConversationAction,
  markWhatsAppConversationAsReadAction,
  returnWhatsAppConversationToBotAction,
  sendHumanWhatsAppMessageAction,
  startWhatsAppConversationAction,
  takeOverWhatsAppConversationAction,
} from '../actions';
import type { WhatsAppConversation } from '../domain';
import { createWhatsAppConversationFixture } from '../testing/whatsapp-conversation-fixture';
import { ConversationWorkspace, preserveLoadedConversationHistory } from './conversation-workspace';

jest.setTimeout(15_000);

const toastAdd = jest.fn();
const routerPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

jest.mock('@/features/clients/actions/client-actions', () => ({
  findClientByPhoneAction: jest.fn(),
}));

jest.mock('@/shared/ui/toast', () => ({
  toast: { add: (...args: unknown[]) => toastAdd(...args) },
}));

jest.mock('../actions', () => ({
  closeWhatsAppConversationAction: jest.fn(),
  forwardWhatsAppConversationAction: jest.fn(),
  markWhatsAppConversationAsReadAction: jest.fn(),
  returnWhatsAppConversationToBotAction: jest.fn(),
  sendHumanWhatsAppMessageAction: jest.fn(),
  startWhatsAppConversationAction: jest.fn(),
  takeOverWhatsAppConversationAction: jest.fn(),
}));

const mockedForward = jest.mocked(forwardWhatsAppConversationAction);
const mockedClose = jest.mocked(closeWhatsAppConversationAction);
const mockedMarkAsRead = jest.mocked(markWhatsAppConversationAsReadAction);
const mockedReturnToBot = jest.mocked(returnWhatsAppConversationToBotAction);
const mockedSendMessage = jest.mocked(sendHumanWhatsAppMessageAction);
const mockedStartConversation = jest.mocked(startWhatsAppConversationAction);
const mockedTakeOver = jest.mocked(takeOverWhatsAppConversationAction);
const mockedFindClient = jest.mocked(findClientByPhoneAction);
const originalFetch = global.fetch;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function mockFetchDetail(conversation: WhatsAppConversation) {
  return jest.mocked(global.fetch).mockResolvedValue(response({ conversation }));
}

async function openMessages(_user: ReturnType<typeof userEvent.setup>) {
  void _user;
  await screen.findByRole('region', { name: /Histórico da conversa/ });
}

describe('ConversationWorkspace', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    mockedFindClient.mockResolvedValue({ status: 'not-found' });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    global.fetch = originalFetch;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('inicia uma conversa pelo telefone e seleciona o atendimento criado', async () => {
    const current = createWhatsAppConversationFixture({ unreadCount: 0 });
    const started = createWhatsAppConversationFixture({
      id: '00000000-0000-4000-8000-000000000777',
      contact: {
        id: '00000000-0000-4000-8000-000000000778',
        name: '5534987654321',
        phone: '5534987654321',
        profilePictureUrl: null,
      },
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-001', name: 'Usuário Comercial' },
      unreadCount: 0,
    });
    mockFetchDetail(started);
    mockedStartConversation.mockResolvedValue({ success: true, conversation: started });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[current]} currentUserId="employee-001" />);

    await user.click(screen.getByRole('button', { name: 'Ações das conversas' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Nova conversa' }));
    await user.type(screen.getByLabelText('Número do WhatsApp'), '(34) 98765-4321');
    await user.click(screen.getByRole('button', { name: 'Iniciar atendimento' }));

    await waitFor(() =>
      expect(mockedStartConversation).toHaveBeenCalledWith({ phone: '(34) 98765-4321' }),
    );
    expect(await screen.findAllByText('5534987654321')).not.toHaveLength(0);
  });

  it('reinicia atendimento humano na conversa encerrada existente', async () => {
    const closed = createWhatsAppConversationFixture({
      conversationState: 'closed',
      flowStep: 'closed',
      assignedTo: null,
      closedAt: '2026-08-14T12:00:00.000Z',
      version: 8,
      unreadCount: 0,
    });
    const reopened = createWhatsAppConversationFixture({
      ...closed,
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-001', name: 'Usuário Comercial' },
      closedAt: null,
      version: 9,
    });
    mockFetchDetail(closed);
    mockedTakeOver.mockResolvedValue({ success: true, conversation: reopened });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[closed]} currentUserId="employee-001" />);

    const startButton = screen.getByRole('button', { name: 'Iniciar' });
    expect(startButton).toBeEnabled();
    await user.click(startButton);

    await waitFor(() =>
      expect(mockedTakeOver).toHaveBeenCalledWith({
        conversationId: closed.id,
        expectedVersion: 8,
      }),
    );
  });

  it('preserves loaded pagination metadata during list polling', () => {
    const loadedConversation = createWhatsAppConversationFixture({
      messages: [
        {
          id: '00000000-0000-4000-8000-000000000501',
          direction: 'inbound',
          deliveryStatus: 'received',
          kind: 'text',
          text: 'Mensagem mais recente',
          attachment: null,
          sentBy: null,
          occurredAt: '2026-07-21T13:42:00.000Z',
          attempts: [],
        },
      ],
      messageHistory: {
        page: 1,
        pageSize: 100,
        total: 6_711,
        totalPages: 68,
      },
    });
    const polledSummary = createWhatsAppConversationFixture({
      ...loadedConversation,
      messages: [],
      messageHistory: undefined,
      updatedAt: '2026-07-21T13:43:00.000Z',
    });

    const [result] = preserveLoadedConversationHistory([loadedConversation], [polledSummary]);

    expect(result.messages).toEqual(loadedConversation.messages);
    expect(result.messageHistory).toEqual(loadedConversation.messageHistory);
    expect(result.updatedAt).toBe(polledSummary.updatedAt);
  });

  it('keeps the selected contact identity and last interaction in a compact responsive row', () => {
    const conversation = createWhatsAppConversationFixture({
      contact: {
        id: '00000000-0000-4000-8000-000000000301',
        name: 'Taiane Karine',
        phone: '553496305110',
        profilePictureUrl: null,
      },
      lastMessageAt: '2026-07-29T19:50:00.000Z',
    });
    mockFetchDetail(conversation);

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    const contactHeading = screen.getByRole('heading', {
      level: 3,
      name: 'Taiane Karine',
    });
    const identityRow = contactHeading.parentElement;
    const detailHeader = contactHeading.closest('header');

    expect(identityRow).toHaveClass('min-w-0', 'flex-1');
    expect(detailHeader).toHaveClass('min-h-14', 'px-3', 'py-1.5');
    const conversationButton = screen.getByRole('button', {
      name: /Taiane Karine/,
      pressed: true,
    });
    const conversationList = conversationButton.parentElement;
    expect(conversationList).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    const inbox = conversationList?.closest('aside');
    expect(inbox).toHaveClass('flex');
    fireEvent.click(conversationButton);
    expect(inbox).toHaveClass('hidden', 'lg:flex');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a caixa de entrada' }));
    expect(inbox).toHaveClass('flex');
    expect(screen.getAllByText('553496305110')).toHaveLength(2);
    expect(screen.getByText(/Última interação: 29\/07\/2026, 16:50/)).toBeInTheDocument();
  });

  it('opens the matching client when the contact header is selected', async () => {
    const conversation = createWhatsAppConversationFixture({
      contact: {
        id: '00000000-0000-4000-8000-000000000302',
        name: 'Taiane Karine',
        phone: '553496305110',
        profilePictureUrl: null,
      },
    });
    mockFetchDetail(conversation);
    mockedFindClient.mockResolvedValue({ status: 'found', clientId: 'client-001' });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    await user.click(screen.getByRole('button', { name: 'Abrir cadastro de Taiane Karine' }));

    await waitFor(() => expect(mockedFindClient).toHaveBeenCalledWith('553496305110'));
    expect(routerPush).toHaveBeenCalledWith('/clients/client-001');
  });

  it('offers a prefilled client registration in a new tab when the contact is unknown', async () => {
    const conversation = createWhatsAppConversationFixture({
      contact: {
        id: '00000000-0000-4000-8000-000000000303',
        name: 'Contato sem cadastro',
        phone: '5534999999999',
        profilePictureUrl: null,
      },
    });
    mockFetchDetail(conversation);
    mockedFindClient.mockResolvedValue({ status: 'not-found' });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    await user.click(
      screen.getByRole('button', { name: 'Abrir cadastro de Contato sem cadastro' }),
    );

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    const registrationLink = screen.getByRole('link', { name: 'Cadastrar' });
    expect(registrationLink).toHaveAttribute('target', '_blank');
    expect(registrationLink).toHaveAttribute(
      'href',
      '/clients/new?name=Contato%20sem%20cadastro&phone=5534999999999',
    );
  });

  it('shows canonical dimensions, bot blocking, confirmed quote, second contact and complete history', async () => {
    const summary = createWhatsAppConversationFixture({
      conversationState: 'bot-active',
      flowStep: 'commercial-follow-up-menu',
      requestStatus: 'under-review',
      messages: [],
    });
    const detail = createWhatsAppConversationFixture({
      ...summary,
      messages: [
        {
          id: '00000000-0000-4000-8000-000000000501',
          direction: 'outbound',
          deliveryStatus: 'failed',
          kind: 'document',
          text: 'Segue a proposta.',
          attachment: {
            mimeType: 'application/pdf',
            size: 2048,
            url: 'https://files.example.test/proposta.pdf',
            fileName: 'proposta.pdf',
            metadata: {},
          },
          occurredAt: '2026-07-21T13:45:00.000Z',
          attempts: [
            {
              id: '00000000-0000-4000-8000-000000000601',
              attemptNumber: 1,
              status: 'failed',
              providerMessageId: null,
              errorCode: 'PROVIDER_TIMEOUT',
              errorMessage: 'Evolution não respondeu.',
              startedAt: '2026-07-21T13:45:00.000Z',
              completedAt: '2026-07-21T13:45:05.000Z',
            },
          ],
        },
      ],
      transitions: [
        {
          id: '00000000-0000-4000-8000-000000000901',
          commandId: '00000000-0000-4000-8000-000000000902',
          name: 'confirm-quote',
          expectedVersion: 7,
          resultingVersion: 8,
          actorType: 'service',
          actorUserId: null,
          from: {
            department: 'commercial',
            conversationState: 'waiting-for-customer',
            flowStep: 'quote-summary-confirmation',
            requestStatus: 'waiting-for-customer',
          },
          to: {
            department: 'commercial',
            conversationState: 'bot-active',
            flowStep: 'commercial-follow-up-menu',
            requestStatus: 'under-review',
          },
          metadata: {},
          createdAt: '2026-07-21T13:44:00.000Z',
        },
      ],
    });
    mockFetchDetail(detail);
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[summary]} />);

    expect(screen.getAllByText('Departamento')).toHaveLength(2);
    expect(screen.getByText('Estado da conversa')).toBeInTheDocument();
    expect(screen.getByText('Etapa do fluxo')).toBeInTheDocument();
    expect(screen.getAllByText('Status comercial')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'BOT ativo' })).toBeDisabled();
    expect(
      screen.queryByText('Segundo contato retomado no acompanhamento comercial.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Orçamentos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir orçamentos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pesquisar mensagens' })).toBeInTheDocument();
    expect(screen.queryByText('Resumo confirmado')).not.toBeInTheDocument();
    await openMessages(user);
    expect(await screen.findByText('proposta.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Enviada por .* · \d{2}:\d{2}/)).toBeInTheDocument();
    expect(
      screen.getByText('Não foi possível enviar esta mensagem. Tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Evolution não respondeu.')).not.toBeInTheDocument();
    expect(screen.queryByText(/PROVIDER_TIMEOUT/)).not.toBeInTheDocument();
    expect(screen.queryByText('Dados adicionais confirmados')).not.toBeInTheDocument();
    expect(screen.queryByText('Auditoria essencial')).not.toBeInTheDocument();
    expect(screen.queryByText('confirm-quote')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Visualizar PDF' }));
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
      'href',
      'https://files.example.test/proposta.pdf',
    );
  });

  it('renders WhatsApp media inline without treating it as text', async () => {
    const summary = createWhatsAppConversationFixture({ messages: [] });
    const media = [
      {
        id: '00000000-0000-4000-8000-000000000511',
        kind: 'image' as const,
        url: 'https://files.example.test/imagem.jpg',
        mimeType: 'image/jpeg',
        fileName: 'imagem.jpg',
      },
      {
        id: '00000000-0000-4000-8000-000000000512',
        kind: 'video' as const,
        url: 'https://files.example.test/video.mp4',
        mimeType: 'video/mp4',
        fileName: 'video.mp4',
      },
      {
        id: '00000000-0000-4000-8000-000000000513',
        kind: 'audio' as const,
        url: 'https://files.example.test/audio.ogg',
        mimeType: 'audio/ogg',
        fileName: 'audio.ogg',
      },
      {
        id: '00000000-0000-4000-8000-000000000514',
        kind: 'document' as const,
        url: 'https://files.example.test/arquivo.pdf',
        mimeType: 'application/pdf',
        fileName: 'arquivo.pdf',
      },
      {
        id: '00000000-0000-4000-8000-000000000515',
        kind: 'sticker' as const,
        url: 'https://files.example.test/figurinha.webp',
        mimeType: 'image/webp',
        fileName: 'figurinha.webp',
      },
    ];
    const detail = createWhatsAppConversationFixture({
      ...summary,
      messages: media.map((item, index) => ({
        id: item.id,
        direction: 'inbound',
        deliveryStatus: 'delivered',
        kind: item.kind,
        text: null,
        attachment: {
          mimeType: item.mimeType,
          size: 1_024 + index,
          url: item.url,
          fileName: item.fileName,
          metadata: {},
        },
        occurredAt: `2026-07-30T1${index}:00:00.000Z`,
        attempts: [],
      })),
    });
    mockFetchDetail(detail);
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[summary]} />);
    await openMessages(user);

    const mediaLoadButtons = await screen.findAllByRole('button', {
      name: 'Carregar mídia',
    });
    for (const button of mediaLoadButtons) await user.click(button);

    expect(await screen.findByAltText('imagem.jpg')).toHaveAttribute(
      'src',
      'https://files.example.test/imagem.jpg',
    );
    expect(screen.getByAltText('Figurinha recebida')).toHaveAttribute(
      'src',
      'https://files.example.test/figurinha.webp',
    );
    expect(screen.getByLabelText('video.mp4')).toHaveAttribute('controls');
    expect(screen.getByLabelText('audio.ogg')).toHaveAttribute('controls');
    await user.click(screen.getByRole('button', { name: 'Visualizar PDF' }));
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
      'href',
      'https://files.example.test/arquivo.pdf',
    );
  });

  it('sends expectedVersion when taking over and reloads after success', async () => {
    const conversation = createWhatsAppConversationFixture({ unreadCount: 0 });
    const updated = createWhatsAppConversationFixture({
      unreadCount: 0,
      conversationState: 'human-active',
      flowStep: 'human-service',
      version: 4,
      assignedTo: { id: 'employee-001', name: 'Usuário Comercial' },
    });
    mockFetchDetail(conversation);
    mockedTakeOver.mockResolvedValue({ success: true, conversation: updated });
    const user = userEvent.setup();
    render(<ConversationWorkspace initialConversations={[conversation]} />);

    await user.click(screen.getByRole('button', { name: 'Atendente inativo' }));

    await waitFor(() => {
      expect(mockedTakeOver).toHaveBeenCalledWith({
        conversationId: conversation.id,
        expectedVersion: 3,
      });
    });
    expect(await screen.findByText('Atendimento assumido com sucesso.')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('uses the dedicated return-to-bot operation with the current version', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-001', name: 'Usuário Comercial' },
      version: 8,
      unreadCount: 0,
    });
    const returned = createWhatsAppConversationFixture({
      conversationState: 'bot-active',
      flowStep: 'commercial-follow-up-menu',
      version: 9,
      unreadCount: 0,
    });
    mockFetchDetail(conversation);
    mockedReturnToBot.mockResolvedValue({ success: true, conversation: returned });
    const user = userEvent.setup();
    render(<ConversationWorkspace initialConversations={[conversation]} />);

    await user.click(screen.getByRole('button', { name: 'BOT inativo' }));

    await waitFor(() => {
      expect(mockedReturnToBot).toHaveBeenCalledWith({
        conversationId: conversation.id,
        expectedVersion: 8,
      });
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('allows takeover to repair a stale assignment and keeps return-to-bot disabled', () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-002', name: 'Outro atendente' },
      unreadCount: 0,
    });
    mockFetchDetail(conversation);

    render(
      <ConversationWorkspace initialConversations={[conversation]} currentUserId="employee-001" />,
    );

    expect(screen.getByRole('button', { name: 'Atendente inativo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'BOT inativo' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Marcar como lid[ao]/i })).not.toBeInTheDocument();
  });

  it('shows a conflict and replaces stale state with the reloaded conversation', async () => {
    const conversation = createWhatsAppConversationFixture({
      unreadCount: 0,
      version: 3,
    });
    const latest = createWhatsAppConversationFixture({
      unreadCount: 0,
      version: 4,
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-002', name: 'Outro atendente' },
    });
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response({ conversation }))
      .mockResolvedValue(response({ conversation: latest }));
    mockedTakeOver.mockResolvedValue({
      success: false,
      code: 'conflict',
      message: 'Conflito: atendimento recarregado.',
      conversation: latest,
    });
    const user = userEvent.setup();
    render(<ConversationWorkspace initialConversations={[conversation]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Atendente inativo' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          description: 'Conflito: atendimento recarregado.',
        }),
      ),
    );
    expect(screen.queryByText(/Responsável:/)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Atendente ativo' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'BOT inativo' })).toBeDisabled());
  });

  it('renders empty and initial error states and retries the list request', async () => {
    jest
      .mocked(global.fetch)
      .mockResolvedValue(response({ conversations: [createWhatsAppConversationFixture()] }));
    const user = userEvent.setup();
    render(
      <ConversationWorkspace initialConversations={[]} initialError="Tenant API indisponível." />,
    );

    expect(screen.getByText('Nenhuma conversa encontrada')).toBeInTheDocument();
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        description: 'Não foi possível atualizar a lista de conversas.',
      }),
    );
    expect(screen.queryByText('Tenant API indisponível.')).not.toBeInTheDocument();
    expect(screen.getByText('A lista não pôde ser atualizada.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Ana Paula')).toBeInTheDocument();
  });

  it('exibe rótulos legíveis e somente os nove departamentos do MVP nos filtros', async () => {
    const conversation = createWhatsAppConversationFixture({
      department: 'personnel-department',
      requestStatus: 'not-started',
      currentQuoteRequest: null,
      unreadCount: 0,
    });
    mockFetchDetail(conversation);
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    expect(screen.queryByText('personnel-department')).not.toBeInTheDocument();
    const departmentFilter = screen.getByRole('combobox', { name: 'Departamento' });
    expect(departmentFilter).toHaveTextContent('Todos');
    await user.click(departmentFilter);

    expect(await screen.findAllByRole('option')).toHaveLength(10);
    expect(await screen.findByRole('option', { name: 'Departamento Pessoal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Operacional' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Recursos Humanos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Limpeza' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Tecnologia da Informação' }),
    ).not.toBeInTheDocument();
  });

  it('shows detail loading, error and retry without inventing data', async () => {
    const conversation = createWhatsAppConversationFixture({ messages: [] });
    let resolveFirstRequest: ((value: Response) => void) | undefined;
    jest
      .mocked(global.fetch)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirstRequest = resolve;
          }),
      )
      .mockResolvedValueOnce(response({ conversation }));
    const user = userEvent.setup();
    render(<ConversationWorkspace initialConversations={[conversation]} />);
    await openMessages(user);

    expect(await screen.findByText('Carregando histórico completo...')).toBeInTheDocument();
    await act(async () => {
      resolveFirstRequest?.(response({ message: 'Falha temporária.' }, 503));
    });
    expect(await screen.findByText('O histórico não pôde ser carregado.')).toBeInTheDocument();
    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          description: 'Não foi possível carregar as mensagens. Tente novamente.',
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Nenhuma mensagem registrada')).toBeInTheDocument();
  });

  it('mantém o histórico embutido no painel e sem rolagem horizontal', async () => {
    const conversation = createWhatsAppConversationFixture({ messages: [], unreadCount: 0 });
    mockFetchDetail(conversation);
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);
    await openMessages(user);

    const messagePanel = screen.getByRole('region', {
      name: /Histórico da conversa com/,
    });
    expect(messagePanel).toHaveClass(
      'flex',
      'min-h-0',
      'flex-1',
      'overflow-x-hidden',
      'bg-background',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('permite encerrar somente a sessão humana enquanto existe proposta em andamento', async () => {
    const conversation = createWhatsAppConversationFixture({ unreadCount: 0 });
    mockFetchDetail(conversation);
    render(<ConversationWorkspace initialConversations={[conversation]} />);

    expect(screen.getByRole('button', { name: 'Encerrar' })).toBeEnabled();
    expect(mockedForward).not.toHaveBeenCalled();
    expect(mockedMarkAsRead).not.toHaveBeenCalled();
  });

  it('confirma e encerra um atendimento cuja proposta foi recusada', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      requestStatus: 'rejected',
      unreadCount: 0,
      version: 6,
    });
    const closed = createWhatsAppConversationFixture({
      ...conversation,
      conversationState: 'closed',
      flowStep: 'closed',
      assignedTo: null,
      closedAt: '2026-07-28T12:00:00.000Z',
      version: 7,
    });
    mockFetchDetail(conversation);
    mockedClose.mockResolvedValue({ success: true, conversation: closed });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    await user.click(screen.getByRole('button', { name: 'Encerrar' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Quando o cliente enviar uma nova mensagem, o bot iniciará outro atendimento',
    );
    const confirmButton = screen.getByRole('button', { name: 'Confirmar encerramento' });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Motivo do encerramento/ }), {
      target: { value: 'Cliente recusou o valor da proposta.' },
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockedClose).toHaveBeenCalledWith({
        conversationId: conversation.id,
        expectedVersion: 6,
        reason: 'Cliente recusou o valor da proposta.',
      });
    });
    expect(
      await screen.findByText(/Atendimento encerrado\. O próximo contato/),
    ).toBeInTheDocument();
  });

  it('permite encerrar uma conversa sem proposta em andamento', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      requestStatus: 'not-started',
      currentQuoteRequest: null,
      unreadCount: 0,
      version: 4,
    });
    const closed = createWhatsAppConversationFixture({
      ...conversation,
      conversationState: 'closed',
      flowStep: 'closed',
      assignedTo: null,
      closedAt: '2026-07-28T13:00:00.000Z',
      version: 5,
    });
    mockFetchDetail(conversation);
    mockedClose.mockResolvedValue({ success: true, conversation: closed });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    const closeButton = screen.getByRole('button', { name: 'Encerrar' });
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    await user.click(screen.getByRole('button', { name: 'Confirmar encerramento' }));

    await waitFor(() => {
      expect(mockedClose).toHaveBeenCalledWith({
        conversationId: conversation.id,
        expectedVersion: 4,
        reason: undefined,
      });
    });
  });

  it('permite ao painel comercial encerrar atendimento encaminhado a outro departamento', async () => {
    const conversation = createWhatsAppConversationFixture({
      department: 'operations',
      conversationState: 'sent-to-human',
      flowStep: 'human-service',
      requestStatus: 'not-started',
      currentQuoteRequest: null,
      unreadCount: 0,
      version: 10,
    });
    const closed = createWhatsAppConversationFixture({
      ...conversation,
      conversationState: 'closed',
      flowStep: 'closed',
      closedAt: '2026-07-31T16:00:00.000Z',
      version: 11,
    });
    mockFetchDetail(conversation);
    mockedClose.mockResolvedValue({ success: true, conversation: closed });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    const closeButton = screen.getByRole('button', { name: 'Encerrar' });
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    await user.click(screen.getByRole('button', { name: 'Confirmar encerramento' }));

    await waitFor(() => {
      expect(mockedClose).toHaveBeenCalledWith({
        conversationId: conversation.id,
        expectedVersion: 10,
        reason: undefined,
      });
    });
  });

  it('permite encerrar no MVP mesmo quando existe proposta aprovada', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      requestStatus: 'approved',
      hasApprovedQuoteRequest: true,
      unreadCount: 0,
      version: 8,
    });
    const closed = createWhatsAppConversationFixture({
      ...conversation,
      conversationState: 'closed',
      flowStep: 'closed',
      assignedTo: null,
      closedAt: '2026-07-29T13:00:00.000Z',
      version: 9,
    });
    mockFetchDetail(conversation);
    mockedClose.mockResolvedValue({ success: true, conversation: closed });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    const closeButton = screen.getByRole('button', { name: 'Encerrar' });
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    await user.click(screen.getByRole('button', { name: 'Confirmar encerramento' }));

    await waitFor(() => {
      expect(mockedClose).toHaveBeenCalledWith({
        conversationId: conversation.id,
        expectedVersion: 8,
        reason: undefined,
      });
    });
  });

  it('mantém o estado autoritativo quando a API recusa o encerramento aprovado', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      requestStatus: 'approved',
      hasApprovedQuoteRequest: true,
      unreadCount: 0,
      version: 8,
    });
    mockFetchDetail(conversation);
    mockedClose.mockResolvedValue({
      success: false,
      code: 'conflict',
      message: 'A Tenant API recusou o encerramento.',
      conversation,
    });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    await user.click(screen.getByRole('button', { name: 'Encerrar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar encerramento' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          description: 'Não foi possível concluir a operação.',
        }),
      ),
    );
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        description: 'Não foi possível encerrar o atendimento. Tente novamente.',
      }),
    );
    expect(
      toastAdd.mock.calls.some(([notification]) =>
        JSON.stringify(notification).includes('Tenant API'),
      ),
    ).toBe(false);
    expect(screen.queryByText('A Tenant API recusou o encerramento.')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Confirmar encerramento' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Atendimento encerrado\. O próximo contato/)).not.toBeInTheDocument();
  });

  it('exibe data, responsável e motivo no histórico de encerramentos', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'closed',
      flowStep: 'closed',
      requestStatus: 'rejected',
      closedAt: '2026-07-28T13:00:00.000Z',
      unreadCount: 0,
      transitions: [
        {
          id: '00000000-0000-4000-8000-000000000911',
          commandId: '00000000-0000-4000-8000-000000000912',
          name: 'close',
          expectedVersion: 7,
          resultingVersion: 8,
          actorType: 'user',
          actorUserId: '00000000-0000-4000-8000-000000000913',
          actor: {
            type: 'user',
            user: {
              id: '00000000-0000-4000-8000-000000000913',
              name: 'Maria Atendente',
            },
          },
          from: {
            department: 'commercial',
            conversationState: 'human-active',
            flowStep: 'human-service',
            requestStatus: 'rejected',
          },
          to: {
            department: 'commercial',
            conversationState: 'closed',
            flowStep: 'closed',
            requestStatus: 'rejected',
          },
          metadata: { reason: 'Cliente recusou o valor.' },
          createdAt: '2026-07-28T13:00:00.000Z',
        },
      ],
    });
    mockFetchDetail(conversation);

    const user = userEvent.setup();
    render(<ConversationWorkspace initialConversations={[conversation]} />);

    expect(screen.queryByText('Encerrado por: Maria Atendente')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir orçamentos' }));
    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(
      screen.getByRole('heading', { name: 'Histórico de ações da conversa' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Atendimento encerrado')).toBeInTheDocument();
    expect(screen.getByText('Maria Atendente')).toBeInTheDocument();
    expect(screen.getByText('Cliente recusou o valor.')).toBeInTheDocument();
    expect(screen.getByText(/28\/07\/2026/)).toBeInTheDocument();
  });

  it('never offers the current department as a forwarding destination', async () => {
    const conversation = createWhatsAppConversationFixture({
      department: 'commercial',
      unreadCount: 0,
    });
    const forwarded = createWhatsAppConversationFixture({
      ...conversation,
      department: 'operations',
      conversationState: 'sent-to-human',
      version: 4,
    });
    mockFetchDetail(conversation);
    mockedForward.mockResolvedValue({ success: true, conversation: forwarded });
    const user = userEvent.setup();

    render(<ConversationWorkspace initialConversations={[conversation]} />);

    await user.click(screen.getByRole('button', { name: 'Encaminhar' }));
    const destination = screen.getByRole('combobox', { name: 'Departamento de destino' });
    await user.click(destination);
    const operationsOption = await screen.findByRole('option', { name: /Opera/ });
    expect(screen.queryByRole('option', { name: 'Comercial' })).not.toBeInTheDocument();
    await user.click(operationsOption);
    await user.click(screen.getByRole('button', { name: 'Confirmar encaminhamento' }));

    await waitFor(() => {
      expect(mockedForward).toHaveBeenCalledWith({
        conversationId: conversation.id,
        expectedVersion: conversation.version,
        targetDepartment: 'operations',
      });
    });
  });

  it('sends a human message with optimistic version and shows its pending state', async () => {
    const assignedTo = { id: 'employee-001', name: 'Usuário Comercial' };
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo,
      version: 8,
      unreadCount: 0,
      messages: [],
    });
    const message = {
      id: '00000000-0000-4000-8000-000000000701',
      direction: 'outbound' as const,
      deliveryStatus: 'pending' as const,
      kind: 'text' as const,
      text: 'Seu orçamento está em análise.',
      attachment: null,
      occurredAt: '2026-07-26T12:00:00.000Z',
      attempts: [],
    };
    const updated = createWhatsAppConversationFixture({
      ...conversation,
      version: 9,
      lastMessagePreview: message.text,
      lastMessageAt: message.occurredAt,
      lastOutboundAt: message.occurredAt,
      messages: [message],
    });
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response({ conversation }))
      .mockResolvedValue(response({ conversation: updated }));
    mockedSendMessage.mockResolvedValue({
      success: true,
      conversation: { ...updated, messages: [] },
      message,
    });
    const user = userEvent.setup();
    render(
      <ConversationWorkspace initialConversations={[conversation]} currentUserId={assignedTo.id} />,
    );
    await openMessages(user);
    await screen.findByText('Nenhuma mensagem registrada');

    const input = screen.getByRole('textbox', {
      name: `Mensagem para ${conversation.contact.name}`,
    });
    await user.type(input, message.text);
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    await waitFor(() => {
      expect(mockedSendMessage).toHaveBeenCalledWith({
        conversationId: conversation.id,
        commandId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
        expectedVersion: 8,
        text: message.text,
      });
    });
    expect(await screen.findAllByText(message.text)).toHaveLength(2);
    expect(screen.getAllByText(/Enviada por .* · \d{2}:\d{2}/)).not.toHaveLength(0);
    expect(
      screen.getAllByText('Mensagem salva. Aguardando confirmação de envio.'),
    ).not.toHaveLength(0);
    expect(input).toHaveValue('');
  });

  it('sends an image from the same chat composer with an optional caption', async () => {
    const assignedTo = { id: 'employee-001', name: 'Usuário Comercial' };
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo,
      version: 8,
      unreadCount: 0,
      messages: [],
    });
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response({ conversation }))
      .mockResolvedValueOnce(response({ message: { id: 'message-id' } }, 201))
      .mockResolvedValueOnce(response({ conversations: [conversation] }))
      .mockResolvedValueOnce(response({ conversation }));
    const user = userEvent.setup();
    render(
      <ConversationWorkspace initialConversations={[conversation]} currentUserId={assignedTo.id} />,
    );
    await openMessages(user);
    await screen.findByText('Nenhuma mensagem registrada');

    const file = new File(['imagem'], 'foto.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput!, file);
    await user.type(
      screen.getByRole('textbox', { name: `Mensagem para ${conversation.contact.name}` }),
      'Segue a foto solicitada.',
    );
    await user.click(screen.getByRole('button', { name: 'Enviar anexo' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/whatsapp-conversations/${conversation.id}/media`,
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      );
    });
    const mediaRequest = jest
      .mocked(global.fetch)
      .mock.calls.find(([url]) =>
        String(url).includes(`/api/whatsapp-conversations/${conversation.id}/media`),
      )?.[1];
    const formData = mediaRequest?.body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('caption')).toBe('Segue a foto solicitada.');
    expect(formData.get('expectedVersion')).toBe('8');
    expect(
      await screen.findAllByText('Anexo salvo. Aguardando confirmação de envio.'),
    ).not.toHaveLength(0);
  });

  it('sends through main Enter and numpad Enter while preserving Shift+Enter for a new line', async () => {
    const assignedTo = { id: 'employee-001', name: 'Usuário Comercial' };
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo,
      version: 8,
      unreadCount: 0,
      messages: [],
    });
    const firstMessage = {
      id: '00000000-0000-4000-8000-000000000721',
      direction: 'outbound' as const,
      deliveryStatus: 'pending' as const,
      kind: 'text' as const,
      text: 'Mensagem pelo Enter',
      attachment: null,
      sentBy: assignedTo,
      occurredAt: '2026-07-28T22:47:00.000Z',
      attempts: [],
    };
    const secondMessage = {
      ...firstMessage,
      id: '00000000-0000-4000-8000-000000000722',
      text: 'Mensagem pelo numpad',
      occurredAt: '2026-07-28T22:48:00.000Z',
    };
    const firstUpdated = createWhatsAppConversationFixture({
      ...conversation,
      version: 9,
      messages: [firstMessage],
    });
    const secondUpdated = createWhatsAppConversationFixture({
      ...conversation,
      version: 10,
      messages: [firstMessage, secondMessage],
    });
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response({ conversation }))
      .mockResolvedValue(response({ conversation: secondUpdated }));
    mockedSendMessage
      .mockResolvedValueOnce({
        success: true,
        conversation: firstUpdated,
        message: firstMessage,
      })
      .mockResolvedValueOnce({
        success: true,
        conversation: secondUpdated,
        message: secondMessage,
      });
    const user = userEvent.setup();
    render(
      <ConversationWorkspace initialConversations={[conversation]} currentUserId={assignedTo.id} />,
    );
    await openMessages(user);
    const input = screen.getByRole('textbox', {
      name: `Mensagem para ${conversation.contact.name}`,
    });

    await user.type(input, firstMessage.text);
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(mockedSendMessage).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(mockedSendMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(input).toBeEnabled());

    await user.type(input, secondMessage.text);
    fireEvent.keyDown(input, { key: 'Enter', code: 'NumpadEnter' });
    await waitFor(() => expect(mockedSendMessage).toHaveBeenCalledTimes(2));
    const firstMetadata = await screen.findByText('Enviada por Usuário Comercial · 19:47');
    expect(firstMetadata).toHaveClass('ml-auto', 'block', 'w-fit', 'text-[10px]');
    expect(firstMetadata).not.toHaveClass('min-w-max', 'whitespace-nowrap');
    expect(await screen.findByText('Enviada por Usuário Comercial · 19:48')).toBeInTheDocument();
  });

  it('permite reparar uma atribuição bloqueada pela ação consolidada do atendente', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-legacy', name: 'Responsável anterior' },
      unreadCount: 0,
    });
    const updated = createWhatsAppConversationFixture({
      ...conversation,
      conversationState: 'human-active',
      assignedTo: { id: 'employee-001', name: 'Usuário Comercial' },
      version: conversation.version + 1,
    });
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response({ conversation }))
      .mockResolvedValue(response({ conversation: updated }));
    mockedTakeOver.mockResolvedValue({ success: true, conversation: updated });
    const user = userEvent.setup();
    render(
      <ConversationWorkspace initialConversations={[conversation]} currentUserId="employee-001" />,
    );
    await openMessages(user);
    const takeOverButton = screen.getByRole('button', { name: 'Atendente inativo' });
    const sendButton = screen.getByRole('button', { name: 'Enviar mensagem' });
    const input = screen.getByRole('textbox', {
      name: `Mensagem para ${conversation.contact.name}`,
    });
    expect(screen.queryByText(/10\.000 caracteres/)).not.toBeInTheDocument();
    expect(sendButton).toHaveClass('shrink-0', 'rounded-full');
    expect(input).toBeDisabled();

    await user.click(takeOverButton);

    await waitFor(() =>
      expect(mockedTakeOver).toHaveBeenCalledWith({
        conversationId: conversation.id,
        expectedVersion: conversation.version,
      }),
    );
    await waitFor(() => expect(input).toBeEnabled());
  });

  it('preserves the draft and idempotency identifiers after a send conflict', async () => {
    const assignedTo = { id: 'employee-001', name: 'Usuário Comercial' };
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo,
      version: 4,
      unreadCount: 0,
    });
    const latest = createWhatsAppConversationFixture({
      ...conversation,
      assignedTo,
      version: 5,
    });
    mockFetchDetail(latest);
    mockedSendMessage
      .mockResolvedValueOnce({
        success: false,
        code: 'conflict',
        message: 'Conflito: o rascunho foi preservado.',
        conversation: latest,
      })
      .mockResolvedValueOnce({
        success: false,
        code: 'service-unavailable',
        message: 'Falha temporária; tente novamente.',
      });
    const user = userEvent.setup();
    render(
      <ConversationWorkspace initialConversations={[conversation]} currentUserId={assignedTo.id} />,
    );
    await openMessages(user);
    const input = screen.getByRole('textbox', {
      name: `Mensagem para ${conversation.contact.name}`,
    });
    await user.type(input, 'Rascunho importante');

    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          description: 'Conflito: o rascunho foi preservado.',
        }),
      ),
    );
    expect(input).toHaveValue('Rascunho importante');

    const firstInput = mockedSendMessage.mock.calls[0][0];
    const retryButton = await screen.findByRole('button', { name: 'Enviar mensagem' });
    await waitFor(() => expect(retryButton).toBeEnabled());
    await user.click(retryButton);
    await waitFor(() => expect(mockedSendMessage).toHaveBeenCalledTimes(2));
    const secondInput = mockedSendMessage.mock.calls[1][0];

    expect(secondInput).toMatchObject({
      commandId: firstInput.commandId,
      idempotencyKey: firstInput.idempotencyKey,
      expectedVersion: 5,
      text: firstInput.text,
    });
    expect(input).toHaveValue('Rascunho importante');
    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          description: 'Falha temporária; tente novamente.',
        }),
      ),
    );
  });

  it('preserves the original version after an ambiguous send failure', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    const assignedTo = { id: 'employee-001', name: 'Usuário Comercial' };
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo,
      version: 8,
      unreadCount: 0,
      messages: [],
    });
    const polledConversation = createWhatsAppConversationFixture({
      ...conversation,
      version: 9,
      updatedAt: '2026-07-26T12:05:00.000Z',
    });
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response({ conversation }))
      .mockResolvedValueOnce(response({ conversations: [polledConversation] }))
      .mockResolvedValueOnce(response({ conversation: polledConversation }));
    mockedSendMessage
      .mockResolvedValueOnce({
        success: false,
        code: 'service-unavailable',
        message: 'A resposta da API se perdeu; o resultado é incerto.',
      })
      .mockResolvedValueOnce({
        success: false,
        code: 'service-unavailable',
        message: 'Falha temporária.',
      });
    const user = userEvent.setup();
    render(
      <ConversationWorkspace initialConversations={[conversation]} currentUserId={assignedTo.id} />,
    );
    await openMessages(user);
    await screen.findByText('Nenhuma mensagem registrada');

    const input = screen.getByRole('textbox', {
      name: `Mensagem para ${conversation.contact.name}`,
    });
    await user.type(input, 'Mensagem com confirmação incerta');
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          description: 'Não foi possível concluir a operação.',
        }),
      ),
    );
    expect(
      screen.queryByText('A resposta da API se perdeu; o resultado é incerto.'),
    ).not.toBeInTheDocument();

    const firstInput = mockedSendMessage.mock.calls[0][0];
    await user.click(screen.getByRole('button', { name: 'Atualizar conversas' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    await waitFor(() => expect(mockedSendMessage).toHaveBeenCalledTimes(2));

    expect(mockedSendMessage.mock.calls[1][0]).toMatchObject({
      commandId: firstInput.commandId,
      idempotencyKey: firstInput.idempotencyKey,
      expectedVersion: 8,
      text: firstInput.text,
    });
  });

  it('refreshes a pending delivery even when the conversation version did not change', async () => {
    const pendingMessage = {
      id: '00000000-0000-4000-8000-000000000711',
      direction: 'outbound' as const,
      deliveryStatus: 'pending' as const,
      kind: 'text' as const,
      text: 'Mensagem aguardando Evolution.',
      attachment: null,
      occurredAt: '2026-07-26T12:00:00.000Z',
      attempts: [],
    };
    const failedMessage = {
      ...pendingMessage,
      deliveryStatus: 'failed' as const,
      attempts: [
        {
          id: '00000000-0000-4000-8000-000000000712',
          attemptNumber: 1,
          status: 'failed' as const,
          providerMessageId: null,
          errorCode: 'EVOLUTION_UNAVAILABLE',
          errorMessage: 'Evolution indisponível.',
          startedAt: '2026-07-26T12:00:00.000Z',
          completedAt: '2026-07-26T12:00:05.000Z',
        },
      ],
    };
    const summary = createWhatsAppConversationFixture({
      unreadCount: 0,
      version: 8,
      messages: [],
    });
    const pendingDetail = createWhatsAppConversationFixture({
      ...summary,
      messages: [pendingMessage],
    });
    const failedDetail = createWhatsAppConversationFixture({
      ...summary,
      messages: [failedMessage],
    });
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response({ conversation: pendingDetail }))
      .mockResolvedValueOnce(response({ conversations: [summary] }))
      .mockResolvedValueOnce(response({ conversation: failedDetail }));
    const user = userEvent.setup();
    render(<ConversationWorkspace initialConversations={[summary]} />);
    await openMessages(user);

    expect(await screen.findAllByText(/Enviada por .* · \d{2}:\d{2}/)).not.toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Atualizar conversas' }));

    expect(await screen.findAllByText(/Enviada por .* · \d{2}:\d{2}/)).not.toHaveLength(0);
    expect(
      screen.getByText('Não foi possível enviar esta mensagem. Tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Evolution indisponível.')).not.toBeInTheDocument();
    expect(screen.queryByText(/EVOLUTION_UNAVAILABLE/)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('blocks the composer until the current user owns a human-active conversation', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-002', name: 'Outro atendente' },
      unreadCount: 0,
    });
    mockFetchDetail(conversation);
    const user = userEvent.setup();
    render(
      <ConversationWorkspace initialConversations={[conversation]} currentUserId="employee-001" />,
    );
    await openMessages(user);

    expect(
      screen.getByRole('textbox', { name: `Mensagem para ${conversation.contact.name}` }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled();
    expect(
      screen.getByPlaceholderText('Assuma esta conversa para responder ao cliente.'),
    ).toBeInTheDocument();
  });

  it('polls only when visible and applies backoff after a failure', async () => {
    jest.useFakeTimers();
    const conversation = createWhatsAppConversationFixture({
      unreadCount: 0,
      messages: [],
    });
    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(response({ conversation }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(response({ conversations: [conversation] }));
    render(<ConversationWorkspace initialConversations={[conversation]} />);

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(7_999);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    await act(async () => {
      jest.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});
