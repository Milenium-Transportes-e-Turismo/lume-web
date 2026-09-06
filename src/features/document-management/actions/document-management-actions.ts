'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { DocumentManagementError } from '../application';
import { executeAuthenticatedDocumentMutation } from '../server';

function value(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === 'string' ? entry.trim() : '';
}

function feedbackPath(path: string, kind: 'error' | 'success', message: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${kind}=${encodeURIComponent(message)}`;
}

function failure(path: string, error: unknown): never {
  if (error instanceof DocumentManagementError && error.code === 'unauthorized') {
    redirect('/auth/session-expired');
  }
  const message =
    error instanceof DocumentManagementError
      ? error.message
      : 'Não foi possível concluir a operação documental.';
  redirect(feedbackPath(path, 'error', message));
}

const createRequestSchema = z.object({
  subjectUserId: z.string().uuid().optional(),
  subjectRegistrationId: z.string().uuid().optional(),
  checklistId: z.string().uuid(),
  context: z.enum([
    'admission',
    'document-update',
    'document-renewal',
    'regularization',
    'offboarding',
    'other',
  ]),
  deadline: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const createBatchRequestsSchema = z.object({
  subjectUserIds: z.array(z.string().uuid()).min(1).max(100),
  documentTypeIds: z.array(z.string().uuid()).min(1).max(100),
  context: z.enum([
    'admission',
    'document-update',
    'document-renewal',
    'regularization',
    'offboarding',
    'other',
  ]),
  deadline: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createBatchDocumentRequestsAction(formData: FormData): Promise<void> {
  const parsed = createBatchRequestsSchema.safeParse({
    subjectUserIds: formData
      .getAll('subjectUserIds')
      .filter((entry): entry is string => typeof entry === 'string'),
    documentTypeIds: formData
      .getAll('documentTypeIds')
      .filter((entry): entry is string => typeof entry === 'string'),
    context: value(formData, 'context'),
    deadline: value(formData, 'deadline') || undefined,
    notes: value(formData, 'notes') || undefined,
  });
  if (!parsed.success) {
    redirect('/document-management?error=Selecione ao menos um usuário e um documento.');
  }

  let result: {
    readonly createdCount: number;
    readonly skippedDocuments: readonly unknown[];
  };
  try {
    result = await executeAuthenticatedDocumentMutation((gateway) =>
      gateway.createBatchRequests({ ...parsed.data, commandId: randomUUID() }),
    );
  } catch (error) {
    failure('/document-management', error);
  }
  revalidatePath('/document-management');
  revalidatePath('/documents');
  const skippedCount = result.skippedDocuments.length;
  const skipped =
    skippedCount === 0
      ? ''
      : skippedCount === 1
        ? ' Uma combinação não aplicável foi ignorada.'
        : ` ${skippedCount} combinações não aplicáveis foram ignoradas.`;
  const updated =
    result.createdCount === 0
      ? 'Nenhum cadastro documental foi atualizado.'
      : result.createdCount === 1
        ? 'Um cadastro documental foi atualizado.'
        : `${result.createdCount} cadastros documentais foram atualizados.`;
  redirect(`/document-management?success=${encodeURIComponent(`${updated}${skipped}`)}`);
}

export async function createDocumentRequestAction(formData: FormData): Promise<void> {
  const parsed = createRequestSchema.safeParse({
    subjectUserId: value(formData, 'subjectUserId') || undefined,
    subjectRegistrationId: value(formData, 'subjectRegistrationId') || undefined,
    checklistId: value(formData, 'checklistId'),
    context: value(formData, 'context'),
    deadline: value(formData, 'deadline') || undefined,
    notes: value(formData, 'notes') || undefined,
  });
  if (!parsed.success) redirect('/document-management?error=Revise os dados da solicitação.');

  let requestId: string;
  try {
    const request = await executeAuthenticatedDocumentMutation((gateway) =>
      gateway.createRequest({ ...parsed.data, commandId: randomUUID() }),
    );
    requestId = request.id;
  } catch (error) {
    failure('/document-management', error);
  }
  revalidatePath('/document-management');
  revalidatePath('/documents');
  redirect(`/document-management/${requestId}?success=Solicitação criada.`);
}

export async function reviewDocumentSubmissionAction(
  requestId: string,
  submissionId: string,
  returnPath: string,
  formData: FormData,
): Promise<void> {
  const decision = value(formData, 'decision');
  if (!['approved', 'rejected', 'resubmission-required'].includes(decision)) {
    redirect(feedbackPath(returnPath, 'error', 'Decisão inválida.'));
  }
  try {
    const proposedFields: Record<string, unknown> = {};
    const confirmedFields: Record<string, unknown> = {};
    const confidences: Record<string, number> = {};
    const multipleFields = new Set(
      formData
        .getAll('multipleField')
        .filter((entry): entry is string => typeof entry === 'string'),
    );
    const reviewValue = (key: string, entry: string): string | string[] => {
      const normalized = entry.trim();
      return multipleFields.has(key)
        ? normalized
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean)
        : normalized;
    };
    for (const [name, entry] of formData.entries()) {
      if (typeof entry !== 'string') continue;
      if (name.startsWith('proposed.')) {
        const key = name.slice(9);
        proposedFields[key] = reviewValue(key, entry);
      }
      if (name.startsWith('confirmed.')) {
        const key = name.slice(10);
        confirmedFields[key] = reviewValue(key, entry);
      }
      if (name.startsWith('confidence.')) {
        const numeric = Number(entry);
        if (Number.isFinite(numeric)) confidences[name.slice(11)] = numeric / 100;
      }
    }
    if (Object.keys(proposedFields).length) {
      await executeAuthenticatedDocumentMutation((gateway) =>
        gateway.updateExtractedData(submissionId, { fields: proposedFields, confidences }),
      );
    }
    await executeAuthenticatedDocumentMutation((gateway) =>
      gateway.review(submissionId, {
        commandId: randomUUID(),
        decision: decision as 'approved' | 'rejected' | 'resubmission-required',
        reason: value(formData, 'reason') || undefined,
        notes: value(formData, 'notes') || undefined,
        validUntil: value(formData, 'validUntil') || undefined,
        originalCheckStatus:
          (value(formData, 'originalCheckStatus') as
            'not-required' | 'pending' | 'confirmed' | 'divergent') || undefined,
        originalObservation: value(formData, 'originalObservation') || undefined,
        confirmedFields,
      }),
    );
  } catch (error) {
    failure(returnPath, error);
  }
  revalidatePath(`/documents/${requestId}`);
  revalidatePath(`/document-management/${requestId}`);
  redirect(feedbackPath(returnPath, 'success', 'Revisão registrada.'));
}

export async function deleteDocumentSubmissionAction(
  requestId: string,
  submissionId: string,
  returnPath: string,
  formData: FormData,
): Promise<void> {
  try {
    await executeAuthenticatedDocumentMutation((gateway) =>
      gateway.deleteSubmission(submissionId, {
        reason: value(formData, 'reason') || undefined,
      }),
    );
  } catch (error) {
    failure(returnPath, error);
  }
  revalidatePath(`/documents/${requestId}`);
  revalidatePath(`/document-management/${requestId}`);
  revalidatePath('/documents');
  revalidatePath('/document-management');
  redirect(
    feedbackPath(returnPath, 'success', 'Arquivo removido. O documento voltou a aguardar envio.'),
  );
}

export async function addDocumentRequestItemAction(
  requestId: string,
  returnPath: string,
  formData: FormData,
): Promise<void> {
  const requirement = value(formData, 'requirement');
  if (!['required', 'optional'].includes(requirement)) {
    redirect(feedbackPath(returnPath, 'error', 'Exigência inválida.'));
  }
  try {
    await executeAuthenticatedDocumentMutation((gateway) =>
      gateway.addRequestItem(requestId, {
        documentTypeId: value(formData, 'documentTypeId'),
        requirement: requirement as 'required' | 'optional',
        instructions: value(formData, 'instructions') || undefined,
        dueAt: value(formData, 'dueAt') || undefined,
        reason: value(formData, 'reason'),
      }),
    );
  } catch (error) {
    failure(returnPath, error);
  }
  revalidatePath(returnPath.split('?')[0]);
  redirect(feedbackPath(returnPath, 'success', 'Documento incluído na solicitação.'));
}

export async function setDocumentRequestItemPolicyAction(
  requestId: string,
  requestItemId: string,
  returnPath: string,
  formData: FormData,
): Promise<void> {
  const policy = value(formData, 'policy');
  if (!['required', 'optional', 'waived'].includes(policy)) {
    redirect(feedbackPath(returnPath, 'error', 'Política documental inválida.'));
  }
  try {
    await executeAuthenticatedDocumentMutation((gateway) =>
      gateway.setRequestItemPolicy(requestItemId, {
        policy: policy as 'required' | 'optional' | 'waived',
        reason: value(formData, 'reason'),
      }),
    );
  } catch (error) {
    failure(returnPath, error);
  }
  revalidatePath(`/document-management/${requestId}`);
  redirect(feedbackPath(returnPath, 'success', 'Exigência documental atualizada.'));
}
