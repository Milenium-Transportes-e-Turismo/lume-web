import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getCurrentWhatsAppServiceSession } from '../domain';
import { createWhatsAppConversationFixture } from '../testing/whatsapp-conversation-fixture';
import { ConversationServiceContextPanel } from './conversation-service-context-panel';

function handlers() {
  return {
    onBack: jest.fn(),
    onAssume: jest.fn(),
    onTransfer: jest.fn(),
    onReturnToQueue: jest.fn(),
    onChangePriority: jest.fn(),
    onReturnToAi: jest.fn(),
    onClose: jest.fn(),
    onArchiveToggle: jest.fn(),
    onCommercialStatus: jest.fn(),
    canChangeCommercialStatus: true,
    canAssume: true,
    canTransfer: true,
    canChangePriority: true,
    canReturnToAi: true,
    canClose: true,
    canArchive: true,
  };
}

describe('ConversationServiceContextPanel', () => {
  it('keeps status, control and assignment separate and exposes sources and tools', async () => {
    const user = userEvent.setup();
    const actions = handlers();
    const conversation = createWhatsAppConversationFixture({
      sourceChannel: {
        id: 'channel-1',
        name: 'WhatsApp Matriz',
        type: 'WHATSAPP',
        address: '5531999990000',
      },
      currentServiceSession: {
        id: 'session-1',
        companyId: 'company-1',
        threadId: 'thread-1',
        sourceChannelId: 'channel-1',
        currentDepartmentId: 'commercial',
        responsibleUserId: 'user-1',
        queueId: 'queue-1',
        relatedServiceSessionId: null,
        status: 'WAITING_CUSTOMER',
        controlMode: 'HUMAN',
        priority: 'HIGH',
        priorityReason: 'Prazo próximo',
        prioritySource: 'HUMAN_USER',
        isForeground: true,
        version: 13,
        responsible: { id: 'user-1', name: 'Maria Souza' },
        queue: { id: 'queue-1', name: 'Comercial prioritário' },
        availableActions: [
          'ASSUME',
          'RETURN_TO_QUEUE',
          'TRANSFER_DEPARTMENT',
          'CHANGE_PRIORITY',
          'RETURN_TO_AI',
          'CLOSE',
        ],
        projection: 'NATIVE',
        publicContinuationCode: null,
        continuationCodeExpiresAt: null,
        closingStartedAt: null,
        closingDeadlineAt: null,
        closedAt: null,
      },
      evidence: {
        agentExecutions: [
          {
            id: 'execution-1',
            name: 'Agente comercial',
            status: 'SUCCEEDED',
            summary: 'Classificou a intenção.',
            provider: 'OpenAI',
            model: 'gpt-5.4',
            url: null,
            occurredAt: null,
            metadata: {},
          },
        ],
        knowledgeSources: [
          {
            id: 'source-1',
            name: 'Política comercial v4',
            status: 'PUBLISHED',
            summary: 'Condições comerciais vigentes.',
            url: 'https://docs.example.test/politica',
            occurredAt: null,
            metadata: {},
          },
        ],
        toolExecutions: [
          {
            id: 'tool-1',
            name: 'consultar_disponibilidade',
            status: 'SUCCEEDED',
            summary: null,
            url: null,
            occurredAt: null,
            metadata: {},
          },
        ],
        mediaInterpretations: [],
        registrationDataReviews: [],
      },
    });

    render(
      <ConversationServiceContextPanel conversation={conversation} isBusy={false} {...actions} />,
    );

    expect(screen.getByText('Aguardando cliente')).toBeInTheDocument();
    expect(screen.getByText('Humano')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Comercial prioritário')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Matriz')).toBeInTheDocument();
    expect(screen.getByText('OpenAI · gpt-5.4')).toBeInTheDocument();
    expect(screen.getByText('Política comercial v4')).toBeInTheDocument();
    expect(screen.getByText('consultar_disponibilidade')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retornar à fila' }));
    await user.click(screen.getByRole('button', { name: 'Retornar à IA' }));
    expect(actions.onReturnToQueue).toHaveBeenCalledTimes(1);
    expect(actions.onReturnToAi).toHaveBeenCalledTimes(1);
  });

  it('does not fake queue and priority mutations while only the legacy façade is available', () => {
    render(
      <ConversationServiceContextPanel
        conversation={createWhatsAppConversationFixture()}
        isBusy={false}
        {...handlers()}
      />,
    );

    expect(screen.getByText(/Compatibilidade legada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retornar à fila' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('keeps every service action disabled without its explicit capability', () => {
    const baseConversation = createWhatsAppConversationFixture();
    const conversation = createWhatsAppConversationFixture({
      currentServiceSession: {
        ...getCurrentWhatsAppServiceSession(baseConversation),
        projection: 'NATIVE',
        availableActions: [
          'ASSUME',
          'RETURN_TO_QUEUE',
          'TRANSFER_DEPARTMENT',
          'CHANGE_PRIORITY',
          'RETURN_TO_AI',
          'CLOSE',
        ],
      },
    });

    render(
      <ConversationServiceContextPanel
        conversation={conversation}
        isBusy={false}
        {...handlers()}
        canAssume={false}
        canTransfer={false}
        canChangePriority={false}
        canReturnToAi={false}
        canClose={false}
        canArchive={false}
      />,
    );

    for (const name of [
      'Arquivar',
      'Assumir',
      'Transferir',
      'Retornar à fila',
      'Retornar à IA',
      'Aplicar',
      'Encerrar conversa',
    ]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
