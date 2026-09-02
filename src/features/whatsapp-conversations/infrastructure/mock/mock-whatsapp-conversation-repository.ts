import 'server-only';

import {
  WhatsAppConversationRepositoryError,
  type ChangeWhatsAppServiceSessionPriorityCommand,
  type GetWhatsAppConversationsFilters,
  type SendHumanWhatsAppMessageCommand,
  type SendHumanWhatsAppMessageResult,
  type WhatsAppConversationRepository,
  type WhatsAppConversationPage,
  type WhatsAppMediaContent,
  type WhatsAppMessageSearchResult,
  type ReturnToQueueWhatsAppServiceSessionCommand,
  type TransferWhatsAppServiceSessionCommand,
} from '../../application';
import {
  getWhatsAppConversationMetrics,
  getCurrentWhatsAppServiceSession,
  type WhatsAppConversation,
  type WhatsAppConversationDepartment,
} from '../../domain';
import { INITIAL_MOCK_WHATSAPP_CONVERSATIONS } from './mock-whatsapp-conversations';

let mockConversations: WhatsAppConversation[] = [
  ...structuredClone(INITIAL_MOCK_WHATSAPP_CONVERSATIONS),
];

function cloneConversation(conversation: WhatsAppConversation): WhatsAppConversation {
  return structuredClone(conversation);
}

function getConversationIndex(conversationId: string): number {
  const index = mockConversations.findIndex((conversation) => conversation.id === conversationId);
  if (index < 0) {
    throw new WhatsAppConversationRepositoryError('not-found', 'Conversa não encontrada.');
  }
  return index;
}

