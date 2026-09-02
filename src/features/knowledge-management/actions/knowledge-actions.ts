'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { hasPermission, type Permission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import { KnowledgeGatewayError, type KnowledgeGateway } from '../application';
import { KNOWLEDGE_SCOPES, KNOWLEDGE_VISIBILITIES, type KnowledgeDocument } from '../domain';
import {
  executeAuthenticatedKnowledgeMutation,
  executeAuthenticatedKnowledgeRequest,
} from '../server';

const uuid = z.string().uuid();
const command = z.object({ commandId: uuid });
const metadataFields = {
  knowledgeBaseId: uuid,
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4_000).optional(),
  scope: z.enum(KNOWLEDGE_SCOPES),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES),
  departmentIds: z.array(uuid).max(50),
  effectiveFrom: z.string().datetime({ offset: true }).optional(),
  effectiveUntil: z.string().datetime({ offset: true }).optional(),
} as const;
const metadataSchema = z.object(metadataFields).superRefine((value, context) => {
  const count = new Set(value.departmentIds).size;
  if (
    (value.scope === 'tenant' && count !== 0) ||
    (value.scope === 'department' && count !== 1) ||
    (value.scope === 'multi-department' && count < 2)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['departmentIds'],
      message: 'O número de departamentos não corresponde ao escopo selecionado.',
    });
  }
  if (
    value.effectiveFrom &&
    value.effectiveUntil &&
    Date.parse(value.effectiveFrom) >= Date.parse(value.effectiveUntil)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['effectiveUntil'],
      message: 'O fim da vigência deve ser posterior ao início.',
    });
  }
});
const versionedFields = {
  documentId: uuid,
  versionId: uuid,
  expectedVersion: z.number().int().positive(),
  commandId: uuid,
} as const;

const mutationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('create-base'),
    commandId: uuid,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(4_000).optional(),
  }),
  z.object({
    kind: z.literal('create-article'),
    commandId: uuid,
    ...metadataFields,
    content: z.string().trim().min(1).max(2_097_152),
  }),
  z.object({
    kind: z.literal('create-next-draft'),
    commandId: uuid,
    documentId: uuid,
    expectedVersion: z.number().int().positive(),
    content: z.string().trim().min(1).max(2_097_152).optional(),
    effectiveFrom: z.string().datetime({ offset: true }).optional(),
    effectiveUntil: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    kind: z.literal('update-draft'),
    ...versionedFields,
    expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/u),
    content: z.string().trim().min(1).max(2_097_152),
    effectiveFrom: z.string().datetime({ offset: true }).optional(),
    effectiveUntil: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({ kind: z.literal('publish-version'), ...versionedFields }),
  z.object({ kind: z.literal('archive-version'), ...versionedFields }),
  z.object({
    kind: z.literal('archive-document'),
    commandId: uuid,
    documentId: uuid,
    expectedVersion: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('review-suggestion'),
    commandId: uuid,
    suggestionId: uuid,
    decision: z.enum(['approved', 'rejected']),
  }),
  z.object({
    kind: z.literal('review-gap'),
    commandId: uuid,
    gapId: uuid,
    decision: z.enum(['acknowledged', 'resolved', 'dismissed']),
  }),
]);

export type KnowledgeMutationInput = z.input<typeof mutationSchema>;
export type KnowledgeActionResult =
  | { readonly success: true; readonly message: string }
  | {
      readonly success: false;
      readonly message: string;
      readonly publicCode: string;
      readonly currentDocument?: KnowledgeDocument;
    };

export type KnowledgeDocumentActionResult =
  | { readonly success: true; readonly document: KnowledgeDocument }
  | { readonly success: false; readonly message: string; readonly publicCode: string };

const PERMISSIONS: Readonly<Record<z.infer<typeof mutationSchema>['kind'], Permission>> = {
  'create-base': 'knowledge:manage',
  'create-article': 'knowledge:manage',
  'create-next-draft': 'knowledge:manage',
  'update-draft': 'knowledge:manage',
  'publish-version': 'knowledge:publish',
  'archive-version': 'knowledge:manage',
  'archive-document': 'knowledge:manage',
  'review-suggestion': 'knowledge:manage',
  'review-gap': 'knowledge:manage',
};

async function authorized(permission: Permission): Promise<boolean> {
  const session = await getCurrentAuthenticatedSession();
  return session !== null && hasPermission(session.user, permission);
}

function failure(error: unknown, fallback: string): KnowledgeActionResult {
  if (error instanceof KnowledgeGatewayError) {
    return { success: false, message: error.message, publicCode: error.publicCode };
  }
  return { success: false, message: fallback, publicCode: 'UNEXPECTED_ERROR' };
}

async function currentDocument(error: unknown, documentId?: string) {
  if (!(error instanceof KnowledgeGatewayError) || error.code !== 'conflict' || !documentId) {
    return undefined;
  }
  try {
    return await executeAuthenticatedKnowledgeRequest((gateway) => gateway.getDocument(documentId));
  } catch {
    return undefined;
  }
}

