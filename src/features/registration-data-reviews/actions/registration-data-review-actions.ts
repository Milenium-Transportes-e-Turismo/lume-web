'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { hasPermission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import { RegistrationDataReviewGatewayError } from '../application';
import { REGISTRATION_DATA_REVIEW_STATUSES, type RegistrationDataReview } from '../domain';
import {
  executeAuthenticatedRegistrationDataReviewMutation,
  executeAuthenticatedRegistrationDataReviewRequest,
} from '../server';

const statusSchema = z.enum(REGISTRATION_DATA_REVIEW_STATUSES).optional();
const decisionSchema = z
  .object({
    reviewId: z.string().uuid(),
    commandId: z.string().uuid(),
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === 'rejected' && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Informe o motivo da rejeição.',
      });
    }
  });

export type RegistrationDataReviewActionResult =
  | {
      readonly success: true;
      readonly reviews: readonly RegistrationDataReview[];
      readonly message: string;
    }
  | { readonly success: false; readonly message: string; readonly publicCode: string };

async function canManage(): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasPermission(session.user, 'clients:manage');
}

function failure(
  error: unknown,
  fallback: string,
): Extract<RegistrationDataReviewActionResult, { readonly success: false }> {
  return error instanceof RegistrationDataReviewGatewayError
    ? { success: false, message: error.message, publicCode: error.publicCode }
    : { success: false, message: fallback, publicCode: 'UNEXPECTED_ERROR' };
}

export async function loadRegistrationDataReviewsAction(
  status?: unknown,
): Promise<RegistrationDataReviewActionResult> {
  if (!(await canManage())) {
    return {
      success: false,
      message: 'Você não tem permissão para revisar dados cadastrais.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Status de revisão inválido.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    return {
      success: true,
      reviews: await executeAuthenticatedRegistrationDataReviewRequest((gateway) =>
        gateway.list(parsed.data),
      ),
      message: 'Fila atualizada.',
    };
  } catch (error) {
    return failure(error, 'Não foi possível carregar as revisões cadastrais.');
  }
}

export async function decideRegistrationDataReviewAction(
  input: unknown,
): Promise<RegistrationDataReviewActionResult> {
  if (!(await canManage())) {
    return {
      success: false,
      message: 'Você não tem permissão para decidir esta revisão.',
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
    await executeAuthenticatedRegistrationDataReviewMutation((gateway) =>
      gateway.decide(parsed.data.reviewId, {
        commandId: parsed.data.commandId,
        decision: parsed.data.decision,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      }),
    );
    const reviews = await executeAuthenticatedRegistrationDataReviewRequest((gateway) =>
      gateway.list(),
    );
    revalidatePath('/registration-data-reviews');
    return {
      success: true,
      reviews,
      message:
        parsed.data.decision === 'approved'
          ? 'Alteração aprovada e aplicada.'
          : 'Alteração rejeitada com auditoria.',
    };
  } catch (error) {
    return failure(error, 'Não foi possível registrar a decisão.');
  }
}
