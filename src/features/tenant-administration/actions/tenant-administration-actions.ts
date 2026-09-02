'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { TenantAdministrationError, type TenantAdministrationGateway } from '../application';
import { executeAuthenticatedTenantMutation } from '../server';

const userAssignmentFields = {
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(254),
  isAdministrator: z.boolean(),
  documentAccessMode: z.enum(['standard', 'document-portal', 'client']).optional(),
  clientCategory: z.enum(['legal-entity', 'individual']).nullable().optional(),
  routingCompanyId: z.string().uuid().nullable().optional(),
  departments: z.array(z.string().min(1)),
  permissionCodes: z.array(z.string().min(1)),
  jobTitle: z.enum(['Administrativo', 'Geral', 'Motorista']).optional(),
  maritalStatus: z
    .enum(['single', 'married', 'stable-union', 'divorced', 'widowed', 'not-informed'])
    .optional(),
  militaryDocumentStatus: z
    .enum(['applicable', 'not-applicable', 'pending-confirmation'])
    .optional(),
  dependents: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        birthDate: z.string().date(),
        relationship: z.string().trim().max(60).optional(),
      }),
    )
    .optional(),
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
  if (!input.clientCategory)
    context.addIssue({
      code: 'custom',
      message: 'Informe a categoria do cliente.',
      path: ['clientCategory'],
    });
  if (!input.routingCompanyId)
    context.addIssue({
      code: 'custom',
      message: 'Selecione o cliente PF ou PJ.',
      path: ['routingCompanyId'],
    });
  if (input.departments.length !== 1 || input.departments[0] !== 'client-company')
    context.addIssue({
      code: 'custom',
      message: 'Use o escopo Empresa cliente.',
      path: ['departments'],
    });
}

const userBaseSchema = z.object(userAssignmentFields).superRefine((input, context) => {
  requireDepartmentForStandardUser(input, context);
  requireClientScope(input, context);
});
const createUserSchema = z
  .object({
    ...userAssignmentFields,
    isAdministrator: z.literal(false, {
      error: 'Contas administradoras não podem ser criadas pelo Tenant Web.',
    }),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{3,40}$/)
      .refine(
        (username) => /[a-zA-Z]/.test(username),
        'O nome de usuário deve conter ao menos uma letra.',
      ),
    password: z
      .string()
      .min(12)
      .max(72)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
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
  })
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

function normalizeAdministratorAssignments<
  T extends {
    readonly isAdministrator: boolean;
    readonly departments: readonly string[];
    readonly permissionCodes: readonly string[];
  },
>(input: T): T {
  return input.isAdministrator ? { ...input, departments: [], permissionCodes: [] } : input;
}

function withoutAdministratorMutation(input: z.infer<typeof userBaseSchema>) {
  const employeeProfile = {
    ...(input.jobTitle === undefined ? {} : { jobTitle: input.jobTitle }),
    ...(input.maritalStatus === undefined ? {} : { maritalStatus: input.maritalStatus }),
    ...(input.militaryDocumentStatus === undefined
      ? {}
      : { militaryDocumentStatus: input.militaryDocumentStatus }),
    ...(input.dependents === undefined ? {} : { dependents: input.dependents }),
  };
  if (input.isAdministrator) {
    return {
      name: input.name,
      email: input.email,
      ...employeeProfile,
    };
  }

  return {
    name: input.name,
    email: input.email,
    ...(input.documentAccessMode === 'client'
      ? {
          clientCategory: input.clientCategory,
          routingCompanyId: input.routingCompanyId,
        }
      : {}),
    departments: input.departments,
    permissionCodes: input.permissionCodes,
    ...employeeProfile,
  };
}

