import 'server-only';

import {
  archiveWhatsAppConversation,
  changeWhatsAppConversationDepartment,
  changeWhatsAppConversationPriority,
  closeWhatsAppConversation,
  closeWhatsAppConversationAfterRejection,
  forwardWhatsAppConversation,
  getWhatsAppConversationById,
  getWhatsAppDashboardConversations,
  getWhatsAppDashboardConversationPage,
  getWhatsAppConversationPage,
  getWhatsAppConversations,
  getWhatsAppServiceAssignmentTargets,
  markWhatsAppConversationAsRead,
  returnWhatsAppConversationToBot,
  returnWhatsAppConversationToQueue,
  searchWhatsAppMessages,
  sendHumanWhatsAppMessage,
  startWhatsAppConversation,
  takeOverWhatsAppConversation,
  transferWhatsAppServiceSession,
  unarchiveWhatsAppConversation,
  type GetWhatsAppConversationsFilters,
} from '../application';
import {
  executeAuthenticatedWhatsAppMutation,
  executeAuthenticatedWhatsAppRequest,
} from './execute-authenticated-whatsapp-request';

export function getWhatsAppConversationsForDashboard(filters?: GetWhatsAppConversationsFilters) {
  return executeAuthenticatedWhatsAppRequest((repository) =>
    getWhatsAppConversations(repository, filters),
  );
}

export function getWhatsAppServiceAssignmentTargetsForDashboard() {
  return executeAuthenticatedWhatsAppRequest((repository) =>
    getWhatsAppServiceAssignmentTargets(repository),
  );
}

export function getWhatsAppConversationPageForDashboard(filters?: GetWhatsAppConversationsFilters) {
  return executeAuthenticatedWhatsAppRequest((repository) =>
    getWhatsAppConversationPage(repository, filters),
  );
}

export function startWhatsAppConversationForDashboard(phone: unknown) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    startWhatsAppConversation(repository, phone),
  );
}

export function getWhatsAppConversationsForOperationalDashboard(
  filters?: GetWhatsAppConversationsFilters,
) {
  return executeAuthenticatedWhatsAppRequest((repository) =>
    getWhatsAppDashboardConversations(repository, filters),
  );
}

export function getWhatsAppConversationPageForOperationalDashboard(
  filters?: GetWhatsAppConversationsFilters,
) {
  return executeAuthenticatedWhatsAppRequest((repository) =>
    getWhatsAppDashboardConversationPage(repository, filters),
  );
}

export function pollWhatsAppConversationsForDashboard(filters?: GetWhatsAppConversationsFilters) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    getWhatsAppConversations(repository, filters),
  );
}

export function pollWhatsAppConversationPageForDashboard(
  filters?: GetWhatsAppConversationsFilters,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    getWhatsAppConversationPage(repository, filters),
  );
}

export function searchWhatsAppMessagesForDashboard(
  conversationId: unknown,
  search: unknown,
  page: unknown = 1,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    searchWhatsAppMessages(repository, conversationId, search, page),
  );
}

export function getWhatsAppConversationForDashboard(conversationId: unknown) {
  return executeAuthenticatedWhatsAppRequest((repository) =>
    getWhatsAppConversationById(repository, conversationId),
  );
}

export function getWhatsAppMediaInterpretationForDashboard(
  conversationId: string,
  messageId: string,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    repository.getMediaInterpretation(conversationId, messageId),
  );
}

export function analyzeWhatsAppMediaForDashboard(conversationId: string, messageId: string) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    repository.analyzeMedia(conversationId, messageId),
  );
}

export function correctWhatsAppMediaInterpretationForDashboard(
  conversationId: string,
  messageId: string,
  correction: string,
  feedback?: string,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    repository.correctMediaInterpretation(conversationId, messageId, correction, feedback),
  );
}

export function pollWhatsAppConversationForDashboard(
  conversationId: unknown,
  messagePage: unknown = 1,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    getWhatsAppConversationById(repository, conversationId, messagePage),
  );
}

export function takeOverWhatsAppConversationForDashboard(
  conversationId: unknown,
  expectedVersion: unknown,
  commandId?: unknown,
  serviceSessionId?: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    commandId === undefined
      ? takeOverWhatsAppConversation(repository, conversationId, expectedVersion)
      : takeOverWhatsAppConversation(
          repository,
          conversationId,
          expectedVersion,
          commandId,
          serviceSessionId,
        ),
  );
}

