import {
  canCloseWhatsAppConversation,
  canReturnWhatsAppConversationToBot,
  canSendHumanWhatsAppMessage,
  canTakeOverWhatsAppConversation,
  canWhatsAppBotReply,
  getCurrentWhatsAppServiceSession,
  isWhatsAppAwaitingProposal,
  isWhatsAppBotBlocked,
  isWhatsAppConversationDepartment,
  isWhatsAppConversationFlowStep,
  isWhatsAppConversationState,
  isWhatsAppQuoteSummaryConfirmed,
  isWhatsAppRequestStatus,
  WHATSAPP_CONVERSATION_DEPARTMENTS,
  WHATSAPP_CONVERSATION_FLOW_STEPS,
  WHATSAPP_CONVERSATION_STATES,
  WHATSAPP_REQUEST_STATUSES,
} from './whatsapp-conversation';
import { createWhatsAppConversationFixture } from '../../testing/whatsapp-conversation-fixture';

describe('WhatsApp conversation domain', () => {
  it.each(WHATSAPP_CONVERSATION_DEPARTMENTS)('accepts the %s department', (department) => {
    expect(isWhatsAppConversationDepartment(department)).toBe(true);
  });

  it.each(WHATSAPP_CONVERSATION_STATES)('accepts the %s conversation state', (state) => {
    expect(isWhatsAppConversationState(state)).toBe(true);
  });

  it.each(WHATSAPP_CONVERSATION_FLOW_STEPS)('accepts the %s flow step', (flowStep) => {
    expect(isWhatsAppConversationFlowStep(flowStep)).toBe(true);
  });

  it.each(WHATSAPP_REQUEST_STATUSES)('accepts the %s request status', (status) => {
    expect(isWhatsAppRequestStatus(status)).toBe(true);
  });

  it('projects legacy lifecycle, control and assignment as separate ServiceSession dimensions', () => {
    const conversation = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      assignedTo: null,
      version: 9,
    });

    expect(getCurrentWhatsAppServiceSession(conversation)).toMatchObject({
      id: conversation.id,
      status: 'WAITING_HUMAN',
      controlMode: 'HUMAN',
      responsibleUserId: null,
      queueId: null,
      priority: 'NORMAL',
      version: 9,
      projection: 'LEGACY_CONVERSATION',
      availableActions: ['ASSUME', 'TRANSFER_DEPARTMENT', 'CLOSE'],
    });
  });

  it.each(['new', '', null, undefined, 1])('rejects invalid taxonomy values %p', (value) => {
    expect(isWhatsAppConversationDepartment(value)).toBe(false);
    expect(isWhatsAppConversationState(value)).toBe(false);
    expect(isWhatsAppConversationFlowStep(value)).toBe(false);
    expect(isWhatsAppRequestStatus(value)).toBe(false);
  });

  it('allows automated replies only while the bot is active', () => {
    expect(canWhatsAppBotReply('bot-active')).toBe(true);

    for (const state of WHATSAPP_CONVERSATION_STATES) {
      if (state !== 'bot-active') {
        expect(canWhatsAppBotReply(state)).toBe(false);
      }
    }
  });

  it('blocks the bot in every canonical state except bot-active', () => {
    for (const conversationState of WHATSAPP_CONVERSATION_STATES) {
      expect(isWhatsAppBotBlocked(createWhatsAppConversationFixture({ conversationState }))).toBe(
        conversationState !== 'bot-active',
      );
    }
  });

  it('allows a human reply only in human-active with an assigned operator', () => {
    const assigned = createWhatsAppConversationFixture({
      conversationState: 'human-active',
      assignedTo: { id: 'employee-001', name: 'Atendente Comercial' },
    });

    expect(canSendHumanWhatsAppMessage(assigned)).toBe(true);
    expect(canSendHumanWhatsAppMessage({ ...assigned, assignedTo: null })).toBe(false);
    expect(
      canSendHumanWhatsAppMessage({
        ...assigned,
        conversationState: 'sent-to-human',
      }),
    ).toBe(false);
    expect(
      canSendHumanWhatsAppMessage({
        ...assigned,
        conversationState: 'bot-active',
      }),
    ).toBe(false);
  });

  it('returns only conversations with an active human attendant to the bot', () => {
    const waitingForAttendant = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      assignedTo: null,
    });

    expect(canReturnWhatsAppConversationToBot(waitingForAttendant)).toBe(false);
    expect(
      canReturnWhatsAppConversationToBot({
        ...waitingForAttendant,
        conversationState: 'human-active',
        assignedTo: { id: 'employee-001', name: 'Atendente Comercial' },
      }),
    ).toBe(true);
    expect(
      canReturnWhatsAppConversationToBot({
        ...waitingForAttendant,
        conversationState: 'waiting-for-customer',
        requestStatus: 'approved',
        hasApprovedQuoteRequest: true,
      }),
    ).toBe(false);
    expect(
      canReturnWhatsAppConversationToBot({
        ...waitingForAttendant,
        conversationState: 'waiting-for-customer',
        requestStatus: 'waiting-for-customer',
        hasApprovedQuoteRequest: false,
      }),
    ).toBe(false);
    expect(
      canReturnWhatsAppConversationToBot({
        ...waitingForAttendant,
        conversationState: 'waiting-for-customer',
        requestStatus: 'approved',
        hasApprovedQuoteRequest: true,
        assignedTo: { id: 'employee-001', name: 'Atendente Comercial' },
      }),
    ).toBe(false);
  });

  it('allows an authorized user to repair a stale blocked assignment by taking over', () => {
    const staleAssignment = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      assignedTo: { id: 'employee-legacy', name: 'Responsável anterior' },
    });

    expect(canTakeOverWhatsAppConversation(staleAssignment)).toBe(true);
    expect(
      canTakeOverWhatsAppConversation({
        ...staleAssignment,
        conversationState: 'human-active',
        assignedTo: null,
      }),
    ).toBe(true);
    expect(
      canTakeOverWhatsAppConversation({
        ...staleAssignment,
        conversationState: 'human-active',
      }),
    ).toBe(true);
    expect(
      canTakeOverWhatsAppConversation({
        ...staleAssignment,
        conversationState: 'closed',
      }),
    ).toBe(false);
  });

  it('keeps the approved-proposal close guard disabled during the MVP', () => {
    const closable = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      requestStatus: 'not-started',
      currentQuoteRequest: null,
      hasApprovedQuoteRequest: false,
    });

    expect(canCloseWhatsAppConversation(closable)).toBe(true);
    expect(
      canCloseWhatsAppConversation({
        ...closable,
        hasApprovedQuoteRequest: true,
      }),
    ).toBe(true);
  });

  it('keeps return-to-bot unavailable until a human attendant is active', () => {
    const waitingForAttendant = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      assignedTo: null,
    });

    expect(canReturnWhatsAppConversationToBot(waitingForAttendant)).toBe(false);
    expect(
      canReturnWhatsAppConversationToBot({
        ...waitingForAttendant,
        conversationState: 'human-active',
        assignedTo: { id: 'employee-001', name: 'Atendente Comercial' },
      }),
    ).toBe(true);
  });

  it('allows closing the human session while preserving a proposal in progress', () => {
    const closable = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      requestStatus: 'under-review',
      hasApprovedQuoteRequest: true,
    });

    expect(canCloseWhatsAppConversation(closable)).toBe(true);
  });

  it('recognizes a confirmed request awaiting a proposal and after a second contact', () => {
    const currentQuoteRequest = createWhatsAppConversationFixture().currentQuoteRequest;
    expect(currentQuoteRequest).not.toBeNull();
    const awaitingProposal = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      flowStep: 'quote-send-pending',
      requestStatus: 'under-review',
      currentQuoteRequest: {
        ...currentQuoteRequest!,
        status: 'under-review',
      },
    });
    const secondContact = createWhatsAppConversationFixture({
      conversationState: 'sent-to-human',
      flowStep: 'human-service',
      requestStatus: 'under-review',
      currentQuoteRequest: {
        ...currentQuoteRequest!,
        status: 'under-review',
      },
    });

    expect(isWhatsAppAwaitingProposal(awaitingProposal)).toBe(true);
    expect(isWhatsAppQuoteSummaryConfirmed(awaitingProposal)).toBe(true);
    expect(isWhatsAppQuoteSummaryConfirmed(secondContact)).toBe(true);
    expect(isWhatsAppAwaitingProposal(secondContact)).toBe(true);
    expect(
      isWhatsAppAwaitingProposal({
        ...secondContact,
        conversationState: 'closed',
      }),
    ).toBe(false);
    expect(
      isWhatsAppAwaitingProposal({
        ...secondContact,
        department: 'financial',
      }),
    ).toBe(false);
    expect(
      isWhatsAppAwaitingProposal({
        ...secondContact,
        currentQuoteRequest: null,
      }),
    ).toBe(false);
  });
});
