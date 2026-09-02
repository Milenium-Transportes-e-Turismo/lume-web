import { userEditorFormSchema, userFormSchema } from './user-form-schema';

describe('userFormSchema', () => {
  it('accepts the four requested identity fields and tenant assignments', () => {
    expect(
      userFormSchema.safeParse({
        name: 'Taiane Karine',
        username: 'taiane',
        email: 'taiane@example.com',
        password: 'SenhaInicial@2026',
        jobTitle: 'Geral',
        isAdministrator: false,
        departments: ['operations'],
        permissionCodes: ['dashboard:view'],
      }).success,
    ).toBe(true);
  });

  it('does not accept a CPF field as part of the form contract', () => {
    const parsed = userFormSchema.safeParse({
      name: 'Taiane Karine',
      username: 'taiane',
      email: 'taiane@example.com',
      password: 'SenhaInicial@2026',
      jobTitle: 'Geral',
      cpf: '52998224725',
      isAdministrator: false,
      departments: ['operations'],
      permissionCodes: ['dashboard:view'],
    });
    expect(parsed.success).toBe(false);
  });

  it('requires the username to contain at least one letter', () => {
    const parsed = userFormSchema.safeParse({
      name: 'Taiane Karine',
      username: '123456',
      email: 'taiane@example.com',
      password: 'SenhaInicial@2026',
      jobTitle: 'Geral',
      isAdministrator: false,
      departments: ['operations'],
      permissionCodes: ['dashboard:view'],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['username'],
        message: 'O nome de usuário deve conter ao menos uma letra.',
      }),
    );
  });

  it('requires a department but allows only the common implicit permissions', () => {
    const identity = {
      name: 'Taiane Karine',
      username: 'taiane',
      email: 'taiane@example.com',
      password: 'SenhaInicial@2026',
      jobTitle: 'Geral' as const,
      isAdministrator: false,
    };

    expect(
      userFormSchema.safeParse({
        ...identity,
        departments: [],
        permissionCodes: ['dashboard:view'],
      }).success,
    ).toBe(false);
    expect(
      userFormSchema.safeParse({
        ...identity,
        departments: ['operations'],
        permissionCodes: [],
      }).success,
    ).toBe(true);
  });

  it.each(['document-portal', 'client'] as const)(
    'rejects creating a new %s account',
    (documentAccessMode) => {
      const parsed = userFormSchema.safeParse({
        name: 'Acesso Externo',
        username: 'acesso.externo',
        email: 'externo@example.com',
        password: 'SenhaInicial@2026',
        jobTitle: 'Geral',
        isAdministrator: false,
        documentAccessMode,
        requestDocuments: true,
        departments: [],
        permissionCodes: [],
      });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe(
        'Novas contas de candidato ou cliente não podem ser criadas pelo Tenant Web neste momento.',
      );
    },
  );

  it('rejects the external client scope on a new collaborator account', () => {
    const parsed = userFormSchema.safeParse({
      name: 'Novo Colaborador',
      username: 'novo.colaborador',
      email: 'colaborador@example.com',
      password: 'SenhaInicial@2026',
      jobTitle: 'Geral',
      isAdministrator: false,
      documentAccessMode: 'standard',
      departments: ['client-company'],
      permissionCodes: [],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['departments'],
        message: 'Empresa cliente não é um departamento válido para uma nova conta de colaborador.',
      }),
    );
  });

  it.each(['document-portal', 'client'] as const)(
    'keeps the editor compatible with an existing %s account',
    (documentAccessMode) => {
      expect(
        userEditorFormSchema.safeParse({
          name: 'Acesso Legado',
          email: 'legado@example.com',
          isAdministrator: false,
          documentAccessMode,
          clientCategory: documentAccessMode === 'client' ? 'legal-entity' : null,
          routingCompanyId:
            documentAccessMode === 'client' ? '11111111-1111-4111-8111-111111111111' : null,
          departments: documentAccessMode === 'client' ? ['client-company'] : [],
          permissionCodes: [],
          jobTitle: 'Geral',
          maritalStatus: 'not-informed',
          militaryDocumentStatus: 'pending-confirmation',
          dependents: [],
        }).success,
      ).toBe(true);
    },
  );

  it('does not allow creating an administrator through the Tenant Web', () => {
    const parsed = userFormSchema.safeParse({
      name: 'Taiane Karine',
      username: 'taiane',
      email: 'taiane@example.com',
      password: 'SenhaInicial@2026',
      jobTitle: 'Geral',
      isAdministrator: true,
      departments: [],
      permissionCodes: [],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      'Contas administradoras não podem ser criadas pelo Tenant Web.',
    );
  });
});
