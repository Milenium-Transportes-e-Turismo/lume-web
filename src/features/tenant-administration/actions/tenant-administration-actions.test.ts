import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { TenantAdministrationError, type TenantAdministrationGateway } from '../application';
import { executeAuthenticatedTenantMutation } from '../server';
import {
  createTenantUserAction,
  createTenantUserFormAction,
  deleteTenantUserAction,
  updateTenantUserAction,
  updateTenantUserFormAction,
} from './tenant-administration-actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('../server', () => ({
  executeAuthenticatedTenantMutation: jest.fn(),
}));

describe('tenant administration user actions', () => {
  const mockedRedirect = jest.mocked(redirect);
  const currentUser = {
    version: 7,
    id: '00000000-0000-4000-8000-000000000001',
    documentAccessMode: 'standard' as const,
    departments: ['commercial'],
    permissionCodes: ['commercial:view'],
    clientCategory: null,
    routingCompanyId: null,
  };
  const createUser = jest.fn();
  const deleteUser = jest.fn();
  const getUser = jest.fn();
  const updateUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    createUser.mockResolvedValue({});
    deleteUser.mockResolvedValue({ deleted: true });
    getUser.mockResolvedValue(currentUser);
    updateUser.mockImplementation(async (_userId, input) => ({ ...currentUser, ...input }));
    jest.mocked(executeAuthenticatedTenantMutation).mockImplementation(async (operation) =>
      operation({
        createUser,
        deleteUser,
        getUser,
        updateUser,
      } as unknown as TenantAdministrationGateway),
    );
  });

  it('rejects administrator creation before calling the Tenant API', async () => {
    await expect(
      createTenantUserFormAction({
        name: 'Admin Lume',
        username: 'admin.lume',
        email: 'admin@example.com',
        password: 'SenhaForte@2026',
        isAdministrator: true,
        departments: ['commercial', 'management'],
        permissionCodes: ['dashboard:view', 'users:manage'],
      }),
    ).resolves.toEqual({
      success: false,
      message: 'Contas administradoras não podem ser criadas pelo Tenant Web.',
      errorCode: 'VALIDATION_ERROR',
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a numeric-only username before calling the gateway', async () => {
    await expect(
      createTenantUserFormAction({
        name: 'Usuário Numérico',
        username: '123456',
        email: 'numerico@example.com',
        password: 'SenhaForte@2026',
        isAdministrator: false,
        departments: ['commercial'],
        permissionCodes: ['commercial:view'],
      }),
    ).resolves.toEqual({
      success: false,
      message: 'O nome de usuário deve conter ao menos uma letra.',
      errorCode: 'VALIDATION_ERROR',
    });

    expect(createUser).not.toHaveBeenCalled();
  });

  it('returns the public API error code without exposing error details', async () => {
    createUser.mockRejectedValueOnce(
      new TenantAdministrationError(
        'forbidden',
        'Você não possui permissão para cadastrar este usuário.',
        'FORBIDDEN',
      ),
    );

    await expect(
      createTenantUserFormAction({
        name: 'Usuário Comercial',
        username: 'usuario.comercial',
        email: 'comercial@example.com',
        password: 'SenhaForte@2026',
        isAdministrator: false,
        departments: ['commercial'],
        permissionCodes: ['commercial:view'],
      }),
    ).resolves.toEqual({
      success: false,
      message: 'Você não possui permissão para cadastrar este usuário.',
      errorCode: 'FORBIDDEN',
    });
  });

  it('creates documentation only when a collaborator explicitly requests it', async () => {
    const baseInput = {
      name: 'Usuário Comercial',
      username: 'usuario.comercial',
      email: 'comercial@example.com',
      password: 'SenhaForte@2026',
      isAdministrator: false,
      documentAccessMode: 'standard' as const,
      departments: ['commercial'],
      permissionCodes: ['commercial:view'],
    };

    await createTenantUserFormAction({ ...baseInput, requestDocuments: false });
    expect(createUser).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ initialDocumentRequestCommandId: expect.anything() }),
    );

    await createTenantUserFormAction({ ...baseInput, requestDocuments: true });
    expect(createUser).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestDocuments: true,
        initialDocumentRequestCommandId: expect.any(String),
      }),
    );
  });

  it.each(['document-portal', 'client'] as const)(
    'rejects new %s accounts before calling the Tenant API',
    async (documentAccessMode) => {
      await expect(
        createTenantUserFormAction({
          name: 'Acesso Externo',
          username: 'acesso.externo',
          email: 'externo@example.com',
          password: 'SenhaForte@2026',
          isAdministrator: false,
          documentAccessMode,
          requestDocuments: true,
          departments: [],
          permissionCodes: [],
        }),
      ).resolves.toEqual({
        success: false,
        message:
          'Novas contas de candidato ou cliente não podem ser criadas pelo Tenant Web neste momento.',
        errorCode: 'VALIDATION_ERROR',
      });
      expect(createUser).not.toHaveBeenCalled();
    },
  );

  it.each(['document-portal', 'client'] as const)(
    'rejects a forged %s account submitted through FormData',
    async (documentAccessMode) => {
      const formData = new FormData();
      formData.set('name', 'Acesso Externo');
      formData.set('username', 'acesso.externo');
      formData.set('email', 'externo@example.com');
      formData.set('password', 'SenhaForte@2026');
      formData.set('documentAccessMode', documentAccessMode);
      mockedRedirect.mockImplementationOnce((destination) => {
        throw new Error(`NEXT_REDIRECT:${destination}`);
      });

      await expect(createTenantUserAction(formData)).rejects.toThrow(
        'NEXT_REDIRECT:/users?error=Revise os dados do novo usuário.',
      );
      expect(createUser).not.toHaveBeenCalled();
    },
  );

  it('deletes a user only through the dedicated authenticated action', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    await expect(deleteTenantUserAction(userId, 'SenhaAdministrativa@2026')).resolves.toEqual({
      success: true,
      message: 'Usuário excluído com sucesso.',
    });
    expect(deleteUser).toHaveBeenCalledWith(userId, 'SenhaAdministrativa@2026');
    expect(revalidatePath).toHaveBeenCalledWith('/users');
    expect(revalidatePath).toHaveBeenCalledWith('/document-management');
    expect(revalidatePath).toHaveBeenCalledWith('/administration');
  });

  it('preserves explicit department assignments without mutating administrator authority', async () => {
    await expect(
      updateTenantUserFormAction('00000000-0000-4000-8000-000000000001', {
        name: 'Usuário Comercial',
        email: 'comercial@example.com',
        isAdministrator: false,
        departments: ['commercial'],
        permissionCodes: ['commercial:view'],
      }),
    ).resolves.toMatchObject({ success: true });

    expect(updateUser).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', {
      commandId: expect.any(String),
      expectedVersion: 7,
      name: 'Usuário Comercial',
      email: 'comercial@example.com',
      departments: ['commercial'],
      permissionCodes: ['commercial:view'],
    });
  });

  it('reports a conflict when the Tenant API discards requested access changes', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    updateUser.mockResolvedValueOnce(currentUser);

    await expect(
      updateTenantUserFormAction(userId, {
        name: 'Usuário Operacional',
        email: 'operacional@example.com',
        isAdministrator: false,
        departments: ['operations'],
        permissionCodes: ['routes:view'],
      }),
    ).resolves.toEqual({
      success: false,
      message:
        'A Tenant API atualizou os dados, mas não confirmou todos os acessos solicitados. O estado autoritativo deve ser recarregado.',
      errorCode: 'AUTHORITATIVE_USER_STATE_MISMATCH',
    });

    expect(revalidatePath).toHaveBeenCalledWith('/users');
    expect(revalidatePath).toHaveBeenCalledWith(`/users/${userId}`);
  });

  it('cannot promote a user through a crafted update payload', async () => {
    await expect(
      updateTenantUserFormAction('00000000-0000-4000-8000-000000000001', {
        name: 'Usuário Comercial',
        email: 'comercial@example.com',
        isAdministrator: true,
        departments: [],
        permissionCodes: [],
      }),
    ).resolves.toMatchObject({ success: true });

    expect(updateUser).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', {
      commandId: expect.any(String),
      expectedVersion: 7,
      name: 'Usuário Comercial',
      email: 'comercial@example.com',
    });
  });

  it('rejects changing the access mode of an existing account', async () => {
    await expect(
      updateTenantUserFormAction('00000000-0000-4000-8000-000000000001', {
        name: 'Usuário Comercial',
        email: 'comercial@example.com',
        isAdministrator: false,
        documentAccessMode: 'document-portal',
        departments: [],
        permissionCodes: [],
      }),
    ).resolves.toEqual({
      success: false,
      message:
        'O modo de acesso existente não pode ser alterado enquanto a migração de contas legadas não estiver definida.',
      errorCode: 'ACCESS_MODE_CHANGE_NOT_ALLOWED',
    });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it('rejects an access-mode conversion submitted through FormData', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const formData = new FormData();
    formData.set('name', 'Cliente Forjado');
    formData.set('email', 'cliente@example.com');
    formData.set('documentAccessMode', 'client');
    formData.set('clientCategory', 'legal-entity');
    formData.set('routingCompanyId', '11111111-1111-4111-8111-111111111111');
    formData.append('departments', 'client-company');
    mockedRedirect.mockImplementationOnce((destination) => {
      throw new Error(`NEXT_REDIRECT:${destination}`);
    });

    await expect(updateTenantUserAction(userId, formData)).rejects.toThrow('NEXT_REDIRECT:');
    expect(getUser).toHaveBeenCalledWith(userId);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updates a user from FormData without sending documentAccessMode', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const formData = new FormData();
    formData.set('name', 'Usuário Comercial');
    formData.set('email', 'comercial@example.com');
    formData.append('departments', 'commercial');
    formData.append('permissionCodes', 'commercial:view');
    mockedRedirect.mockImplementationOnce((destination) => {
      throw new Error(`NEXT_REDIRECT:${destination}`);
    });

    await expect(updateTenantUserAction(userId, formData)).rejects.toThrow(
      `NEXT_REDIRECT:/users/${userId}?success=Usuário atualizado com sucesso.`,
    );
    expect(updateUser).toHaveBeenCalledWith(userId, {
      commandId: expect.any(String),
      expectedVersion: 7,
      name: 'Usuário Comercial',
      email: 'comercial@example.com',
      departments: ['commercial'],
      permissionCodes: ['commercial:view'],
      maritalStatus: 'not-informed',
      militaryDocumentStatus: 'pending-confirmation',
      dependents: [],
    });
    expect(updateUser).toHaveBeenCalledWith(
      userId,
      expect.not.objectContaining({ documentAccessMode: expect.anything() }),
    );
  });

  it('preserves and updates an existing legacy client account without converting it', async () => {
    getUser.mockResolvedValueOnce({
      ...currentUser,
      documentAccessMode: 'client',
      clientCategory: 'legal-entity',
      routingCompanyId: '11111111-1111-4111-8111-111111111111',
      departments: ['client-company'],
      permissionCodes: [],
    });

    await expect(
      updateTenantUserFormAction('00000000-0000-4000-8000-000000000001', {
        name: 'Cliente Legado',
        email: 'cliente@example.com',
        isAdministrator: false,
        documentAccessMode: 'client',
        clientCategory: 'legal-entity',
        routingCompanyId: '11111111-1111-4111-8111-111111111111',
        departments: ['client-company'],
        permissionCodes: [],
      }),
    ).resolves.toMatchObject({ success: true });

    expect(updateUser).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      expect.objectContaining({
        clientCategory: 'legal-entity',
        routingCompanyId: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(updateUser).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      expect.not.objectContaining({ documentAccessMode: expect.anything() }),
    );
  });
  it('preserves the editor version and command instead of silently replacing a stale version', async () => {
    const commandId = '11111111-1111-4111-8111-111111111111';
    updateUser.mockRejectedValueOnce(
      new TenantAdministrationError('conflict', 'Recarregue o usuário.', 'VERSION_CONFLICT'),
    );
    const result = await updateTenantUserFormAction(currentUser.id, {
      name: 'Usuário Comercial',
      email: 'comercial@example.com',
      isAdministrator: false,
      departments: ['commercial'],
      permissionCodes: ['commercial:view'],
      expectedVersion: 6,
      commandId,
    });
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith(
      currentUser.id,
      expect.objectContaining({ expectedVersion: 6, commandId }),
    );
    expect(result).toMatchObject({ success: false, errorCode: 'VERSION_CONFLICT' });
    expect(revalidatePath).toHaveBeenCalledWith(`/users/${currentUser.id}`);
  });

  it.each([{ expectedVersion: 0 }, { expectedVersion: 1.5 }, { commandId: 'invalid' }])(
    'rejects invalid command metadata %j',
    async (metadata) => {
      const result = await updateTenantUserFormAction(currentUser.id, {
        name: 'Usuário Comercial',
        email: 'comercial@example.com',
        isAdministrator: false,
        departments: ['commercial'],
        permissionCodes: ['commercial:view'],
        ...metadata,
      });
      expect(result.success).toBe(false);
      expect(updateUser).not.toHaveBeenCalled();
    },
  );
});
