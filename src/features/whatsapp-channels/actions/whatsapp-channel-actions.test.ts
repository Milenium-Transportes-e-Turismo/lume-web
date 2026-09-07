/** @jest-environment node */

import { revalidatePath } from 'next/cache';

import {
  AUTHENTICATED_SESSION_VERSION,
  type AuthenticatedSession,
  type Permission,
} from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import type { WhatsAppChannelGateway } from '../application';
import type { ManagedWhatsAppChannel } from '../domain';
import {
  executeAuthenticatedWhatsAppChannelMutation,
  executeAuthenticatedWhatsAppChannelRequest,
} from '../server';
import {
  createWhatsAppChannelAction,
  executeWhatsAppChannelAction,
  loadWhatsAppChannelsAction,
  updateWhatsAppChannelAction,
} from './whatsapp-channel-actions';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/features/auth/server', () => ({ getCurrentAuthenticatedSession: jest.fn() }));
jest.mock('../server', () => ({
  executeAuthenticatedWhatsAppChannelMutation: jest.fn(),
  executeAuthenticatedWhatsAppChannelRequest: jest.fn(),
}));

const mockedSession = jest.mocked(getCurrentAuthenticatedSession);
const mockedMutation = jest.mocked(executeAuthenticatedWhatsAppChannelMutation);
const mockedRequest = jest.mocked(executeAuthenticatedWhatsAppChannelRequest);

const channel: ManagedWhatsAppChannel = {
  id: '00000000-0000-4000-8000-000000000101',
  companyId: '00000000-0000-4000-8000-000000000201',
  providerId: 'evolution',
  displayName: 'WhatsApp Matriz',
  phoneNumber: '5534999990000',
  evolutionInstanceName: 'lume-matriz-1',
  evolutionInstanceId: null,
  departmentId: null,
  routingMode: 'general-triage',
  organizationalStatus: 'active',
  connectionStatus: 'connected',
  allowedAutomaticTargetDepartmentIds: [],
  version: 3,
  createdAt: '2026-08-29T10:00:00.000Z',
  updatedAt: '2026-08-29T10:10:00.000Z',
};

function session(permissions: readonly Permission[]): AuthenticatedSession {
  return {
    version: AUTHENTICATED_SESSION_VERSION,
    id: 'session-1',
    user: {
      id: 'user-1',
      name: 'Usuário TI',
      type: 'employee',
      departments: ['information-technology'],
      permissions,
      clientCategory: null,
      isActive: true,
      isAdministrator: true,
    },
    issuedAt: '2026-08-29T10:00:00.000Z',
    expiresAt: '2026-08-29T18:00:00.000Z',
    rememberDevice: false,
  };
}

describe('WhatsApp channel server actions', () => {
  afterEach(() => jest.clearAllMocks());

  it('requires the dedicated view permission before loading channels', async () => {
    mockedSession.mockResolvedValue(session(['dashboard:view']));

    await expect(loadWhatsAppChannelsAction()).resolves.toMatchObject({
      success: false,
      publicCode: 'FORBIDDEN',
    });
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('validates provision input before reaching the gateway', async () => {
    mockedSession.mockResolvedValue(session(['whatsapp-channels:create']));

    await expect(
      createWhatsAppChannelAction({
        commandId: 'not-a-uuid',
        displayName: 'M',
        phoneNumber: '123',
        departmentId: null,
        routingMode: 'general-triage',
        allowedAutomaticTargetDepartmentIds: [],
      }),
    ).resolves.toMatchObject({ success: false, publicCode: 'VALIDATION_ERROR' });
    expect(mockedMutation).not.toHaveBeenCalled();
  });

  it('enforces the action-specific connect permission and forwards versioned commands', async () => {
    mockedSession.mockResolvedValue(session(['whatsapp-channels:connect']));
    mockedMutation.mockResolvedValue({
      channel: { ...channel, version: 4 },
      qrCode: null,
      providerIssue: null,
      infrastructureCleanupPending: false,
    });
    const input = {
      channelId: channel.id,
      action: 'synchronize-connection' as const,
      commandId: '00000000-0000-4000-8000-000000000301',
      expectedVersion: 3,
    };

    await expect(executeWhatsAppChannelAction(input)).resolves.toMatchObject({ success: true });
    expect(mockedMutation).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/whatsapp-channels');
  });
  it('sends channelId only in the URL and preserves the agents toggle', async () => {
    mockedSession.mockResolvedValue(session(['whatsapp-channels:manage']));
    const update = jest.fn().mockResolvedValue({ ...channel, agentsEnabled: false });
    mockedMutation.mockImplementation(async (operation) =>
      operation({ update } as unknown as WhatsAppChannelGateway),
    );
    const result = await updateWhatsAppChannelAction({
      channelId: channel.id,
      commandId: '00000000-0000-4000-8000-000000000301',
      expectedVersion: channel.version,
      displayName: channel.displayName,
      departmentId: null,
      routingMode: 'general-triage',
      allowedAutomaticTargetDepartmentIds: [],
      agentsEnabled: false,
    });
    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      channel.id,
      expect.objectContaining({ agentsEnabled: false, expectedVersion: channel.version }),
    );
    expect(update.mock.calls[0][1]).not.toHaveProperty('channelId');
  });
});