export function returnWhatsAppConversationToBotForDashboard(
  conversationId: unknown,
  expectedVersion: unknown,
  commandId?: unknown,
  serviceSessionId?: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    commandId === undefined
      ? returnWhatsAppConversationToBot(repository, conversationId, expectedVersion)
      : returnWhatsAppConversationToBot(
          repository,
          conversationId,
          expectedVersion,
          commandId,
          serviceSessionId,
        ),
  );
}

export function returnWhatsAppConversationToQueueForDashboard(
  conversationId: unknown,
  command: {
    readonly serviceSessionId: unknown;
    readonly commandId: unknown;
    readonly expectedVersion: unknown;
    readonly queueId: unknown;
  },
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    returnWhatsAppConversationToQueue(repository, conversationId, command),
  );
}

export function transferWhatsAppServiceSessionForDashboard(
  conversationId: unknown,
  command: {
    readonly serviceSessionId: unknown;
    readonly commandId: unknown;
    readonly expectedVersion: unknown;
    readonly departmentId: unknown;
    readonly queueId?: unknown;
    readonly userId?: unknown;
    readonly reason?: unknown;
  },
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    transferWhatsAppServiceSession(repository, conversationId, command),
  );
}

export function changeWhatsAppConversationPriorityForDashboard(
  conversationId: unknown,
  command: {
    readonly serviceSessionId: unknown;
    readonly commandId: unknown;
    readonly expectedVersion: unknown;
    readonly priority: unknown;
    readonly reason?: unknown;
  },
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    changeWhatsAppConversationPriority(repository, conversationId, command),
  );
}

export function forwardWhatsAppConversationForDashboard(
  conversationId: unknown,
  targetDepartment: unknown,
  expectedVersion: unknown,
  commandId?: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    commandId === undefined
      ? forwardWhatsAppConversation(repository, conversationId, targetDepartment, expectedVersion)
      : forwardWhatsAppConversation(
          repository,
          conversationId,
          targetDepartment,
          expectedVersion,
          commandId,
        ),
  );
}

export function changeWhatsAppConversationDepartmentForDashboard(
  conversationId: unknown,
  targetDepartment: unknown,
  expectedVersion: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    changeWhatsAppConversationDepartment(
      repository,
      conversationId,
      targetDepartment,
      expectedVersion,
    ),
  );
}

export function archiveWhatsAppConversationForDashboard(
  conversationId: unknown,
  expectedVersion: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    archiveWhatsAppConversation(repository, conversationId, expectedVersion),
  );
}

export function unarchiveWhatsAppConversationForDashboard(
  conversationId: unknown,
  expectedVersion: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    unarchiveWhatsAppConversation(repository, conversationId, expectedVersion),
  );
}

export function markWhatsAppConversationAsReadForDashboard(
  conversationId: unknown,
  expectedVersion: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    markWhatsAppConversationAsRead(repository, conversationId, expectedVersion),
  );
}

export function closeWhatsAppConversationAfterRejectionForDashboard(
  conversationId: unknown,
  expectedVersion: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    closeWhatsAppConversationAfterRejection(repository, conversationId, expectedVersion),
  );
}

export function closeWhatsAppConversationForDashboard(
  conversationId: unknown,
  expectedVersion: unknown,
  reason?: unknown,
  commandId?: unknown,
  serviceSessionId?: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    closeWhatsAppConversation(
      repository,
      conversationId,
      expectedVersion,
      reason,
      commandId,
      serviceSessionId,
    ),
  );
}

export function sendHumanWhatsAppMessageForDashboard(
  conversationId: unknown,
  command: {
    readonly commandId: unknown;
    readonly idempotencyKey: unknown;
    readonly expectedVersion: unknown;
    readonly text: unknown;
  },
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    sendHumanWhatsAppMessage(repository, conversationId, command),
  );
}

export function downloadWhatsAppMessageContentForDashboard(
  conversationId: string,
  messageId: string,
) {
  return executeAuthenticatedWhatsAppRequest((repository) =>
    repository.downloadMessageContent(conversationId, messageId),
  );
}

export function resolveWhatsAppAssistantSuggestionForDashboard(
  input: import('../application/contracts/whatsapp-conversation-repository').ResolveWhatsAppAssistantSuggestionCommand,
) {
  return executeAuthenticatedWhatsAppMutation((repository) => {
    if (!repository.resolveAssistantSuggestion)
      throw new Error('Sugestões internas indisponíveis neste ambiente.');
    return repository.resolveAssistantSuggestion(input);
  });
}
