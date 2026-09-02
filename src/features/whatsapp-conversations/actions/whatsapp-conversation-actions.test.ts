/** @jest-environment node */

import { revalidatePath } from 'next/cache';

import {
  AUTHENTICATED_SESSION_VERSION,
  type AuthenticatedSession,
  type Permission,
} from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import { WhatsAppConversationRepositoryError } from '../application';
import {
  forwardWhatsAppConversationForDashboard,
  markWhatsAppConversationAsReadForDashboard,
  pollWhatsAppConversationForDashboard,
  returnWhatsAppConversationToBotForDashboard,
  sendHumanWhatsAppMessageForDashboard,
  startWhatsAppConversationForDashboard,
  takeOverWhatsAppConversationForDashboard,
} from '../server';
import { createWhatsAppConversationFixture } from '../testing/whatsapp-conversation-fixture';
import {
  forwardWhatsAppConversationAction,
  markWhatsAppConversationAsReadAction,
  returnWhatsAppConversationToBotAction,
  sendHumanWhatsAppMessageAction,
  startWhatsAppConversationAction,
  takeOverWhatsAppConversationAction,
} from './whatsapp-conversation-actions';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/features/auth/server', () => ({
  getCurrentAuthenticatedSession: jest.fn(),
}));
jest.mock('../server', () => ({
  forwardWhatsAppConversationForDashboard: jest.fn(),
  markWhatsAppConversationAsReadForDashboard: jest.fn(),
  pollWhatsAppConversationForDashboard: jest.fn(),
  returnWhatsAppConversationToBotForDashboard: jest.fn(),
  sendHumanWhatsAppMessageForDashboard: jest.fn(),
  startWhatsAppConversationForDashboard: jest.fn(),
  takeOverWhatsAppConversationForDashboard: jest.fn(),
}));

const mockedSession = jest.mocked(getCurrentAuthenticatedSession);
const mockedTakeOver = jest.mocked(takeOverWhatsAppConversationForDashboard);
const mockedReturn = jest.mocked(returnWhatsAppConversationToBotForDashboard);
const mockedForward = jest.mocked(forwardWhatsAppConversationForDashboard);
const mockedMarkRead = jest.mocked(markWhatsAppConversationAsReadForDashboard);
const mockedSendMessage = jest.mocked(sendHumanWhatsAppMessageForDashboard);
const mockedStartConversation = jest.mocked(startWhatsAppConversationForDashboard);
const mockedPoll = jest.mocked(pollWhatsAppConversationForDashboard);

function createSession(
  permissions: readonly Permission[],
  departments: readonly string[] = ['commercial'],
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
    },
    issuedAt: '2026-07-21T12:00:00.000Z',
    expiresAt: '2026-07-21T20:00:00.000Z',
    rememberDevice: false,
  };
}

