import { TenantAdministrationError } from '../application';
import { TenantApiAdministrationGateway } from './tenant-api-administration-gateway';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('TenantApiAdministrationGateway', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts permission codes introduced by the backend', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        resources: ['future-module'],
        actions: ['review'],
        actionsByResource: { 'future-module': ['review'] },
        permissions: ['future-module:review'],
      }),
    );
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1/',
      'access-token',
      fetcher,
    );

    const catalog = await gateway.listPermissions();

    expect(catalog.permissions).toEqual(['future-module:review']);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/permissions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('keeps tenant user updates inside the local API', async () => {
    const responseUser = {
      version: 7,
      id: '5a19a7d8-4aa8-4d35-b758-8450f865cff0',
      name: 'Ana Souza',
      username: 'ana.souza',
      email: 'ana@example.com',
      cpf: null,
      type: 'employee',
      departments: ['commercial'],
      isAdministrator: false,
      permissions: ['dashboard:view'],
      clientCategory: null,
      isActive: false,
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T01:00:00.000Z',
    };
    const fetcher = jest.fn().mockResolvedValue(jsonResponse(responseUser));
    const gateway = new TenantApiAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );

    await gateway.updateUserStatus(responseUser.id, { status: 'inactive' });

    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/users/${responseUser.id}/status`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'inactive' }),
      }),
    );
  });

  it('forwards department, permission and lifecycle filters to the Tenant API', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [],
        meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
      }),
    );
    const gateway = new TenantApiAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );

    await gateway.listUsers({
      page: 2,
      search: 'maria',
      department: 'financial',
      permission: 'financial:approve',
      status: 'suspended',
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant.example/api/v1/users?page=2&pageSize=20&search=maria&department=financial&permission=financial%3Aapprove&status=suspended',
      expect.any(Object),
    );
  });

  it('reads direct permissions and suspension metadata from the canonical user response', async () => {
    const suspended = {
      version: 7,
      id: '5a19a7d8-4aa8-4d35-b758-8450f865cff0',
      name: 'Ana Souza',
      username: 'ana.souza',
      email: 'ana@example.com',
      cpf: null,
      type: 'employee',
      departments: ['financial'],
      isAdministrator: false,
      permissionCodes: ['financial:view'],
      permissions: ['financial:view', 'profile:view'],
      clientCategory: null,
      isActive: false,
      status: 'suspended',
      suspendedUntil: '2026-08-10T23:59:59.000Z',
      suspensionReason: 'Afastamento temporário',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-28T01:00:00.000Z',
    };
    const fetcher = jest.fn().mockResolvedValue(jsonResponse(suspended));
    const gateway = new TenantApiAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.getUser(suspended.id)).resolves.toMatchObject({
      permissionCodes: ['financial:view'],
      status: 'suspended',
      suspendedUntil: suspended.suspendedUntil,
      suspensionReason: suspended.suspensionReason,
      isAdministrator: false,
    });
  });

  it('sends and reads the canonical administrator flag', async () => {
    const administrator = {
      version: 7,
      id: '5a19a7d8-4aa8-4d35-b758-8450f865cff0',
      name: 'Admin Lume',
      username: 'admin.lume',
      email: 'admin@example.com',
      cpf: null,
      type: 'employee',
      departments: ['commercial', 'management'],
      isAdministrator: true,
      permissionCodes: [],
      permissions: ['dashboard:view', 'users:manage'],
      clientCategory: null,
      isActive: true,
      status: 'active',
      suspendedUntil: null,
      suspensionReason: null,
      createdAt: '2026-07-28T08:00:00.000Z',
      updatedAt: '2026-07-28T08:00:00.000Z',
    };
    const fetcher = jest.fn().mockResolvedValue(jsonResponse(administrator));
    const gateway = new TenantApiAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );

    await expect(
      gateway.createUser({
        name: administrator.name,
        username: administrator.username,
        email: administrator.email,
        password: 'SenhaInicial@2026',
        isAdministrator: true,
        departments: [],
        permissionCodes: [],
      }),
    ).resolves.toMatchObject({ isAdministrator: true });
    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant.example/api/v1/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: administrator.name,
          username: administrator.username,
          email: administrator.email,
          password: 'SenhaInicial@2026',
          isAdministrator: true,
          departments: [],
          permissionCodes: [],
        }),
      }),
    );
  });

  it('accepts the license state returned by the running Tenant API contract', async () => {
    const license = {
      state: 'active',
      tenantId: 'tenant-001',
      installationId: 'installation-001',
      plan: 'enterprise',
      features: ['users'],
      expiresAt: '2027-07-25T00:00:00.000Z',
      graceUntil: '2027-08-24T00:00:00.000Z',
    };
    const fetcher = jest.fn().mockResolvedValue(jsonResponse(license));
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.getLicenseStatus()).resolves.toEqual(license);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/license/status',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('deletes a user through the authenticated API contract', async () => {
    const fetcher = jest.fn().mockResolvedValue(jsonResponse({ deleted: true }));
    const gateway = new TenantApiAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    const userId = '00000000-0000-4000-8000-000000000001';

    await expect(gateway.deleteUser(userId, 'SenhaAdministrativa@2026')).resolves.toEqual({
      deleted: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/users/${userId}`,
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ password: 'SenhaAdministrativa@2026' }),
      }),
    );
  });

  it('reads department-scoped notifications from the authenticated Tenant API', async () => {
    const notifications = {
      items: [
        {
          id: 'commercial.pending-quote-proposals',
          type: 'quote-proposal-pending',
          department: 'commercial',
          title: '2 orçamentos pendentes',
          description: 'A fila Comercial possui orçamentos aguardando envio.',
          href: '/quote-proposals',
          count: 2,
          unreadCount: 2,
          read: false,
        },
      ],
      total: 2,
      unreadTotal: 2,
    };
    const fetcher = jest.fn().mockResolvedValue(jsonResponse(notifications));
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.getNotifications()).resolves.toEqual(notifications);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/notifications',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('persists a notification read receipt without a request body', async () => {
    const receipt = {
      notificationId: 'commercial.pending-quote-proposals',
      pendingTotal: 2,
      unreadTotal: 0,
      markedRead: 2,
      readAt: '2026-07-29T01:00:00.000Z',
    };
    const fetcher = jest.fn().mockResolvedValue(jsonResponse(receipt));
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1',
      'access-token',
      fetcher,
    );

    await expect(
      gateway.markNotificationRead('commercial.pending-quote-proposals'),
    ).resolves.toEqual(receipt);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/notifications/commercial.pending-quote-proposals/read',
      expect.objectContaining({
        method: 'POST',
        body: undefined,
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('maps an incompatible success payload to the integration error contract', async () => {
    const fetcher = jest.fn().mockResolvedValue(jsonResponse({ state: 'VALID' }));
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.getLicenseStatus()).rejects.toMatchObject<
      Partial<TenantAdministrationError>
    >({
      code: 'invalid-response',
      message: 'A API local retornou uma resposta incompatível com o frontend.',
    });
  });

  it('preserves validation messages returned as an array by NestJS', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ message: ['email must be an email', 'name is too short'] }, 400),
      );
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.listPermissions()).rejects.toMatchObject<
      Partial<TenantAdministrationError>
    >({
      code: 'validation',
      message: 'email must be an email name is too short',
      publicCode: 'HTTP_400',
    });
  });

  it('preserves a safe public error code returned by the Tenant API', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          code: 'FORBIDDEN',
          message: 'Você não possui permissão para esta operação.',
          details: { internalPolicy: 'must-not-reach-the-toast' },
        },
        403,
      ),
    );
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.listPermissions()).rejects.toMatchObject<
      Partial<TenantAdministrationError>
    >({
      code: 'forbidden',
      message: 'Você não possui permissão para esta operação.',
      publicCode: 'FORBIDDEN',
    });
  });

  it('does not expose an internal server message while preserving its public code', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          code: 'INTERNAL_ERROR',
          message: 'database password and internal stack trace',
        },
        500,
      ),
    );
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.listPermissions()).rejects.toMatchObject<
      Partial<TenantAdministrationError>
    >({
      code: 'service-unavailable',
      message: 'A API respondeu com o status 500.',
      publicCode: 'INTERNAL_ERROR',
    });
  });

  it('uses the timeout supplied by the Tenant API configuration', async () => {
    const requestSignal = new AbortController().signal;
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(requestSignal);
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        resources: [],
        actions: [],
        actionsByResource: {},
        permissions: [],
      }),
    );
    const gateway = new TenantApiAdministrationGateway(
      'http://localhost:3333/api/v1',
      'access-token',
      fetcher,
      7_500,
    );

    await gateway.listPermissions();

    expect(timeout).toHaveBeenCalledWith(7_500);
  });
  it('preserves authoritative versions and sends the complete update contract', async () => {
    const responseUser = {
      version: 7,
      id: '5a19a7d8-4aa8-4d35-b758-8450f865cff0',
      name: 'Ana Souza',
      username: 'ana.souza',
      email: 'ana@example.com',
      cpf: null,
      type: 'employee',
      departments: ['commercial'],
      isAdministrator: false,
      permissions: ['dashboard:view'],
      clientCategory: null,
      isActive: false,
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T01:00:00.000Z',
    };

    const fetcher = jest.fn().mockResolvedValue(jsonResponse(responseUser));
    const gateway = new TenantApiAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    await expect(gateway.getUser(responseUser.id)).resolves.toMatchObject({ version: 7 });
    const input = {
      name: 'Ana Souza',
      commandId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 7,
    };
    await gateway.updateUser(responseUser.id, input);
    expect(fetcher).toHaveBeenLastCalledWith(
      `https://tenant.example/api/v1/users/${responseUser.id}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }),
    );
    fetcher.mockResolvedValueOnce(jsonResponse({ ...responseUser, version: undefined }));
    await expect(gateway.getUser(responseUser.id)).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });
});
