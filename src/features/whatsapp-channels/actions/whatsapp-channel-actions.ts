'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { hasPermission, type Permission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import { WhatsAppChannelGatewayError } from '../application';
import {
  WHATSAPP_CHANNEL_ROUTING_MODES,
  type ManagedWhatsAppChannel,
  type WhatsAppChannelAction,
  type WhatsAppChannelOperationResult,
  type WhatsAppChannelPairingStatus,
} from '../domain';
import {
  executeAuthenticatedWhatsAppChannelMutation,
  executeAuthenticatedWhatsAppChannelRequest,
} from '../server';

const nullableUuid = z.union([z.string().uuid(), z.null()]);
const configurationFields = {
  commandId: z.string().uuid(),
  displayName: z.string().trim().min(2).max(80),
  departmentId: nullableUuid,
  routingMode: z.enum(WHATSAPP_CHANNEL_ROUTING_MODES),
  allowedAutomaticTargetDepartmentIds: z.array(z.string().uuid()).max(100),
} as const;
const createSchema = z
  .object({
    ...configurationFields,
    phoneNumber: z.string().trim().min(10).max(30),
  })
  .superRefine((value, context) => {
    if (value.routingMode === 'department-owned' && !value.departmentId) {
      context.addIssue({
        code: 'custom',
        path: ['departmentId'],
        message: 'Informe o departamento proprietário.',
      });
    }
  });
