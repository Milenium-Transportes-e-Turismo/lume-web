import { userFormSchema } from './user-form-schema';

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

  it('allows an initial document portal access without departments', () => {
    expect(
      userFormSchema.safeParse({
        name: 'Novo Candidato',
        username: 'novo.candidato',
        email: 'candidato@example.com',
        password: 'SenhaInicial@2026',
        jobTitle: 'Geral',
        isAdministrator: false,
        documentAccessMode: 'document-portal',
        requestDocuments: true,
        initialDocumentChecklistCode: 'admission-general',
        departments: [],
        permissionCodes: [],
      }).success,
    ).toBe(true);
  });

  it('requires a served company for a legal-entity client', () => {
    const client = {
      name: 'Gestor Cliente',
      username: 'gestor.cliente',
      email: 'gestor@cliente.example',
      password: 'SenhaInicial@2026',
      jobTitle: 'Geral' as const,
      isAdministrator: false as const,
      documentAccessMode: 'client' as const,
      clientCategory: 'legal-entity' as const,
      departments: ['client-company'],
      permissionCodes: [],
    };

    expect(userFormSchema.safeParse(client).success).toBe(false);
    expect(
      userFormSchema.safeParse({
        ...client,
        routingCompanyId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });

  it('requires an individual client to be linked to its client record', () => {
    const client = {
      name: 'Cliente Pessoa Física',
      username: 'cliente.pf',
      email: 'cliente.pf@example.com',
      password: 'SenhaInicial@2026',
      jobTitle: 'Geral' as const,
      isAdministrator: false as const,
      documentAccessMode: 'client' as const,
      clientCategory: 'individual' as const,
      departments: ['client-company'],
      permissionCodes: [],
    };

    expect(userFormSchema.safeParse(client).success).toBe(false);
    expect(
      userFormSchema.safeParse({
        ...client,
        routingCompanyId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });

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
