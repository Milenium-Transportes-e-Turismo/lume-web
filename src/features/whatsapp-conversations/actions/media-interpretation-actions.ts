'use server';

import { z } from 'zod';

import { hasServiceCapability } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import { WhatsAppConversationRepositoryError } from '../application';
import type { DeferredWhatsAppMediaInterpretation, WhatsAppMediaInterpretation } from '../domain';
import {
  analyzeWhatsAppMediaForDashboard,
  correctWhatsAppMediaInterpretationForDashboard,
  getWhatsAppMediaInterpretationForDashboard,
} from '../server';

const targetSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});
const correctionSchema = targetSchema.extend({
  correction: z.string().trim().min(1).max(20_000),
  feedback: z.string().trim().max(4_000).optional(),
});

export type MediaInterpretationActionResult =
  | {
      readonly success: true;
      readonly interpretation: WhatsAppMediaInterpretation | DeferredWhatsAppMediaInterpretation;
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
    };

async function canRead(): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasServiceCapability(session.user, 'view');
}

async function canManage(): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasServiceCapability(session.user, 'respond');
}

function failure(error: unknown): MediaInterpretationActionResult {
  if (error instanceof WhatsAppConversationRepositoryError) {
    return {
      success: false,
      code:
        error.code === 'too-many-requests' || error.code === 'invalid-response'
          ? 'service-unavailable'
          : error.code,
      message: error.message,
    };
  }
  return {
    success: false,
    code: 'service-unavailable',
    message: 'Não foi possível consultar a interpretação desta mídia.',
  };
}

export async function getMediaInterpretationAction(
  input: unknown,
): Promise<MediaInterpretationActionResult> {
  if (!(await canRead())) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para consultar esta interpretação.',
    };
  }
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, code: 'validation', message: 'Conversa ou mensagem inválida.' };
  }
  try {
    return {
      success: true,
      interpretation: await getWhatsAppMediaInterpretationForDashboard(
        parsed.data.conversationId,
        parsed.data.messageId,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function analyzeMediaInterpretationAction(
  input: unknown,
): Promise<MediaInterpretationActionResult> {
  if (!(await canManage())) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para analisar esta mídia.',
    };
  }
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, code: 'validation', message: 'Conversa ou mensagem inválida.' };
  }
  try {
    return {
      success: true,
      interpretation: await analyzeWhatsAppMediaForDashboard(
        parsed.data.conversationId,
        parsed.data.messageId,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function correctMediaInterpretationAction(
  input: unknown,
): Promise<MediaInterpretationActionResult> {
  if (!(await canManage())) {
    return {
      success: false,
      code: 'forbidden',
      message: 'Você não tem permissão para corrigir esta interpretação.',
    };
  }
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Revise a correção.',
    };
  }
  try {
    return {
      success: true,
      interpretation: await correctWhatsAppMediaInterpretationForDashboard(
        parsed.data.conversationId,
        parsed.data.messageId,
        parsed.data.correction,
        parsed.data.feedback,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
