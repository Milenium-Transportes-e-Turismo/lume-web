import {
  isWhatsAppConversationDepartment,
  type WhatsAppConversationDepartment,
} from '../../domain';
import type { WhatsAppConversationRepository } from '../contracts';

export function forwardWhatsAppConversation(
  repository: WhatsAppConversationRepository,
  conversationId: unknown,
  targetDepartment: unknown,
  expectedVersion: unknown,
  commandId?: unknown,
) {
  if (
    typeof conversationId !== 'string' ||
    conversationId.trim().length === 0 ||
    !isWhatsAppConversationDepartment(targetDepartment) ||
    typeof expectedVersion !== 'number' ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    (commandId !== undefined &&
      (typeof commandId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
          commandId,
        )))
  ) {
    return Promise.resolve(null);
  }

  return commandId === undefined
    ? repository.forwardConversation(
        conversationId.trim(),
        targetDepartment as WhatsAppConversationDepartment,
        expectedVersion,
      )
    : repository.forwardConversation(
        conversationId.trim(),
        targetDepartment as WhatsAppConversationDepartment,
        expectedVersion,
        commandId as string,
      );
}
