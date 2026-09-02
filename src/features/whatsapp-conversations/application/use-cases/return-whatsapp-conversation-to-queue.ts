import type { WhatsAppConversationRepository } from '../contracts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function returnWhatsAppConversationToQueue(
  repository: WhatsAppConversationRepository,
  conversationId: unknown,
  command: {
    readonly serviceSessionId: unknown;
    readonly commandId: unknown;
    readonly expectedVersion: unknown;
    readonly queueId: unknown;
  },
) {
  if (
    typeof conversationId !== 'string' ||
    conversationId.trim().length === 0 ||
    typeof command.serviceSessionId !== 'string' ||
    !UUID_PATTERN.test(command.serviceSessionId) ||
    typeof command.commandId !== 'string' ||
    !UUID_PATTERN.test(command.commandId) ||
    typeof command.expectedVersion !== 'number' ||
    !Number.isInteger(command.expectedVersion) ||
    command.expectedVersion < 1 ||
    typeof command.queueId !== 'string' ||
    !UUID_PATTERN.test(command.queueId)
  ) {
    return Promise.resolve(null);
  }

  return repository.returnConversationToQueue(conversationId.trim(), {
    serviceSessionId: command.serviceSessionId,
    commandId: command.commandId,
    expectedVersion: command.expectedVersion,
    queueId: command.queueId,
  });
}
