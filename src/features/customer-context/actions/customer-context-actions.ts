'use server';

import { z } from 'zod';

import { hasServiceCapability, type ServiceCapability } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import { CustomerContextGatewayError } from '../application';
import type {
  CustomerContextDetailPage,
  CustomerContextSummary,
  CustomerProfileSuggestion,
} from '../domain';
import {
  executeAuthenticatedCustomerContextMutation,
  executeAuthenticatedCustomerContextRequest,
} from '../server';

const sessionSchema = z.object({ serviceSessionId: z.string().uuid() });
const detailsSchema = sessionSchema.extend({
  section: z.enum(['relationships', 'profile', 'services', 'quotes', 'pending']),
  limit: z.number().int().min(1).max(50).default(20),
});
const decisionSchema = z
  .object({
    serviceSessionId: z.string().uuid(),
    suggestionId: z.string().uuid(),
    commandId: z.string().uuid(),
    expectedUpdatedAt: z
      .string()
      .refine(
        (value) => Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:?\d{2})$/u.test(value),
        'A versão esperada da sugestão é inválida.',
      ),
    decision: z.enum(['approved', 'ignored']),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === 'ignored' && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Informe o motivo para ignorar a sugestão.',
      });
    }
  });

export type LoadCustomerContextResult =
  | {
      readonly success: true;
      readonly summary: CustomerContextSummary;
      readonly suggestions: readonly CustomerProfileSuggestion[];
    }
  | { readonly success: false; readonly message: string; readonly publicCode: string };

export type LoadCustomerContextDetailsResult =
  | { readonly success: true; readonly details: CustomerContextDetailPage }
  | { readonly success: false; readonly message: string; readonly publicCode: string };

export type DecideCustomerProfileSuggestionResult =
  | {
      readonly success: true;
      readonly message: string;
      readonly summary: CustomerContextSummary;
      readonly suggestions: readonly CustomerProfileSuggestion[];
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly publicCode: string;
      readonly conflict?: true;
      readonly summary?: CustomerContextSummary;
      readonly suggestions?: readonly CustomerProfileSuggestion[];
    };

async function authorized(
  capability: Extract<ServiceCapability, 'view' | 'respond'>,
): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasServiceCapability(session.user, capability);
}

function failure(error: unknown, fallback: string) {
  return error instanceof CustomerContextGatewayError
    ? { success: false as const, message: error.message, publicCode: error.publicCode }
    : { success: false as const, message: fallback, publicCode: 'UNEXPECTED_ERROR' };
}

async function reload(serviceSessionId: string) {
  return Promise.all([
    executeAuthenticatedCustomerContextRequest((gateway) => gateway.getSummary(serviceSessionId)),
    executeAuthenticatedCustomerContextRequest((gateway) =>
      gateway.listSuggestions({ serviceSessionId, limit: 100 }),
    ),
  ]);
}

export async function loadCustomerContextAction(
  input: unknown,
): Promise<LoadCustomerContextResult> {
  if (!(await authorized('view'))) {
    return {
      success: false,
      message: 'Você não tem permissão para consultar o contexto do cliente.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'A sessão de atendimento informada é inválida.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    const [summary, suggestions] = await reload(parsed.data.serviceSessionId);
    return { success: true, summary, suggestions };
  } catch (error) {
    return failure(error, 'Não foi possível carregar o contexto do cliente.');
  }
}

export async function loadCustomerContextDetailsAction(
  input: unknown,
): Promise<LoadCustomerContextDetailsResult> {
  if (!(await authorized('view'))) {
    return {
      success: false,
      message: 'Você não tem permissão para consultar detalhes do contexto.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'A seção de contexto solicitada é inválida.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    return {
      success: true,
      details: await executeAuthenticatedCustomerContextRequest((gateway) =>
        gateway.getDetails(parsed.data.serviceSessionId, parsed.data.section, parsed.data.limit),
      ),
    };
  } catch (error) {
    return failure(error, 'Não foi possível carregar os detalhes do contexto.');
  }
}

export async function decideCustomerProfileSuggestionAction(
  input: unknown,
): Promise<DecideCustomerProfileSuggestionResult> {
  if (!(await authorized('respond'))) {
    return {
      success: false,
      message: 'Você não tem permissão para decidir sugestões de perfil.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Revise a decisão.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    await executeAuthenticatedCustomerContextMutation((gateway) =>
      gateway.decideSuggestion(parsed.data.suggestionId, {
        commandId: parsed.data.commandId,
        expectedUpdatedAt: parsed.data.expectedUpdatedAt,
        decision: parsed.data.decision,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      }),
    );
    const [summary, suggestions] = await reload(parsed.data.serviceSessionId);
    return {
      success: true,
      message:
        parsed.data.decision === 'approved'
          ? 'Sugestão aprovada e incorporada ao perfil.'
          : 'Sugestão ignorada com motivo auditável.',
      summary,
      suggestions,
    };
  } catch (error) {
    const failed = {
      ...failure(error, 'Não foi possível registrar a decisão de perfil.'),
      ...(error instanceof CustomerContextGatewayError && error.code === 'conflict'
        ? { conflict: true as const }
        : {}),
    };
    if (!(error instanceof CustomerContextGatewayError) || error.code !== 'conflict') return failed;
    try {
      const [summary, suggestions] = await reload(parsed.data.serviceSessionId);
      return { ...failed, summary, suggestions };
    } catch {
      return failed;
    }
  }
}
