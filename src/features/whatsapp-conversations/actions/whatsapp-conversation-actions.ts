'use server';

import { revalidatePath } from 'next/cache';

import { WhatsAppConversationRepositoryError } from '../application';
import type {
  WhatsAppConversation,
  WhatsAppConversationDepartment,
  WhatsAppMessage,
  WhatsAppServiceSessionPriority,
} from '../domain';
import {
  archiveWhatsAppConversationForDashboard,
  changeWhatsAppConversationDepartmentForDashboard,
  changeWhatsAppConversationPriorityForDashboard,
  closeWhatsAppConversationForDashboard,
  closeWhatsAppConversationAfterRejectionForDashboard,
  forwardWhatsAppConversationForDashboard,
  markWhatsAppConversationAsReadForDashboard,
  pollWhatsAppConversationForDashboard,
  returnWhatsAppConversationToBotForDashboard,
  returnWhatsAppConversationToQueueForDashboard,
  sendHumanWhatsAppMessageForDashboard,
  startWhatsAppConversationForDashboard,
  takeOverWhatsAppConversationForDashboard,
  transferWhatsAppServiceSessionForDashboard,
  unarchiveWhatsAppConversationForDashboard,
} from '../server';
import {
  hasLegacyWhatsAppManagement,
  hasServiceCapability,
  type ServiceCapability,
} from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

export interface VersionedWhatsAppConversationActionInput {
  readonly conversationId: unknown;
  readonly serviceSessionId?: unknown;
  readonly expectedVersion: unknown;
  readonly commandId?: unknown;
}

export interface ForwardWhatsAppConversationActionInput extends VersionedWhatsAppConversationActionInput {
  readonly targetDepartment: unknown;
}

export interface CloseWhatsAppConversationActionInput extends VersionedWhatsAppConversationActionInput {
  readonly reason?: unknown;
}

export interface ChangeWhatsAppConversationPriorityActionInput extends VersionedWhatsAppConversationActionInput {
  readonly commandId: unknown;
  readonly priority: unknown;
  readonly reason?: unknown;
}

export interface TransferWhatsAppServiceSessionActionInput extends VersionedWhatsAppConversationActionInput {
  readonly serviceSessionId: unknown;
  readonly commandId: unknown;
  readonly departmentId: unknown;
  readonly queueId?: unknown;
  readonly userId?: unknown;
  readonly reason?: unknown;
}

export interface ReturnWhatsAppConversationToQueueActionInput extends VersionedWhatsAppConversationActionInput {
  readonly serviceSessionId: unknown;
  readonly commandId: unknown;
  readonly queueId: unknown;
}

export interface SendHumanWhatsAppMessageActionInput extends VersionedWhatsAppConversationActionInput {
  readonly commandId: unknown;
  readonly idempotencyKey: unknown;
  readonly text: unknown;
}

export type WhatsAppConversationActionResult =
  | {
      readonly success: true;
      readonly conversation: WhatsAppConversation;
    }
  | {
      readonly success: false;
      readonly code:
        | 'unauthorized'
        | 'forbidden'
        | 'validation'
        | 'conflict'
        | 'not-found'
        | 'service-unavailable';
      readonly message: string;
      readonly conversation?: WhatsAppConversation;
    };

export type SendHumanWhatsAppMessageActionResult =
  | {
      readonly success: true;
      readonly conversation: WhatsAppConversation;
      readonly message: WhatsAppMessage;
    }
  | {
      readonly success: false;
      readonly code:
        | 'unauthorized'
        | 'forbidden'
        | 'validation'
        | 'conflict'
        | 'not-found'
        | 'service-unavailable';
      readonly message: string;
      readonly conversation?: WhatsAppConversation;
    };

export async function startWhatsAppConversationAction(input: {
  readonly phone: unknown;
}): Promise<WhatsAppConversationActionResult> {
  if (!(await isAuthorized('respond'))) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para iniciar uma conversa.',
    };
  }

  try {
    const conversation = await startWhatsAppConversationForDashboard(input.phone);
    if (conversation === null) {
      return {
        success: false,
        code: 'validation',
        message: 'Informe um número de WhatsApp válido com DDD.',
      };
    }
    return completeAction(conversation);
  } catch (error) {
    return standardActionFailure(error);
  }
}

