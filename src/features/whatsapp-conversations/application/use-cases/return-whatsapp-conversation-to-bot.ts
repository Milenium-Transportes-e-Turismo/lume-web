import type { WhatsAppConversationRepository } from '../contracts';

export function returnWhatsAppConversationToBot(
  repository: WhatsAppConversationRepository,
  conversationId: unknown,
  expectedVersion: unknown,
  commandId?: unknown,
  serviceSessionId?: unknown,
) {
  if (
    typeof conversationId !== 'string' ||
    conversationId.trim().length === 0 ||
    typeof expectedVersion !== 'number' ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    (commandId !== undefined &&
      (typeof commandId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
          commandId,
        ))) ||
    (serviceSessionId !== undefined &&
      (typeof serviceSessionId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
          serviceSessionId,
        )))
  ) {
    return Promise.resolve(null);
  }

  return commandId === undefined
    ? repository.returnConversationToBot(conversationId.trim(), expectedVersion)
    : repository.returnConversationToBot(
        conversationId.trim(),
        expectedVersion,
        commandId as string,
        serviceSessionId as string | undefined,
      );
}