export async function getKnowledgeDocumentAction(
  documentId: unknown,
): Promise<KnowledgeDocumentActionResult> {
  if (
    !(await authorized('knowledge:view')) &&
    !(await authorized('knowledge:manage')) &&
    !(await authorized('knowledge:publish'))
  ) {
    return {
      success: false,
      message: 'Você não tem permissão para consultar knowledge.',
      publicCode: 'FORBIDDEN',
    };
  }
  const parsed = uuid.safeParse(documentId);
  if (!parsed.success) {
    return { success: false, message: 'Documento inválido.', publicCode: 'VALIDATION_ERROR' };
  }
  try {
    return {
      success: true,
      document: await executeAuthenticatedKnowledgeRequest((gateway) =>
        gateway.getDocument(parsed.data),
      ),
    };
  } catch (error) {
    const result = failure(error, 'Não foi possível carregar o documento.');
    return result.success
      ? { success: false, message: 'Falha inesperada.', publicCode: 'UNEXPECTED_ERROR' }
      : result;
  }
}

export async function executeKnowledgeMutationAction(
  input: KnowledgeMutationInput,
): Promise<KnowledgeActionResult> {
  const parsed = mutationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Revise os dados da operação.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  if (!(await authorized(PERMISSIONS[parsed.data.kind]))) {
    return {
      success: false,
      message: 'Você não tem permissão para executar esta operação.',
      publicCode: 'FORBIDDEN',
    };
  }

  const data = parsed.data;
  let documentId: string | undefined;
  try {
    await executeAuthenticatedKnowledgeMutation(async (gateway: KnowledgeGateway) => {
      switch (data.kind) {
        case 'create-base':
          return gateway.createBase(data);
        case 'create-article': {
          const metadata = metadataSchema.parse(data);
          return gateway.createArticle({
            ...metadata,
            commandId: data.commandId,
            content: data.content,
          });
        }
        case 'create-next-draft':
          documentId = data.documentId;
          return gateway.createNextDraft(data.documentId, data);
        case 'update-draft':
          documentId = data.documentId;
          return gateway.updateDraft(data.documentId, data.versionId, data);
        case 'publish-version':
          documentId = data.documentId;
          return gateway.publishVersion(data.documentId, data.versionId, data);
        case 'archive-version':
          documentId = data.documentId;
          return gateway.archiveVersion(data.documentId, data.versionId, data);
        case 'archive-document':
          documentId = data.documentId;
          return gateway.archiveDocument(data.documentId, data);
        case 'review-suggestion':
          return gateway.reviewSuggestion(data.suggestionId, data);
        case 'review-gap':
          return gateway.reviewGap(data.gapId, data);
      }
    });
    revalidatePath('/knowledge');
    return { success: true, message: 'Operação registrada com sucesso.' };
  } catch (error) {
    const result = failure(error, 'Não foi possível concluir a operação de knowledge.');
    if (result.success) return result;
    const authoritative = await currentDocument(error, documentId);
    return authoritative ? { ...result, currentDocument: authoritative } : result;
  }
}

export async function uploadKnowledgeOriginalAction(
  formData: FormData,
): Promise<KnowledgeActionResult> {
  if (!(await authorized('knowledge:manage'))) {
    return {
      success: false,
      message: 'Você não tem permissão para enviar arquivos.',
      publicCode: 'FORBIDDEN',
    };
  }
  const file = formData.get('file');
  const parsed = command.extend(metadataFields).safeParse({
    commandId: formData.get('commandId'),
    knowledgeBaseId: formData.get('knowledgeBaseId'),
    title: formData.get('title'),
    description: String(formData.get('description') ?? '').trim() || undefined,
    scope: formData.get('scope'),
    visibility: formData.get('visibility'),
    departmentIds: String(formData.get('departmentIds') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    effectiveFrom: String(formData.get('effectiveFrom') ?? '').trim() || undefined,
    effectiveUntil: String(formData.get('effectiveUntil') ?? '').trim() || undefined,
  });
  if (
    !parsed.success ||
    !(file instanceof File) ||
    file.size <= 0 ||
    file.size > 10 * 1024 * 1024
  ) {
    return {
      success: false,
      message: parsed.success
        ? 'Envie um arquivo de até 10 MiB.'
        : (parsed.error.issues[0]?.message ?? 'Revise os metadados.'),
      publicCode: 'VALIDATION_ERROR',
    };
  }
  const metadata = metadataSchema.safeParse(parsed.data);
  if (!metadata.success) {
    return {
      success: false,
      message: metadata.error.issues[0]?.message ?? 'Revise os metadados.',
      publicCode: 'VALIDATION_ERROR',
    };
  }
  try {
    await executeAuthenticatedKnowledgeMutation((gateway) =>
      gateway.uploadOriginal({ ...metadata.data, commandId: parsed.data.commandId, file }),
    );
    revalidatePath('/knowledge');
    return { success: true, message: 'Arquivo preservado e draft criado.' };
  } catch (error) {
    return failure(error, 'Não foi possível enviar o arquivo para knowledge.');
  }
}
