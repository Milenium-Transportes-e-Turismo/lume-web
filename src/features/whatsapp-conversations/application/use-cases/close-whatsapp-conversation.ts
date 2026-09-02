import type { WhatsAppConversationRepository } from '../contracts';

export function closeWhatsAppConversation(
  repository: WhatsAppConversationRepository,
  conversationId: unknown,
  expectedVersion: unknown,
  reason?: unknown,
  commandId?: unknown,
  serviceSessionId?: unknown,
) {
  const normalizedReason =
    reason === null || reason === undefined
      ? null
      : typeof reason === 'string'
        ? reason.trim() || null
        : undefined;

  if (
    typeof conversationId !== 'string' ||
    conversationId.trim().length === 0 ||
    typeof expectedVersion !== 'number' ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    normalizedReason === undefined ||
    normalizedReason === null ||
    normalizedReason.length < 3 ||
    normalizedReason.length > 500 ||
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
    ? repository.closeConversation(conversationId.trim(), expectedVersion, normalizedReason)
    : repository.closeConversation(
        conversationId.trim(),
        expectedVersion,
        normalizedReason,
        commandId as string,
        serviceSessionId as string | undefined,
      );
}