async function isAuthorized(capability: ServiceCapability): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasServiceCapability(session.user, capability);
}

async function isLegacyManagementAuthorized(): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasLegacyWhatsAppManagement(session.user);
}

async function reloadAfterConflict(
  conversationId: unknown,
): Promise<WhatsAppConversation | undefined> {
  try {
    return (await pollWhatsAppConversationForDashboard(conversationId)) ?? undefined;
  } catch {
    return undefined;
  }
}

function completeAction(conversation: WhatsAppConversation): WhatsAppConversationActionResult {
  revalidatePath('/whatsapp-conversations');
  return { success: true, conversation };
}

function invalidVersionedAction(): WhatsAppConversationActionResult {
  return {
    success: false,
    code: 'validation',
    message: 'A conversa ou a versão informada é inválida.',
  };
}

function standardActionFailure(error: unknown): WhatsAppConversationActionResult {
  if (error instanceof WhatsAppConversationRepositoryError) {
    if (error.code === 'unauthorized') {
      return {
        success: false,
        code: 'unauthorized',
        message: 'Sua sessão expirou. Entre novamente.',
      };
    }

    if (error.code === 'forbidden' || error.code === 'validation' || error.code === 'not-found') {
      return {
        success: false,
        code: error.code,
        message: error.message,
      };
    }
  }

  return {
    success: false,
    code: 'service-unavailable',
    message: 'Não foi possível atualizar o atendimento.',
  };
}

function markReadConflict(conversation?: WhatsAppConversation): WhatsAppConversationActionResult {
  return {
    success: false,
    code: 'conflict',
    message:
      'Conflito: novas alterações foram registradas enquanto as mensagens eram marcadas como lidas. O atendimento foi recarregado.',
    ...(conversation ? { conversation } : {}),
  };
}

async function reconcileMarkReadAfterConflict(
  input: VersionedWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  const latest = await reloadAfterConflict(input.conversationId);

  if (!latest) {
    return markReadConflict();
  }

  if (latest.unreadCount === 0) {
    return completeAction(latest);
  }

  try {
    const retried = await markWhatsAppConversationAsReadForDashboard(
      input.conversationId,
      latest.version,
    );

    if (retried === null) {
      return invalidVersionedAction();
    }

    return completeAction(retried);
  } catch (error) {
    if (error instanceof WhatsAppConversationRepositoryError && error.code === 'conflict') {
      const current = await reloadAfterConflict(input.conversationId);

      if (current?.unreadCount === 0) {
        return completeAction(current);
      }

      return markReadConflict(current ?? latest);
    }

    return standardActionFailure(error);
  }
}

async function executeAction(
  input: VersionedWhatsAppConversationActionInput,
  capability: ServiceCapability | 'legacy-management',
  operation: (
    conversationId: unknown,
    expectedVersion: unknown,
    commandId?: unknown,
    serviceSessionId?: unknown,
  ) => Promise<WhatsAppConversation | null>,
): Promise<WhatsAppConversationActionResult> {
  const authorized =
    capability === 'legacy-management'
      ? await isLegacyManagementAuthorized()
      : await isAuthorized(capability);
  if (!authorized) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para alterar esta conversa.',
    };
  }

  try {
    const conversation =
      input.commandId === undefined
        ? await operation(input.conversationId, input.expectedVersion)
        : await operation(
            input.conversationId,
            input.expectedVersion,
            input.commandId,
            input.serviceSessionId,
          );

    if (conversation === null) {
      return invalidVersionedAction();
    }

    return completeAction(conversation);
  } catch (error) {
    if (error instanceof WhatsAppConversationRepositoryError && error.code === 'conflict') {
      const conversation = await reloadAfterConflict(input.conversationId);
      return {
        success: false,
        code: 'conflict',
        message:
          'Conflito: o atendimento foi alterado em outra sessão e foi recarregado. Revise o estado atual antes de tentar novamente.',
        ...(conversation ? { conversation } : {}),
      };
    }

    return standardActionFailure(error);
  }
}

