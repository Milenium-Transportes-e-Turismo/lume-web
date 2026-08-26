import type { WhatsAppConversationRepository } from '../contracts';
import { closeWhatsAppConversation } from './close-whatsapp-conversation';
import { closeWhatsAppConversationAfterRejection } from './close-whatsapp-conversation-after-rejection';
import { forwardWhatsAppConversation } from './forward-whatsapp-conversation';
import { getWhatsAppConversationById } from './get-whatsapp-conversation-by-id';
import {
  getWhatsAppConversations,
  getWhatsAppDashboardConversations,
} from './get-whatsapp-conversations';
import { markWhatsAppConversationAsRead } from './mark-whatsapp-conversation-as-read';
import { returnWhatsAppConversationToBot } from './return-whatsapp-conversation-to-bot';
import { sendHumanWhatsAppMessage } from './send-human-whatsapp-message';
import { startWhatsAppConversation } from './start-whatsapp-conversation';
import { takeOverWhatsAppConversation } from './take-over-whatsapp-conversation';

function createRepository(): jest.Mocked<WhatsAppConversationRepository> {
  return {
    startConversation: jest.fn(),
    getConversations: jest.fn(),
    getDashboardConversations: jest.fn(),
    getConversationPage: jest.fn(),
    getDashboardConversationPage: jest.fn(),
    getConversationById: jest.fn(),
    searchMessages: jest.fn(),
    takeOverConversation: jest.fn(),
    returnConversationToBot: jest.fn(),
    forwardConversation: jest.fn(),
    changeConversationDepartment: jest.fn(),
    archiveConversation: jest.fn(),
    unarchiveConversation: jest.fn(),
    markConversationAsRead: jest.fn(),
    closeConversationAfterRejection: jest.fn(),
    closeConversation: jest.fn(),
    sendHumanMessage: jest.fn(),
    downloadMessageContent: jest.fn(),
  };
}

describe('WhatsApp conversation use cases', () => {
  it('normalizes the phone before starting a conversation', async () => {
    const repository = createRepository();

    await startWhatsAppConversation(repository, ' (34) 98765-4321 ');
    await startWhatsAppConversation(repository, '123');

    expect(repository.startConversation).toHaveBeenCalledTimes(1);
    expect(repository.startConversation).toHaveBeenCalledWith('34987654321');
  });

  it('passes the real API list filters to the repository', async () => {
    const repository = createRepository();
    const filters = {
      page: 2,
      pageSize: 50,
      search: 'ana',
      state: 'bot-active' as const,
    };
    repository.getConversations.mockResolvedValue([]);

    await getWhatsAppConversations(repository, filters);

    expect(repository.getConversations).toHaveBeenCalledWith(filters);
  });

  it('uses the department-scoped dashboard read contract', async () => {
    const repository = createRepository();
    const filters = { department: 'operations' as const };
    repository.getDashboardConversations.mockResolvedValue([]);

    await getWhatsAppDashboardConversations(repository, filters);

    expect(repository.getDashboardConversations).toHaveBeenCalledWith(filters);
    expect(repository.getConversations).not.toHaveBeenCalled();
  });

  it('normalizes ids before loading a conversation', async () => {
    const repository = createRepository();
    repository.getConversationById.mockResolvedValue(null);

    await getWhatsAppConversationById(repository, ' conversation-001 ', 3);
    await getWhatsAppConversationById(repository, null);

    expect(repository.getConversationById).toHaveBeenCalledTimes(1);
    expect(repository.getConversationById).toHaveBeenCalledWith('conversation-001', 3);
  });

  it('passes expectedVersion to every write', async () => {
    const repository = createRepository();

    await takeOverWhatsAppConversation(repository, ' conversation-001 ', 7);
    await returnWhatsAppConversationToBot(repository, ' conversation-001 ', 8);
    await forwardWhatsAppConversation(repository, ' conversation-001 ', 'operations', 9);
    await markWhatsAppConversationAsRead(repository, ' conversation-001 ', 10);
    await closeWhatsAppConversationAfterRejection(repository, ' conversation-001 ', 11);
    await closeWhatsAppConversation(
      repository,
      ' conversation-001 ',
      12,
      '  Solicitação concluída. ',
    );

    expect(repository.takeOverConversation).toHaveBeenCalledWith('conversation-001', 7);
    expect(repository.returnConversationToBot).toHaveBeenCalledWith('conversation-001', 8);
    expect(repository.forwardConversation).toHaveBeenCalledWith(
      'conversation-001',
      'operations',
      9,
    );
    expect(repository.markConversationAsRead).toHaveBeenCalledWith('conversation-001', 10);
    expect(repository.closeConversationAfterRejection).toHaveBeenCalledWith('conversation-001', 11);
    expect(repository.closeConversation).toHaveBeenCalledWith(
      'conversation-001',
      12,
      'Solicitação concluída.',
    );
  });

  it('does not execute a write with invalid input or version', async () => {
    const repository = createRepository();

    await takeOverWhatsAppConversation(repository, '', 1);
    await returnWhatsAppConversationToBot(repository, 'conversation-001', 0);
    await forwardWhatsAppConversation(repository, 'conversation-001', 'invalid', 1);
    await markWhatsAppConversationAsRead(repository, 'conversation-001', Number.NaN);
    await closeWhatsAppConversationAfterRejection(repository, '', 1);
    await closeWhatsAppConversation(repository, 'conversation-001', 1, 'x');

    expect(repository.takeOverConversation).not.toHaveBeenCalled();
    expect(repository.returnConversationToBot).not.toHaveBeenCalled();
    expect(repository.forwardConversation).not.toHaveBeenCalled();
    expect(repository.markConversationAsRead).not.toHaveBeenCalled();
    expect(repository.closeConversationAfterRejection).not.toHaveBeenCalled();
    expect(repository.closeConversation).not.toHaveBeenCalled();
  });

  it('validates and normalizes an idempotent human message command', async () => {
    const repository = createRepository();
    const command = {
      commandId: '00000000-0000-4000-8000-000000000701',
      idempotencyKey: '00000000-0000-4000-8000-000000000702',
      expectedVersion: 11,
      text: '  Posso ajudar com mais alguma coisa?  ',
    };

    await sendHumanWhatsAppMessage(repository, ' conversation-001 ', command);

    expect(repository.sendHumanMessage).toHaveBeenCalledWith('conversation-001', {
      ...command,
      text: 'Posso ajudar com mais alguma coisa?',
    });
  });

  it('does not send an invalid or empty human message', async () => {
    const repository = createRepository();

    await sendHumanWhatsAppMessage(repository, 'conversation-001', {
      commandId: 'not-a-uuid',
      idempotencyKey: '00000000-0000-4000-8000-000000000702',
      expectedVersion: 1,
      text: 'Mensagem',
    });
    await sendHumanWhatsAppMessage(repository, 'conversation-001', {
      commandId: '00000000-0000-4000-8000-000000000701',
      idempotencyKey: '00000000-0000-4000-8000-000000000702',
      expectedVersion: 1,
      text: '   ',
    });

    expect(repository.sendHumanMessage).not.toHaveBeenCalled();
  });
});