const updateSchema = z
  .object({
    ...configurationFields,
    channelId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .superRefine((value, context) => {
    if (value.routingMode === 'department-owned' && !value.departmentId) {
      context.addIssue({
        code: 'custom',
        path: ['departmentId'],
        message: 'Informe o departamento proprietário.',
      });
    }
  });
const executeSchema = z.object({
  channelId: z.string().uuid(),
  action: z.enum([
    'request-qr',
    'reconnect',
    'synchronize-connection',
    'disconnect',
    'cancel-setup',
    'disable',
  ]),
  commandId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
});

export type WhatsAppChannelActionResult =
  | {
      readonly success: true;
      readonly message: string;
      readonly operation: WhatsAppChannelOperationResult;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly publicCode: string;
      readonly channel?: ManagedWhatsAppChannel;
    };

export type LoadWhatsAppChannelsResult =
  | { readonly success: true; readonly channels: readonly ManagedWhatsAppChannel[] }
  | { readonly success: false; readonly message: string; readonly publicCode: string };

const ACTION_PERMISSIONS: Readonly<Record<WhatsAppChannelAction, Permission>> = {
  'request-qr': 'whatsapp-channels:connect',
  reconnect: 'whatsapp-channels:connect',
  'synchronize-connection': 'whatsapp-channels:connect',
  disconnect: 'whatsapp-channels:disconnect',
  'cancel-setup': 'whatsapp-channels:manage',
  disable: 'whatsapp-channels:manage',
};

async function authorized(permission: Permission): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasPermission(session.user, permission);
}

function failure(
  error: unknown,
  fallback: string,
): Extract<WhatsAppChannelActionResult, { readonly success: false }> {
  if (error instanceof WhatsAppChannelGatewayError) {
    return { success: false, message: error.message, publicCode: error.publicCode };
  }
  return { success: false, message: fallback, publicCode: 'UNEXPECTED_ERROR' };
}

async function conflictChannel(error: unknown, channelId: string) {
  if (!(error instanceof WhatsAppChannelGatewayError) || error.code !== 'conflict')
    return undefined;
  try {
    return await executeAuthenticatedWhatsAppChannelRequest((gateway) => gateway.get(channelId));
  } catch {
    return undefined;
  }
}

export async function loadWhatsAppChannelsAction(): Promise<LoadWhatsAppChannelsResult> {
  if (!(await authorized('whatsapp-channels:view'))) {
    return {
      success: false,
      message: 'Você não tem permissão para consultar canais WhatsApp.',
      publicCode: 'FORBIDDEN',
    };
  }
  try {
    return {
      success: true,
      channels: await executeAuthenticatedWhatsAppChannelRequest((gateway) => gateway.list()),
    };
  } catch (error) {
    if (error instanceof WhatsAppChannelGatewayError) {
      return { success: false, message: error.message, publicCode: error.publicCode };
    }
    return {
      success: false,
      message: 'Não foi possível carregar os canais WhatsApp.',
      publicCode: 'UNEXPECTED_ERROR',
    };
  }
}

export async function createWhatsAppChannelAction(
  input: unknown,
): Promise<WhatsAppChannelActionResult> {
  if (!(await authorized('whatsapp-channels:create'))) {
    return {
      success: false,
      message: 'Você não tem permissão para provisionar canais WhatsApp.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Revise a configuração do canal.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    const operation = await executeAuthenticatedWhatsAppChannelMutation((gateway) =>
      gateway.create(parsed.data),
    );
    revalidatePath('/whatsapp-channels');
    return {
      success: true,
      operation,
      message: operation.providerIssue
        ? 'Canal salvo, mas a conexão precisa ser retomada.'
        : 'Canal criado e provisionamento iniciado.',
    };
  } catch (error) {
    return failure(error, 'Não foi possível provisionar o canal WhatsApp.');
  }
}

export async function updateWhatsAppChannelAction(
  input: unknown,
): Promise<WhatsAppChannelActionResult> {
  if (!(await authorized('whatsapp-channels:manage'))) {
    return {
      success: false,
      message: 'Você não tem permissão para configurar canais WhatsApp.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Revise a configuração do canal.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    const channel = await executeAuthenticatedWhatsAppChannelMutation((gateway) =>
      gateway.update(parsed.data.channelId, parsed.data),
    );
    revalidatePath('/whatsapp-channels');
    return {
      success: true,
      operation: {
        channel,
        qrCode: null,
        providerIssue: null,
        infrastructureCleanupPending: false,
      },
      message: 'Configuração do canal atualizada.',
    };
  } catch (error) {
    const channel = await conflictChannel(error, parsed.data.channelId);
    const result = failure(error, 'Não foi possível atualizar a configuração do canal.');
    return channel ? { ...result, channel } : result;
  }
}

export async function executeWhatsAppChannelAction(
  input: unknown,
): Promise<WhatsAppChannelActionResult> {
  const parsed = executeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'O canal, a ação ou a versão informada é inválida.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  if (!(await authorized(ACTION_PERMISSIONS[parsed.data.action]))) {
    return {
      success: false,
      message: 'Você não tem permissão para executar esta ação no canal.',
      publicCode: 'FORBIDDEN',
    };
  }
  try {
    const operation = await executeAuthenticatedWhatsAppChannelMutation((gateway) =>
      gateway.executeAction(parsed.data.channelId, parsed.data.action, {
        commandId: parsed.data.commandId,
        expectedVersion: parsed.data.expectedVersion,
      }),
    );
    revalidatePath('/whatsapp-channels');
    return {
      success: true,
      operation,
      message: operation.providerIssue
        ? 'O estado foi salvo, mas o provedor informou uma falha.'
        : 'Ação concluída no canal.',
    };
  } catch (error) {
    const channel = await conflictChannel(error, parsed.data.channelId);
    const result = failure(error, 'Não foi possível executar a ação no canal.');
    return channel ? { ...result, channel } : result;
  }
}

export async function loadWhatsAppChannelPairingAction(
  channelId: string,
): Promise<
  | { readonly success: true; readonly pairing: WhatsAppChannelPairingStatus }
  | { readonly success: false; readonly message: string; readonly publicCode: string }
> {
  if (!(await authorized('whatsapp-channels:connect'))) {
    return {
      success: false,
      message: 'Você não tem permissão para conectar este canal.',
      publicCode: 'FORBIDDEN',
    };
  }
  if (!z.string().uuid().safeParse(channelId).success) {
    return { success: false, message: 'Canal inválido.', publicCode: 'VALIDATION_ERROR' };
  }
  try {
    const pairing = await executeAuthenticatedWhatsAppChannelRequest((gateway) =>
      gateway.pairing(channelId),
    );
    return { success: true, pairing };
  } catch (error) {
    return failure(error, 'Não foi possível atualizar o QR code. Tente novamente.');
  }
}