function haveSameStringValues(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = [...new Set(left)].sort();
  const normalizedRight = [...new Set(right)].sort();
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

async function updateUserWithoutChangingAccessMode(
  gateway: TenantAdministrationGateway,
  userId: string,
  input: z.infer<typeof userBaseSchema>,
) {
  const current = await gateway.getUser(userId);
  const currentMode = current.documentAccessMode ?? 'standard';
  const requestedMode = input.documentAccessMode;

  if (requestedMode !== undefined && requestedMode !== currentMode) {
    throw new TenantAdministrationError(
      'validation',
      'O modo de acesso existente não pode ser alterado enquanto a migração de contas legadas não estiver definida.',
      'ACCESS_MODE_CHANGE_NOT_ALLOWED',
    );
  }

  const mutation = withoutAdministratorMutation(input);
  const assignmentsChanged =
    !input.isAdministrator &&
    (!haveSameStringValues(input.departments, current.departments) ||
      !haveSameStringValues(input.permissionCodes, current.permissionCodes) ||
      (currentMode === 'client' &&
        (input.clientCategory !== current.clientCategory ||
          input.routingCompanyId !== current.routingCompanyId)));
  const updated = await gateway.updateUser(userId, mutation);

  if (
    assignmentsChanged &&
    (!haveSameStringValues(input.departments, updated.departments) ||
      !haveSameStringValues(input.permissionCodes, updated.permissionCodes) ||
      (currentMode === 'client' &&
        (input.clientCategory !== updated.clientCategory ||
          input.routingCompanyId !== updated.routingCompanyId)))
  ) {
    throw new TenantAdministrationError(
      'conflict',
      'A Tenant API atualizou os dados, mas não confirmou todos os acessos solicitados. O estado autoritativo deve ser recarregado.',
      'AUTHORITATIVE_USER_STATE_MISMATCH',
    );
  }

  return updated;
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function formStrings(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function formBoolean(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'true' || value === 'on';
}

function formOptionalAccessMode(
  formData: FormData,
): 'standard' | 'document-portal' | 'client' | undefined {
  const mode = formString(formData, 'documentAccessMode');
  if (mode === 'document-portal' || mode === 'client' || mode === 'standard') return mode;
  return undefined;
}

function formAccessMode(formData: FormData): 'standard' | 'document-portal' | 'client' {
  return formOptionalAccessMode(formData) ?? 'standard';
}

function actionFailureDestination(path: string, error: unknown): never {
  if (error instanceof TenantAdministrationError && error.code === 'unauthorized') {
    redirect('/auth/session-expired');
  }

  const message =
    error instanceof TenantAdministrationError
      ? error.message
      : 'Não foi possível concluir a operação.';
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createTenantUserAction(formData: FormData): Promise<void> {
  const parsed = createUserSchema.safeParse({
    name: formString(formData, 'name'),
    username: formString(formData, 'username'),
    email: formString(formData, 'email'),
    password: formString(formData, 'password'),
    requestDocuments: formBoolean(formData, 'requestDocuments'),
    isAdministrator: formBoolean(formData, 'isAdministrator'),
    documentAccessMode: formAccessMode(formData),
    clientCategory:
      formString(formData, 'clientCategory') === 'legal-entity'
        ? 'legal-entity'
        : formString(formData, 'clientCategory') === 'individual'
          ? 'individual'
          : null,
    routingCompanyId: formString(formData, 'routingCompanyId') || null,
    departments: formStrings(formData, 'departments'),
    permissionCodes: formStrings(formData, 'permissionCodes'),
    jobTitle: formString(formData, 'jobTitle') || undefined,
    maritalStatus: formString(formData, 'maritalStatus') || 'not-informed',
    militaryDocumentStatus:
      formString(formData, 'militaryDocumentStatus') || 'pending-confirmation',
    dependents: [],
  });

  if (!parsed.success) {
    redirect('/users?error=Revise os dados do novo usuário.');
  }

  try {
    await executeAuthenticatedTenantMutation((gateway) =>
      gateway.createUser({
        ...normalizeAdministratorAssignments(parsed.data),
        ...(parsed.data.requestDocuments ? { initialDocumentRequestCommandId: randomUUID() } : {}),
      }),
    );
  } catch (error) {
    actionFailureDestination('/users', error);
  }

  revalidatePath('/users');
  redirect('/users?success=Usuário criado com sucesso.');
}

export async function updateTenantUserAction(userId: string, formData: FormData): Promise<void> {
  const parsed = userBaseSchema.safeParse({
    name: formString(formData, 'name'),
    email: formString(formData, 'email'),
    isAdministrator: formBoolean(formData, 'isAdministrator'),
    documentAccessMode: formOptionalAccessMode(formData),
    clientCategory:
      formString(formData, 'clientCategory') === 'legal-entity'
        ? 'legal-entity'
        : formString(formData, 'clientCategory') === 'individual'
          ? 'individual'
          : null,
    routingCompanyId: formString(formData, 'routingCompanyId') || null,
    departments: formStrings(formData, 'departments'),
    permissionCodes: formStrings(formData, 'permissionCodes'),
    jobTitle: formString(formData, 'jobTitle') || undefined,
    maritalStatus: formString(formData, 'maritalStatus') || 'not-informed',
    militaryDocumentStatus:
      formString(formData, 'militaryDocumentStatus') || 'pending-confirmation',
    dependents: [],
  });

  if (!parsed.success) {
    redirect(`/users/${userId}?error=Revise os dados do usuário.`);
  }

  try {
    await executeAuthenticatedTenantMutation((gateway) =>
      updateUserWithoutChangingAccessMode(gateway, userId, parsed.data),
    );
  } catch (error) {
    if (
      error instanceof TenantAdministrationError &&
      error.publicCode === 'AUTHORITATIVE_USER_STATE_MISMATCH'
    ) {
      revalidatePath('/users');
      revalidatePath(`/users/${userId}`);
    }
    actionFailureDestination(`/users/${userId}`, error);
  }

  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
  redirect(`/users/${userId}?success=Usuário atualizado com sucesso.`);
}

export async function setTenantUserActiveAction(userId: string, isActive: boolean): Promise<void> {
  try {
    await executeAuthenticatedTenantMutation((gateway) =>
      gateway.updateUserStatus(userId, { status: isActive ? 'active' : 'inactive' }),
    );
  } catch (error) {
    actionFailureDestination('/users', error);
  }

  revalidatePath('/users');
  redirect(`/users?success=Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso.`);
}

export type TenantUserFormResult =
  | {
      readonly success: true;
      readonly message: string;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly errorCode: string;
    };

function tenantUserActionResult(error: unknown, fallback: string): TenantUserFormResult {
  if (error instanceof TenantAdministrationError) {
    return { success: false, message: error.message, errorCode: error.publicCode };
  }

  return { success: false, message: fallback, errorCode: 'UNEXPECTED_ERROR' };
}

export async function createTenantUserFormAction(input: unknown): Promise<TenantUserFormResult> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Revise os dados do novo usuário.',
      errorCode: 'VALIDATION_ERROR',
    };
  }

  try {
    await executeAuthenticatedTenantMutation((gateway) =>
      gateway.createUser({
        ...normalizeAdministratorAssignments(parsed.data),
        ...(parsed.data.requestDocuments ? { initialDocumentRequestCommandId: randomUUID() } : {}),
      }),
    );
  } catch (error) {
    return tenantUserActionResult(error, 'Não foi possível criar o usuário.');
  }

  revalidatePath('/users');
  return {
    success: true,
    message: 'Usuário criado. No primeiro acesso, ele deverá substituir a senha inicial.',
  };
}

export async function updateTenantUserFormAction(
  userId: string,
  input: unknown,
): Promise<TenantUserFormResult> {
  const parsed = userBaseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Revise os dados do usuário.',
      errorCode: 'VALIDATION_ERROR',
    };
  }

  try {
    await executeAuthenticatedTenantMutation((gateway) =>
      updateUserWithoutChangingAccessMode(gateway, userId, parsed.data),
    );
  } catch (error) {
    if (
      error instanceof TenantAdministrationError &&
      error.publicCode === 'AUTHORITATIVE_USER_STATE_MISMATCH'
    ) {
      revalidatePath('/users');
      revalidatePath(`/users/${userId}`);
    }
    return tenantUserActionResult(error, 'Não foi possível atualizar o usuário.');
  }

  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
  return { success: true, message: 'Dados do usuário atualizados com sucesso.' };
}

const deleteTenantUserSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(1).max(72),
});

export async function deleteTenantUserAction(
  userId: string,
  password: string,
): Promise<TenantUserFormResult> {
  const parsed = deleteTenantUserSchema.safeParse({ userId, password });
  if (!parsed.success) {
    return {
      success: false,
      message: 'Informe sua senha administrativa para confirmar a exclusão.',
      errorCode: 'VALIDATION_ERROR',
    };
  }

  try {
    await executeAuthenticatedTenantMutation((gateway) =>
      gateway.deleteUser(parsed.data.userId, parsed.data.password),
    );
  } catch (error) {
    return tenantUserActionResult(error, 'Não foi possível excluir o usuário.');
  }

  revalidatePath('/users');
  revalidatePath('/document-management');
  revalidatePath('/administration');
  return { success: true, message: 'Usuário excluído com sucesso.' };
}

const updateUserStatusSchema = z
  .object({
    status: z.enum(['active', 'inactive', 'suspended']),
    suspendedUntil: z.string().datetime().optional(),
    suspensionReason: z.string().trim().max(500).optional(),
  })
  .superRefine((input, context) => {
    if (input.status !== 'suspended') return;

    if (!input.suspendedUntil || Date.parse(input.suspendedUntil) <= Date.now()) {
      context.addIssue({
        code: 'custom',
        message: 'Informe uma data futura para a suspensão.',
        path: ['suspendedUntil'],
      });
    }

    if (!input.suspensionReason || input.suspensionReason.length < 3) {
      context.addIssue({
        code: 'custom',
        message: 'Informe o motivo da suspensão.',
        path: ['suspensionReason'],
      });
    }
  });

export async function updateTenantUserStatusAction(
  userId: string,
  input: unknown,
): Promise<TenantUserFormResult> {
  const parsed = updateUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Revise o estado do usuário.',
      errorCode: 'VALIDATION_ERROR',
    };
  }

  try {
    await executeAuthenticatedTenantMutation((gateway) =>
      gateway.updateUserStatus(userId, parsed.data),
    );
  } catch (error) {
    return tenantUserActionResult(error, 'Não foi possível alterar o estado do usuário.');
  }

  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
  const labels = {
    active: 'ativado',
    inactive: 'desativado',
    suspended: 'suspenso',
  } as const;
  return {
    success: true,
    message: `Usuário ${labels[parsed.data.status]} com sucesso.`,
  };
}

export async function requestTenantUserPasswordResetAction(
  userId: string,
): Promise<TenantUserFormResult> {
  try {
    const result = await executeAuthenticatedTenantMutation((gateway) =>
      gateway.requestPasswordReset(userId),
    );
    revalidatePath('/users');
    return {
      success: true,
      message: `Enviamos as instruções para ${result.recipient}.`,
    };
  } catch (error) {
    return tenantUserActionResult(error, 'Não foi possível solicitar a criação de uma nova senha.');
  }
}
