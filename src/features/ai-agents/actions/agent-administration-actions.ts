'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { hasPermission, type Permission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import { AgentAdministrationError } from '../application';
import type {
  AiAgentExecutionPage,
  AiAgentTenantInstructionVersion,
  ManagedAiAgent,
} from '../domain';
import {
  executeAuthenticatedAgentAdministrationMutation,
  executeAuthenticatedAgentAdministrationRequest,
} from '../server';

const executionsSchema = z.object({
  agentId: z.string().uuid(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(25),
});
const instructionsSchema = z.object({
  agentId: z.string().uuid(),
  commandId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  content: z.string().trim().min(1).max(20_000),
});
const agentSchema = z.object({ agentId: z.string().uuid() });
const rollbackSchema = z.object({
  agentId: z.string().uuid(),
  versionId: z.string().uuid(),
  commandId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
});

export type LoadAiAgentsResult =
  | { readonly success: true; readonly agents: readonly ManagedAiAgent[] }
  | { readonly success: false; readonly message: string; readonly publicCode: string };

export type LoadAiAgentExecutionsResult =
  | { readonly success: true; readonly executions: AiAgentExecutionPage }
  | { readonly success: false; readonly message: string; readonly publicCode: string };

export type UpdateTenantAgentInstructionsResult =
  | {
      readonly success: true;
      readonly message: string;
      readonly agentId: string;
      readonly promptVersionId: string;
      readonly version: number;
      readonly contentHash: string;
      readonly idempotent: boolean;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly publicCode: string;
      readonly agents?: readonly ManagedAiAgent[];
    };

export type LoadTenantAgentInstructionVersionsResult =
  | {
      readonly success: true;
      readonly versions: readonly AiAgentTenantInstructionVersion[];
    }
  | { readonly success: false; readonly message: string; readonly publicCode: string };

export type RollbackTenantAgentInstructionsResult =
  | {
      readonly success: true;
      readonly message: string;
      readonly versions: readonly AiAgentTenantInstructionVersion[];
      readonly version: number;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly publicCode: string;
      readonly versions?: readonly AiAgentTenantInstructionVersion[];
      readonly agents?: readonly ManagedAiAgent[];
    };

async function authorized(permission: Permission): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasPermission(session.user, permission);
}

function errorResult(error: unknown, fallback: string) {
  if (error instanceof AgentAdministrationError) {
    return { success: false as const, message: error.message, publicCode: error.publicCode };
  }
  return { success: false as const, message: fallback, publicCode: 'UNEXPECTED_ERROR' };
}

export async function loadAiAgentsAction(): Promise<LoadAiAgentsResult> {
  if (!(await authorized('ai-agents:view'))) {
    return {
      success: false,
      message: 'Você não tem permissão para consultar agentes de IA.',
      publicCode: 'FORBIDDEN',
    };
  }

  try {
    return {
      success: true,
      agents: await executeAuthenticatedAgentAdministrationRequest((gateway) =>
        gateway.listAgents(),
      ),
    };
  } catch (error) {
    return errorResult(error, 'Não foi possível carregar os agentes de IA.');
  }
}

export async function loadAiAgentExecutionsAction(
  input: unknown,
): Promise<LoadAiAgentExecutionsResult> {
  if (!(await authorized('ai-agents:view'))) {
    return {
      success: false,
      message: 'Você não tem permissão para consultar execuções de agentes.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = executionsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'O agente ou a paginação informada é inválida.',
      publicCode: 'VALIDATION_ERROR',
    };
  }

  try {
    return {
      success: true,
      executions: await executeAuthenticatedAgentAdministrationRequest((gateway) =>
        gateway.listExecutions(parsed.data.agentId, parsed.data.page, parsed.data.limit),
      ),
    };
  } catch (error) {
    return errorResult(error, 'Não foi possível carregar as execuções do agente.');
  }
}

export async function loadTenantAgentInstructionVersionsAction(
  input: unknown,
): Promise<LoadTenantAgentInstructionVersionsResult> {
  if (!(await authorized('ai-agents:manage'))) {
    return {
      success: false,
      message: 'Você não tem permissão para consultar o histórico de instruções.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = agentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'O agente informado é inválido.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    return {
      success: true,
      versions: await executeAuthenticatedAgentAdministrationRequest((gateway) =>
        gateway.listTenantInstructionVersions(parsed.data.agentId),
      ),
    };
  } catch (error) {
    return errorResult(error, 'Não foi possível carregar o histórico de instruções.');
  }
}

export async function updateTenantAgentInstructionsAction(
  input: unknown,
): Promise<UpdateTenantAgentInstructionsResult> {
  if (!(await authorized('ai-agents:manage'))) {
    return {
      success: false,
      message: 'Você não tem permissão para versionar instruções de agentes.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = instructionsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Revise as instruções informadas.',
      publicCode: 'VALIDATION_ERROR',
    };
  }

  try {
    const result = await executeAuthenticatedAgentAdministrationMutation((gateway) =>
      gateway.updateTenantInstructions(parsed.data.agentId, {
        commandId: parsed.data.commandId,
        expectedVersion: parsed.data.expectedVersion,
        content: parsed.data.content,
      }),
    );
    revalidatePath('/ai-agents');
    return {
      success: true,
      message: result.idempotent
        ? 'Esta versão das instruções já havia sido registrada.'
        : `Instruções publicadas na versão ${result.version}.`,
      ...result,
    };
  } catch (error) {
    const failure = errorResult(error, 'Não foi possível versionar as instruções do agente.');
    if (!(error instanceof AgentAdministrationError) || error.code !== 'conflict') return failure;

    try {
      return {
        ...failure,
        agents: await executeAuthenticatedAgentAdministrationRequest((gateway) =>
          gateway.listAgents(),
        ),
      };
    } catch {
      return failure;
    }
  }
}

export async function rollbackTenantAgentInstructionsAction(
  input: unknown,
): Promise<RollbackTenantAgentInstructionsResult> {
  if (!(await authorized('ai-agents:manage'))) {
    return {
      success: false,
      message: 'Você não tem permissão para restaurar instruções.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = rollbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'O agente, a versão de origem ou a versão esperada é inválida.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    const result = await executeAuthenticatedAgentAdministrationMutation((gateway) =>
      gateway.rollbackTenantInstructions(parsed.data.agentId, parsed.data.versionId, {
        commandId: parsed.data.commandId,
        expectedVersion: parsed.data.expectedVersion,
      }),
    );
    const versions = await executeAuthenticatedAgentAdministrationRequest((gateway) =>
      gateway.listTenantInstructionVersions(parsed.data.agentId),
    );
    revalidatePath('/ai-agents');
    return {
      success: true,
      message: result.idempotent
        ? `A restauração para a versão ${result.version} já havia sido registrada.`
        : `Conteúdo restaurado como nova versão ${result.version}.`,
      versions,
      version: result.version,
    };
  } catch (error) {
    const failure = errorResult(error, 'Não foi possível restaurar as instruções do agente.');
    if (!(error instanceof AgentAdministrationError) || error.code !== 'conflict') return failure;
    const [versions, agents] = await Promise.allSettled([
      executeAuthenticatedAgentAdministrationRequest((gateway) =>
        gateway.listTenantInstructionVersions(parsed.data.agentId),
      ),
      executeAuthenticatedAgentAdministrationRequest((gateway) => gateway.listAgents()),
    ]);
    return {
      ...failure,
      ...(versions.status === 'fulfilled' ? { versions: versions.value } : {}),
      ...(agents.status === 'fulfilled' ? { agents: agents.value } : {}),
    };
  }
}
