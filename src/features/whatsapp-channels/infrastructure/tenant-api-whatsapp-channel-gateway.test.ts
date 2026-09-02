/** @jest-environment node */

import { TenantApiWhatsAppChannelGateway } from './tenant-api-whatsapp-channel-gateway';

const channelId = '00000000-0000-4000-8000-000000000101';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function apiChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: channelId,
    companyId: '00000000-0000-4000-8000-000000000201',
    providerId: 'evolution',
    displayName: 'WhatsApp Matriz',
    phoneNumber: '5534999990000',
    evolutionInstanceName: 'lume-matriz-1',
    evolutionInstanceId: 'instance-provider-1',
    departmentId: null,
    routingMode: 'general-triage',
    organizationalStatus: 'active',
    connectionStatus: 'connected',
    allowedAutomaticTargetDepartmentIds: [],
    version: 3,
    createdAt: '2026-08-29T10:00:00.000Z',
    updatedAt: '2026-08-29T10:10:00.000Z',
    ...overrides,
  };
}

describe('TenantApiWhatsAppChannelGateway', () => {
  it('lists the real managed channel contract', async () => {
    const fetcher = jest.fn().mockResolvedValue(jsonResponse([apiChannel()]));
    const gateway = new TenantApiWhatsAppChannelGateway(
      'https://tenant.example/api/v1/',
      'access-token',
      fetcher,
    );

    await expect(gateway.list()).resolves.toEqual([
      expect.objectContaining({
        id: channelId,
        organizationalStatus: 'active',
        connectionStatus: 'connected',
        version: 3,
      }),
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant.example/api/v1/whatsapp/channels',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it.each([
    'request-qr',
    'reconnect',
    'synchronize-connection',
    'disconnect',
    'cancel-setup',
    'disable',
  ] as const)('posts the versioned %s action to its published route', async (action) => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        channel: apiChannel({ version: 4 }),
        qrCode: action === 'request-qr' ? { code: null, base64: 'YWJjZA==' } : null,
        providerIssue: null,
      }),
    );
    const gateway = new TenantApiWhatsAppChannelGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    const input = {
      commandId: '00000000-0000-4000-8000-000000000301',
      expectedVersion: 3,
    };

    const result = await gateway.executeAction(channelId, action, input);

    expect(result.infrastructureCleanupPending).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/whatsapp/channels/${channelId}/actions/${action}`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('sends the exact provision and update DTOs', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ channel: apiChannel(), qrCode: null, providerIssue: null }),
      )
      .mockResolvedValueOnce(jsonResponse(apiChannel({ displayName: 'WhatsApp Comercial' })));
    const gateway = new TenantApiWhatsAppChannelGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    const createInput = {
      commandId: '00000000-0000-4000-8000-000000000301',
      displayName: 'WhatsApp Matriz',
      phoneNumber: '5534999990000',
      departmentId: null,
      routingMode: 'general-triage' as const,
      allowedAutomaticTargetDepartmentIds: [],
    };
    const updateInput = {
      commandId: '00000000-0000-4000-8000-000000000302',
      expectedVersion: 3,
      displayName: 'WhatsApp Comercial',
      departmentId: null,
      routingMode: 'general-triage' as const,
      allowedAutomaticTargetDepartmentIds: [],
    };

    await gateway.create(createInput);
    await gateway.update(channelId, updateInput);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://tenant.example/api/v1/whatsapp/channels',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(createInput) }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `https://tenant.example/api/v1/whatsapp/channels/${channelId}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(updateInput) }),
    );
  });

  it('rejects executable SVG data and exposes the authoritative version on conflicts', async () => {
    const invalidQrFetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        channel: apiChannel(),
        qrCode: { code: null, base64: 'data:image/svg+xml;base64,PHN2Zz4=' },
        providerIssue: null,
      }),
    );
    const invalidQrGateway = new TenantApiWhatsAppChannelGateway(
      'https://tenant.example/api/v1',
      'access-token',
      invalidQrFetcher,
    );

    await expect(
      invalidQrGateway.executeAction(channelId, 'request-qr', {
        commandId: '00000000-0000-4000-8000-000000000301',
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });

    const conflictFetcher = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          code: 'CHANNEL_VERSION_CONFLICT',
          message: 'O canal foi alterado por outro usuário.',
          details: { currentVersion: 8 },
        },
        409,
      ),
    );
    const conflictGateway = new TenantApiWhatsAppChannelGateway(
      'https://tenant.example/api/v1',
      'access-token',
      conflictFetcher,
    );

    await expect(conflictGateway.get(channelId)).rejects.toMatchObject({
      code: 'conflict',
      publicCode: 'CHANNEL_VERSION_CONFLICT',
      currentVersion: 8,
    });
  });
});
