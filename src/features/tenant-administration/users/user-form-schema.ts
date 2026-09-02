import { z } from 'zod';

const userAssignmentFields = {
  name: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  email: z.string().trim().email('Informe um e-mail válido.').max(254),
  isAdministrator: z.boolean(),
  documentAccessMode: z.enum(['standard', 'document-portal', 'client']).optional(),
  clientCategory: z.enum(['legal-entity', 'individual']).nullable().optional(),
  routingCompanyId: z.string().uuid('Selecione o cliente vinculado.').nullable().optional(),
  departments: z.array(z.string()),
  permissionCodes: z.array(z.string()),
  jobTitle: z.enum(['Administrativo', 'Geral', 'Motorista'], {
    error: 'Selecione a classificação do usuário.',
  }),
  maritalStatus: z
    .enum(['single', 'married', 'stable-union', 'divorced', 'widowed', 'not-informed'])
    .default('not-informed'),
  militaryDocumentStatus: z
    .enum(['applicable', 'not-applicable', 'pending-confirmation'])
    .default('pending-confirmation'),
  dependents: z
    .array(
      z.object({
        name: z.string().trim().min(2, 'Informe o nome do dependente.').max(120),
        birthDate: z.string().date('Informe a data de nascimento.'),
        relationship: z.string().trim().max(60).optional(),
      }),
    )
    .max(30)
    .default([]),
} as const;

function requireDepartmentForStandardUser(
  input: {
    readonly isAdministrator: boolean;
    readonly documentAccessMode?: 'standard' | 'document-portal' | 'client';
    readonly departments: readonly string[];
  },
  context: z.RefinementCtx,
) {
  if (
    !input.isAdministrator &&
    input.documentAccessMode !== 'document-portal' &&
    input.documentAccessMode !== 'client' &&
    input.departments.length === 0
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Selecione ao menos um departamento.',
      path: ['departments'],
    });
  }
}

function requireClientScope(
  input: {
    readonly documentAccessMode?: 'standard' | 'document-portal' | 'client';
    readonly clientCategory?: 'legal-entity' | 'individual' | null;
    readonly routingCompanyId?: string | null;
    readonly departments: readonly string[];
  },
  context: z.RefinementCtx,
) {
  if (input.documentAccessMode !== 'client') return;
  if (!input.clientCategory) {
    context.addIssue({
      code: 'custom',
      message: 'Informe se o cliente é pessoa jurídica ou física.',
      path: ['clientCategory'],
    });
  }
  if (!input.routingCompanyId) {
    context.addIssue({
      code: 'custom',
      message: 'Selecione o cliente PF ou PJ vinculado a este acesso.',
      path: ['routingCompanyId'],
    });
  }
  if (input.departments.length !== 1 || input.departments[0] !== 'client-company') {
    context.addIssue({
      code: 'custom',
      message: 'O acesso de cliente deve usar o escopo Empresa cliente.',
      path: ['departments'],
    });
  }
}

export const userFormSchema = z
  .object({
    ...userAssignmentFields,
    isAdministrator: z.literal(false, {
      error: 'Contas administradoras não podem ser criadas pelo Tenant Web.',
    }),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{3,40}$/, 'Use de 3 a 40 letras, números, ponto, hífen ou sublinhado.')
      .refine(
        (username) => /[a-zA-Z]/.test(username),
        'O nome de usuário deve conter ao menos uma letra.',
      ),
    password: z
      .string()
      .min(12, 'A senha inicial deve ter ao menos 12 caracteres.')
      .max(72)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
        'Inclua maiúscula, minúscula, número e símbolo.',
      ),
    requestDocuments: z.boolean().default(false),
    documentAccessMode: z
      .literal('standard', {
        error:
          'Novas contas de candidato ou cliente não podem ser criadas pelo Tenant Web neste momento.',
      })
      .default('standard'),
    clientCategory: z
      .null({
        error: 'A categoria de cliente não se aplica à criação de colaboradores.',
      })
      .optional(),
    routingCompanyId: z
      .null({
        error: 'O vínculo com cliente não se aplica à criação de colaboradores.',
      })
      .optional(),
    // Compatibilidade de entrada com clientes anteriores; a seleção fixa não é mais usada.
    initialDocumentChecklistCode: z
      .enum(['admission-general', 'admission-administrative', 'admission-driver'])
      .optional(),
  })
  .strict()
  .superRefine((input, context) => {
    requireDepartmentForStandardUser(input, context);
    if (input.departments.includes('client-company')) {
      context.addIssue({
        code: 'custom',
        message: 'Empresa cliente não é um departamento válido para uma nova conta de colaborador.',
        path: ['departments'],
      });
    }
  });

export const userEditorFormSchema = z
  .object(userAssignmentFields)
  .strict()
  .superRefine((input, context) => {
    requireDepartmentForStandardUser(input, context);
    requireClientScope(input, context);
  });

export type UserFormValues = z.input<typeof userFormSchema>;
export type UserEditorFormValues = z.input<typeof userEditorFormSchema>;