describe('WhatsApp conversation server actions', () => {
  beforeEach(() => {
    mockedSession.mockResolvedValue(createSession(['whatsapp-conversations:manage']));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('starts a human conversation for an authorized user', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
    });
    mockedStartConversation.mockResolvedValue(conversation);

    await expect(startWhatsAppConversationAction({ phone: '(34) 98765-4321' })).resolves.toEqual({
      success: true,
      conversation,
    });

    expect(mockedStartConversation).toHaveBeenCalledWith('(34) 98765-4321');
    expect(revalidatePath).toHaveBeenCalledWith('/whatsapp-conversations');
  });

  it('enforces whatsapp-conversations:manage before every write', async () => {
    mockedSession.mockResolvedValue(createSession(['dashboard:view']));

    await expect(
      takeOverWhatsAppConversationAction({
        conversationId: 'conversation-001',
        expectedVersion: 3,
      }),
    ).resolves.toMatchObject({ success: false, code: 'forbidden' });

    expect(mockedTakeOver).not.toHaveBeenCalled();
  });

  it('enforces the current Commercial scope even when the permission is present', async () => {
    mockedSession.mockResolvedValue(
      createSession(['whatsapp-conversations:manage'], ['operations']),
    );

    await expect(
      takeOverWhatsAppConversationAction({
        conversationId: 'conversation-001',
        expectedVersion: 3,
      }),
    ).resolves.toMatchObject({ success: false, code: 'forbidden' });

    expect(mockedTakeOver).not.toHaveBeenCalled();
  });

  it('passes expectedVersion to takeover and return-to-bot', async () => {
    const taken = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      version: 4,
    });
    const returned = createWhatsAppConversationFixture({
      conversationState: 'bot-active',
      flowStep: 'commercial-follow-up-menu',
      version: 5,
    });
    mockedTakeOver.mockResolvedValue(taken);
    mockedPoll.mockResolvedValueOnce(
      createWhatsAppConversationFixture({
        conversationState: 'human-active',
        flowStep: 'human-service',
        assignedTo: { id: 'employee-001', name: 'Usuário Comercial' },
        version: 4,
      }),
    );
    mockedReturn.mockResolvedValue(returned);

    await takeOverWhatsAppConversationAction({
      conversationId: taken.id,
      expectedVersion: 3,
    });
    await returnWhatsAppConversationToBotAction({
      conversationId: returned.id,
      expectedVersion: 4,
    });

    expect(mockedTakeOver).toHaveBeenCalledWith(taken.id, 3);
    expect(mockedReturn).toHaveBeenCalledWith(returned.id, 4);
    expect(revalidatePath).toHaveBeenCalledWith('/whatsapp-conversations');
  });

  it("does not return another attendant's conversation to the bot", async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-002', name: 'Outro atendente' },
      version: 4,
    });
    mockedPoll.mockResolvedValueOnce(conversation);

    await expect(
      returnWhatsAppConversationToBotAction({
        conversationId: conversation.id,
        expectedVersion: conversation.version,
      }),
    ).resolves.toMatchObject({
      success: false,
      code: 'forbidden',
      conversation,
    });

    expect(mockedReturn).not.toHaveBeenCalled();
  });

  it('reloads the current conversation and reports a 409 conflict', async () => {
    const latest = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      version: 9,
    });
    mockedTakeOver.mockRejectedValue(
      new WhatsAppConversationRepositoryError('conflict', 'A conversa foi alterada.', 9),
    );
    mockedPoll.mockResolvedValue(latest);

    await expect(
      takeOverWhatsAppConversationAction({
        conversationId: latest.id,
        expectedVersion: 8,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        code: 'conflict',
        conversation: latest,
      }),
    );
    expect(mockedPoll).toHaveBeenCalledWith(latest.id);
    expect(mockedTakeOver).toHaveBeenCalledTimes(1);
  });

  it('executes forward and mark-read only through their real API operations', async () => {
    const forwarded = createWhatsAppConversationFixture({
      department: 'operations',
      conversationState: 'sent-to-human',
      version: 4,
    });
    const read = createWhatsAppConversationFixture({ unreadCount: 0, version: 5 });
    mockedForward.mockResolvedValue(forwarded);
    mockedMarkRead.mockResolvedValue(read);

    await forwardWhatsAppConversationAction({
      conversationId: forwarded.id,
      targetDepartment: 'operations',
      expectedVersion: 3,
    });
    await markWhatsAppConversationAsReadAction({
      conversationId: read.id,
      expectedVersion: 4,
    });

    expect(mockedForward).toHaveBeenCalledWith(forwarded.id, 'operations', 3);
    expect(mockedMarkRead).toHaveBeenCalledWith(read.id, 4);
  });

  it('treats mark-read as successful when the 409 reload is already read', async () => {
    const read = createWhatsAppConversationFixture({ unreadCount: 0, version: 9 });
    mockedMarkRead.mockRejectedValueOnce(
      new WhatsAppConversationRepositoryError('conflict', 'A conversa foi alterada.', 9),
    );
    mockedPoll.mockResolvedValueOnce(read);

    await expect(
      markWhatsAppConversationAsReadAction({
        conversationId: read.id,
        expectedVersion: 8,
      }),
    ).resolves.toEqual({ success: true, conversation: read });

    expect(mockedMarkRead).toHaveBeenCalledTimes(1);
    expect(mockedMarkRead).toHaveBeenCalledWith(read.id, 8);
    expect(mockedPoll).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/whatsapp-conversations');
  });

  it('retries only mark-read once with the version returned by the 409 reload', async () => {
    const latest = createWhatsAppConversationFixture({ unreadCount: 3, version: 9 });
    const read = createWhatsAppConversationFixture({ unreadCount: 0, version: 10 });
    mockedMarkRead
      .mockRejectedValueOnce(
        new WhatsAppConversationRepositoryError('conflict', 'A conversa foi alterada.', 9),
      )
      .mockResolvedValueOnce(read);
    mockedPoll.mockResolvedValueOnce(latest);

    await expect(
      markWhatsAppConversationAsReadAction({
        conversationId: latest.id,
        expectedVersion: 8,
      }),
    ).resolves.toEqual({ success: true, conversation: read });

    expect(mockedMarkRead).toHaveBeenNthCalledWith(1, latest.id, 8);
    expect(mockedMarkRead).toHaveBeenNthCalledWith(2, latest.id, 9);
    expect(mockedMarkRead).toHaveBeenCalledTimes(2);
    expect(mockedTakeOver).not.toHaveBeenCalled();
    expect(mockedReturn).not.toHaveBeenCalled();
    expect(mockedForward).not.toHaveBeenCalled();
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });

  it('does not retry mark-read more than once after a second 409', async () => {
    const firstReload = createWhatsAppConversationFixture({ unreadCount: 3, version: 9 });
    const secondReload = createWhatsAppConversationFixture({ unreadCount: 1, version: 10 });
    mockedMarkRead
      .mockRejectedValueOnce(
        new WhatsAppConversationRepositoryError('conflict', 'A conversa foi alterada.', 9),
      )
      .mockRejectedValueOnce(
        new WhatsAppConversationRepositoryError('conflict', 'A conversa foi alterada.', 10),
      );
    mockedPoll.mockResolvedValueOnce(firstReload).mockResolvedValueOnce(secondReload);

    await expect(
      markWhatsAppConversationAsReadAction({
        conversationId: firstReload.id,
        expectedVersion: 8,
      }),
    ).resolves.toMatchObject({
      success: false,
      code: 'conflict',
      conversation: secondReload,
    });

    expect(mockedMarkRead).toHaveBeenNthCalledWith(1, firstReload.id, 8);
    expect(mockedMarkRead).toHaveBeenNthCalledWith(2, firstReload.id, 9);
    expect(mockedMarkRead).toHaveBeenCalledTimes(2);
    expect(mockedPoll).toHaveBeenCalledTimes(2);
  });

  it('sends an idempotent human message and returns the persisted pending message', async () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: { id: 'employee-001', name: 'Usuário Comercial' },
      version: 6,
    });
    const message = {
      id: '00000000-0000-4000-8000-000000000701',
      direction: 'outbound' as const,
      deliveryStatus: 'pending' as const,
      kind: 'text' as const,
      text: 'Sua solicitação está em análise.',
      attachment: null,
      occurredAt: '2026-07-26T12:00:00.000Z',
      attempts: [],
    };
    mockedSendMessage.mockResolvedValue({ conversation, message });
    const input = {
      conversationId: conversation.id,
      commandId: '00000000-0000-4000-8000-000000000702',
      idempotencyKey: '00000000-0000-4000-8000-000000000703',
      expectedVersion: 5,
      text: message.text,
    };

    await expect(sendHumanWhatsAppMessageAction(input)).resolves.toEqual({
      success: true,
      conversation,
      message,
    });
    expect(mockedSendMessage).toHaveBeenCalledWith(conversation.id, {
      commandId: input.commandId,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      text: input.text,
    });
  });

  it('preserves the current conversation when a human message conflicts', async () => {
    const latest = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      assignedTo: { id: 'employee-001', name: 'Usuário Comercial' },
      version: 12,
    });
    mockedSendMessage.mockRejectedValue(
      new WhatsAppConversationRepositoryError('conflict', 'Conversa alterada.', 12),
    );
    mockedPoll.mockResolvedValue(latest);

    await expect(
      sendHumanWhatsAppMessageAction({
        conversationId: latest.id,
        commandId: '00000000-0000-4000-8000-000000000702',
        idempotencyKey: '00000000-0000-4000-8000-000000000703',
        expectedVersion: 11,
        text: 'Mensagem preservada.',
      }),
    ).resolves.toMatchObject({
      success: false,
      code: 'conflict',
      conversation: latest,
    });
  });
});