export async function takeOverWhatsAppConversationAction(
  input: VersionedWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  return executeAction(input, 'assume', takeOverWhatsAppConversationForDashboard);
}

export async function returnWhatsAppConversationToBotAction(
  input: VersionedWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  return executeAction(input, 'transfer', returnWhatsAppConversationToBotForDashboard);
}

export async function returnWhatsAppConversationToQueueAction(
  input: ReturnWhatsAppConversationToQueueActionInput,
): Promise<WhatsAppConversationActionResult> {
  return executeAction(input, 'transfer', (conversationId, expectedVersion, commandId) =>
    returnWhatsAppConversationToQueueForDashboard(conversationId, {
      commandId,
      expectedVersion,
      serviceSessionId: input.serviceSessionId,
      queueId: input.queueId,
    }),
  );
}

export async function transferWhatsAppServiceSessionAction(
  input: TransferWhatsAppServiceSessionActionInput,
): Promise<WhatsAppConversationActionResult> {
  if (!(await isAuthorized('transfer'))) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para transferir este atendimento.',
    };
  }

  try {
    const conversation = await transferWhatsAppServiceSessionForDashboard(input.conversationId, {
      serviceSessionId: input.serviceSessionId,
      commandId: input.commandId,
      expectedVersion: input.expectedVersion,
      departmentId: input.departmentId,
      queueId: input.queueId,
      userId: input.userId,
      reason: input.reason,
    });
    if (conversation === null) return invalidVersionedAction();
    return completeAction(conversation);
  } catch (error) {
    if (error instanceof WhatsAppConversationRepositoryError && error.code === 'conflict') {
      const conversation = await reloadAfterConflict(input.conversationId);
      return {
        success: false,
        code: 'conflict',
        message:
          'Conflito: o atendimento foi alterado e recarregado. Revise os destinos antes de transferir novamente.',
        ...(conversation ? { conversation } : {}),
      };
    }
    return standardActionFailure(error);
  }
}

export async function changeWhatsAppConversationPriorityAction(
  input: ChangeWhatsAppConversationPriorityActionInput,
): Promise<WhatsAppConversationActionResult> {
  return executeAction(input, 'priority', (conversationId, expectedVersion, commandId) =>
    changeWhatsAppConversationPriorityForDashboard(conversationId, {
      commandId,
      expectedVersion,
      serviceSessionId: input.serviceSessionId,
      priority: input.priority as WhatsAppServiceSessionPriority,
      reason: input.reason,
    }),
  );
}

export async function markWhatsAppConversationAsReadAction(
  input: VersionedWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  if (!(await isAuthorized('respond'))) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para alterar esta conversa.',
    };
  }

  try {
    const conversation = await markWhatsAppConversationAsReadForDashboard(
      input.conversationId,
      input.expectedVersion,
    );

    if (conversation === null) {
      return invalidVersionedAction();
    }

    return completeAction(conversation);
  } catch (error) {
    if (error instanceof WhatsAppConversationRepositoryError && error.code === 'conflict') {
      return reconcileMarkReadAfterConflict(input);
    }

    return standardActionFailure(error);
  }
}

export async function closeWhatsAppConversationAfterRejectionAction(
  input: VersionedWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  return executeAction(input, 'close', closeWhatsAppConversationAfterRejectionForDashboard);
}

export async function closeWhatsAppConversationAction(
  input: CloseWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  return executeAction(
    input,
    'close',
    (conversationId, expectedVersion, commandId, serviceSessionId) =>
      commandId === undefined
        ? closeWhatsAppConversationForDashboard(conversationId, expectedVersion, input.reason)
        : closeWhatsAppConversationForDashboard(
            conversationId,
            expectedVersion,
            input.reason,
            commandId,
            serviceSessionId,
          ),
  );
}

