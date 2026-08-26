import 'server-only';

import {
  archiveWhatsAppConversation,
  changeWhatsAppConversationDepartment,
  closeWhatsAppConversation,
  closeWhatsAppConversationAfterRejection,
  forwardWhatsAppConversation,
  getWhatsAppConversationById,
  getWhatsAppDashboardConversations,
  getWhatsAppDashboardConversationPage,
  getWhatsAppConversationPage,
  getWhatsAppConversations,
  markWhatsAppConversationAsRead,
  returnWhatsAppConversationToBot,
  searchWhatsAppMessages,
  sendHumanWhatsAppMessage,
  startWhatsAppConversation,
  takeOverWhatsAppConversation,
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
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    takeOverWhatsAppConversation(repository, conversationId, expectedVersion),
  );
}

export function returnWhatsAppConversationToBotForDashboard(
  conversationId: unknown,
  expectedVersion: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    returnWhatsAppConversationToBot(repository, conversationId, expectedVersion),
  );
}

export function forwardWhatsAppConversationForDashboard(
  conversationId: unknown,
  targetDepartment: unknown,
  expectedVersion: unknown,
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    forwardWhatsAppConversation(repository, conversationId, targetDepartment, expectedVersion),
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
) {
  return executeAuthenticatedWhatsAppMutation((repository) =>
    closeWhatsAppConversation(repository, conversationId, expectedVersion, reason),
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
