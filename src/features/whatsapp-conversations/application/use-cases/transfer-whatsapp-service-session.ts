import type { WhatsAppConversationRepository } from '../contracts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function transferWhatsAppServiceSession(
  repository: WhatsAppConversationRepository,
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
  const optionalUuid = (value: unknown) => value === undefined || UUID_PATTERN.test(String(value));
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
    typeof command.departmentId !== 'string' ||
    !UUID_PATTERN.test(command.departmentId) ||
    !optionalUuid(command.queueId) ||
    !optionalUuid(command.userId) ||
    (command.reason !== undefined && typeof command.reason !== 'string')
  ) {
    return Promise.resolve(null);
  }

  const reason = typeof command.reason === 'string' ? command.reason.trim() : '';
  if (reason && (reason.length < 3 || reason.length > 500)) return Promise.resolve(null);

  return repository.transferServiceSession(conversationId.trim(), {
    serviceSessionId: command.serviceSessionId,
    commandId: command.commandId,
    expectedVersion: command.expectedVersion,
    departmentId: command.departmentId,
    ...(typeof command.queueId === 'string' ? { queueId: command.queueId } : {}),
    ...(typeof command.userId === 'string' ? { userId: command.userId } : {}),
    ...(reason ? { reason } : {}),
  });
}