export async function forwardWhatsAppConversationAction(
  input: ForwardWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  if (!(await isAuthorized('transfer'))) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para encaminhar esta conversa.',
    };
  }

  try {
    const conversation =
      input.commandId === undefined
        ? await forwardWhatsAppConversationForDashboard(
            input.conversationId,
            input.targetDepartment as WhatsAppConversationDepartment,
            input.expectedVersion,
          )
        : await forwardWhatsAppConversationForDashboard(
            input.conversationId,
            input.targetDepartment as WhatsAppConversationDepartment,
            input.expectedVersion,
            input.commandId,
          );

    if (conversation === null) {
      return {
        success: false,
        code: 'validation',
        message: 'A conversa, a versão ou o departamento informado é inválido.',
      };
    }

    revalidatePath('/whatsapp-conversations');
    return { success: true, conversation };
  } catch (error) {
    if (error instanceof WhatsAppConversationRepositoryError && error.code === 'conflict') {
      const conversation = await reloadAfterConflict(input.conversationId);
      return {
        success: false,
        code: 'conflict',
        message:
          'Conflito: o atendimento foi alterado em outra sessão e foi recarregado. Revise o estado atual antes de encaminhar.',
        ...(conversation ? { conversation } : {}),
      };
    }

    if (
      error instanceof WhatsAppConversationRepositoryError &&
      ['forbidden', 'validation', 'not-found'].includes(error.code)
    ) {
      return {
        success: false,
        code: error.code as 'forbidden' | 'validation' | 'not-found',
        message: error.message,
      };
    }

    return {
      success: false,
      code: 'service-unavailable',
      message: 'Não foi possível encaminhar o atendimento.',
    };
  }
}

export async function changeWhatsAppConversationDepartmentAction(
  input: ForwardWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  if (!(await isAuthorized('transfer'))) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para alterar o departamento desta conversa.',
    };
  }

  return executeAction(input, 'transfer', (conversationId, expectedVersion) =>
    changeWhatsAppConversationDepartmentForDashboard(
      conversationId,
      input.targetDepartment,
      expectedVersion,
    ),
  );
}

export async function archiveWhatsAppConversationAction(
  input: VersionedWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  return executeAction(input, 'legacy-management', archiveWhatsAppConversationForDashboard);
}

export async function unarchiveWhatsAppConversationAction(
  input: VersionedWhatsAppConversationActionInput,
): Promise<WhatsAppConversationActionResult> {
  return executeAction(input, 'legacy-management', unarchiveWhatsAppConversationForDashboard);
}

export async function sendHumanWhatsAppMessageAction(
  input: SendHumanWhatsAppMessageActionInput,
): Promise<SendHumanWhatsAppMessageActionResult> {
  if (!(await isAuthorized('respond'))) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para responder esta conversa.',
    };
  }

  try {
    const result = await sendHumanWhatsAppMessageForDashboard(input.conversationId, {
      commandId: input.commandId,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      text: input.text,
    });

    if (result === null) {
      return {
        success: false,
        code: 'validation',
        message: 'Informe uma mensagem de texto válida.',
      };
    }

    revalidatePath('/whatsapp-conversations');
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof WhatsAppConversationRepositoryError && error.code === 'conflict') {
      const conversation = await reloadAfterConflict(input.conversationId);
      return {
        success: false,
        code: 'conflict',
        message:
          'Conflito: a conversa mudou antes do envio. O rascunho foi preservado; revise o estado e tente novamente.',
        ...(conversation ? { conversation } : {}),
      };
    }

    if (error instanceof WhatsAppConversationRepositoryError) {
      if (error.code === 'unauthorized') {
        return {
          success: false,
          code: 'unauthorized',
          message: 'Sua sessão expirou. Entre novamente.',
        };
      }

      if (error.code === 'forbidden' || error.code === 'validation' || error.code === 'not-found') {
        return {
          success: false,
          code: error.code,
          message: error.message,
        };
      }
    }

    return {
      success: false,
      code: 'service-unavailable',
      message:
        'Não foi possível confirmar o registro da mensagem. O rascunho e os identificadores de reenvio foram preservados.',
    };
  }
}