function updateConversation(
  conversationId: string,
  expectedVersion: number,
  changes: Partial<WhatsAppConversation>,
): WhatsAppConversation {
  const index = getConversationIndex(conversationId);
  const current = mockConversations[index];

  if (current.version !== expectedVersion) {
    throw new WhatsAppConversationRepositoryError(
      'conflict',
      'A conversa foi alterada por outro comando.',
      current.version,
    );
  }

  const updated: WhatsAppConversation = {
    ...current,
    ...changes,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  mockConversations = mockConversations.map((conversation, currentIndex) =>
    currentIndex === index ? updated : conversation,
  );

  return cloneConversation(updated);
}

export class MockWhatsAppConversationRepository implements WhatsAppConversationRepository {
  async getServiceAssignmentTargets() {
    return [];
  }

  async startConversation(phone: string): Promise<WhatsAppConversation> {
    const existing = mockConversations.find(
      (conversation) => conversation.contact.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''),
    );
    if (existing) {
      return updateConversation(existing.id, existing.version, {
        conversationState: 'human-active',
        flowStep: 'human-service',
        assignedTo: { id: 'mock-user', name: 'Usuário de teste' },
        closedAt: null,
      });
    }

    const template = structuredClone(INITIAL_MOCK_WHATSAPP_CONVERSATIONS[0]);
    const now = new Date().toISOString();
    const conversation: WhatsAppConversation = {
      ...template,
      id: globalThis.crypto.randomUUID(),
      contact: {
        id: globalThis.crypto.randomUUID(),
        name: phone,
        phone,
        profilePictureUrl: null,
      },
      conversationState: 'human-active',
      flowStep: 'human-service',
      requestStatus: 'not-started',
      assignedTo: { id: 'mock-user', name: 'Usuário de teste' },
      unreadCount: 0,
      version: 2,
      lastInboundAt: null,
      lastOutboundAt: null,
      lastMessagePreview: '',
      lastMessageAt: now,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
      currentQuoteRequest: null,
      hasApprovedQuoteRequest: false,
      messages: [],
      transitions: [],
    };
    mockConversations = [conversation, ...mockConversations];
    return cloneConversation(conversation);
  }

  async getConversations(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<readonly WhatsAppConversation[]> {
    return (await this.getConversationPage(filters)).conversations;
  }

  async getConversationPage(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<WhatsAppConversationPage> {
    const search = filters?.search?.trim().toLocaleLowerCase('pt-BR');
    const filtered = mockConversations.filter(
      (conversation) =>
        (!filters?.department || conversation.department === filters.department) &&
        (!filters?.state || conversation.conversationState === filters.state) &&
        (filters?.archive === 'all' ||
          (filters?.archive === 'archived'
            ? conversation.archivedAt !== null
            : conversation.archivedAt === null)) &&
        (!filters?.control ||
          (filters.control === 'bot' && conversation.conversationState === 'bot-active') ||
          (filters.control === 'human' && conversation.conversationState === 'human-active') ||
          (filters.control === 'paused' &&
            (conversation.conversationState === 'waiting-for-customer' ||
              conversation.conversationState === 'sent-to-human')) ||
          (filters.control === 'closed' && conversation.conversationState === 'closed')) &&
        (!filters?.requestStatus ||
          (conversation.department === 'commercial' &&
            conversation.requestStatus === filters.requestStatus)) &&
        (!search ||
          `${conversation.contact.name} ${conversation.contact.phone}`
            .toLocaleLowerCase('pt-BR')
            .includes(search)),
    );
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 100;
    const conversations = filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map(cloneConversation);

    return {
      conversations,
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
      metrics: getWhatsAppConversationMetrics(filtered),
    };
  }

  getDashboardConversations(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<readonly WhatsAppConversation[]> {
    return this.getConversations(filters);
  }

  getDashboardConversationPage(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<WhatsAppConversationPage> {
    return this.getConversationPage(filters);
  }

  async getConversationById(conversationId: string): Promise<WhatsAppConversation | null> {
    const conversation = mockConversations.find((candidate) => candidate.id === conversationId);
    return conversation ? cloneConversation(conversation) : null;
  }

  async searchMessages(
    conversationId: string,
    search: string,
    page = 1,
  ): Promise<WhatsAppMessageSearchResult> {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation)
      throw new WhatsAppConversationRepositoryError('not-found', 'Conversa não encontrada.');
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    const messages = conversation.messages.filter((message) =>
      `${message.text ?? ''} ${message.attachment?.fileName ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalized),
    );
    return {
      messages,
      page,
      pageSize: 50,
      total: messages.length,
      totalPages: messages.length > 0 ? 1 : 0,
    };
  }

  async takeOverConversation(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return updateConversation(conversationId, expectedVersion, {
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: { id: 'mock-user', name: 'Usuário de teste' },
    });
  }

  async returnConversationToBot(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    const current = mockConversations[getConversationIndex(conversationId)];
    return updateConversation(conversationId, expectedVersion, {
      conversationState: 'bot-active',
      flowStep: current.requestStatus === 'not-started' ? 'main-menu' : 'commercial-follow-up-menu',
      assignedTo: null,
    });
  }

  async forwardConversation(
    conversationId: string,
    targetDepartment: WhatsAppConversationDepartment,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return updateConversation(conversationId, expectedVersion, {
      department: targetDepartment,
      conversationState: 'sent-to-human',
      flowStep: 'human-service',
      assignedTo: null,
    });
  }

  async returnConversationToQueue(
    conversationId: string,
    command: ReturnToQueueWhatsAppServiceSessionCommand,
  ): Promise<WhatsAppConversation> {
    const current = mockConversations[getConversationIndex(conversationId)];
    const serviceSession = getCurrentWhatsAppServiceSession(current);
    return updateConversation(conversationId, command.expectedVersion, {
      conversationState: 'sent-to-human',
      assignedTo: null,
      currentServiceSession: {
        ...serviceSession,
        responsibleUserId: null,
        responsible: null,
        status: 'WAITING_HUMAN',
        controlMode: 'HUMAN',
        queueId: command.queueId,
        version: serviceSession.version + 1,
      },
    });
  }

  async transferServiceSession(
    conversationId: string,
    command: TransferWhatsAppServiceSessionCommand,
  ): Promise<WhatsAppConversation> {
    const current = mockConversations[getConversationIndex(conversationId)];
    const serviceSession = getCurrentWhatsAppServiceSession(current);
    return updateConversation(conversationId, command.expectedVersion, {
      conversationState: 'sent-to-human',
      assignedTo: null,
      currentServiceSession: {
        ...serviceSession,
        currentDepartmentId: command.departmentId,
        queueId: command.queueId ?? null,
        responsibleUserId: command.userId ?? null,
        responsible: null,
        queue: null,
        version: serviceSession.version + 1,
      },
    });
  }

  async changeConversationPriority(
    conversationId: string,
    command: ChangeWhatsAppServiceSessionPriorityCommand,
  ): Promise<WhatsAppConversation> {
    const current = mockConversations[getConversationIndex(conversationId)];
    const serviceSession = getCurrentWhatsAppServiceSession(current);
    return updateConversation(conversationId, command.expectedVersion, {
      currentServiceSession: {
        ...serviceSession,
        priority: command.priority,
        priorityReason: command.reason?.trim() || null,
        prioritySource: 'HUMAN_USER',
        version: serviceSession.version + 1,
      },
    });
  }

  async changeConversationDepartment(
    conversationId: string,
    targetDepartment: WhatsAppConversationDepartment,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return updateConversation(conversationId, expectedVersion, {
      department: targetDepartment,
    });
  }

  async archiveConversation(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return updateConversation(conversationId, expectedVersion, {
      archivedAt: new Date().toISOString(),
      archiveReason: 'manual',
    });
  }

  async unarchiveConversation(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return updateConversation(conversationId, expectedVersion, {
      archivedAt: null,
      archiveReason: null,
    });
  }

  async markConversationAsRead(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return updateConversation(conversationId, expectedVersion, { unreadCount: 0 });
  }

  async closeConversationAfterRejection(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    const current = mockConversations[getConversationIndex(conversationId)];
    if (current.requestStatus !== 'rejected') {
      throw new WhatsAppConversationRepositoryError(
        'validation',
        'O atendimento só pode ser encerrado depois que a proposta for recusada.',
      );
    }

    return updateConversation(conversationId, expectedVersion, {
      conversationState: 'bot-active',
      flowStep: 'main-menu',
      assignedTo: null,
      unreadCount: 0,
      closedAt: null,
    });
  }

  async closeConversation(
    conversationId: string,
    expectedVersion: number,
    reason?: string | null,
  ): Promise<WhatsAppConversation> {
    const current = mockConversations[getConversationIndex(conversationId)];
    if (current.requestStatus === 'rejected' && !reason?.trim()) {
      throw new WhatsAppConversationRepositoryError(
        'validation',
        'Informe o motivo do encerramento da proposta recusada.',
      );
    }

    return updateConversation(conversationId, expectedVersion, {
      conversationState: 'bot-active',
      flowStep: 'main-menu',
      assignedTo: null,
      unreadCount: 0,
      closedAt: null,
    });
  }

  async sendHumanMessage(
    conversationId: string,
    command: SendHumanWhatsAppMessageCommand,
  ): Promise<SendHumanWhatsAppMessageResult> {
    const index = getConversationIndex(conversationId);
    const current = mockConversations[index];

    if (current.version !== command.expectedVersion) {
      throw new WhatsAppConversationRepositoryError(
        'conflict',
        'A conversa foi alterada por outro comando.',
        current.version,
      );
    }

    const occurredAt = new Date().toISOString();
    const message = {
      id: command.commandId,
      direction: 'outbound' as const,
      deliveryStatus: 'pending' as const,
      kind: 'text' as const,
      text: command.text,
      attachment: null,
      occurredAt,
      attempts: [],
    };
    const conversation = updateConversation(conversationId, command.expectedVersion, {
      lastOutboundAt: occurredAt,
      lastMessageAt: occurredAt,
      lastMessagePreview: command.text,
      messages: [...current.messages, message],
    });

    return { conversation, message };
  }

  async downloadMessageContent(): Promise<WhatsAppMediaContent> {
    throw new WhatsAppConversationRepositoryError(
      'not-found',
      'O arquivo não está disponível nos dados de demonstração.',
    );
  }

  async getMediaInterpretation(): Promise<never> {
    throw new WhatsAppConversationRepositoryError(
      'service-unavailable',
      'A interpretação de mídia exige a Tenant API real.',
    );
  }

  async analyzeMedia(): Promise<never> {
    throw new WhatsAppConversationRepositoryError(
      'service-unavailable',
      'A análise de mídia exige a Tenant API real.',
    );
  }

  async correctMediaInterpretation(): Promise<never> {
    throw new WhatsAppConversationRepositoryError(
      'service-unavailable',
      'A correção de mídia exige a Tenant API real.',
    );
  }
}

export function resetMockWhatsAppConversations(): void {
  mockConversations = [...structuredClone(INITIAL_MOCK_WHATSAPP_CONVERSATIONS)];
}
