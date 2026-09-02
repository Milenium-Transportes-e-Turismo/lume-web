/** @jest-environment node */

import { revalidatePath } from 'next/cache';

import {
  AUTHENTICATED_SESSION_VERSION,
  type AuthenticatedSession,
  type Permission,
} from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

import type { ManagedAiAgent } from '../domain';
import {
  executeAuthenticatedAgentAdministrationMutation,
  executeAuthenticatedAgentAdministrationRequest,
} from '../server';
import {
  loadAiAgentsAction,
  updateTenantAgentInstructionsAction,
} from './agent-administration-actions';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/features/auth/server', () => ({ getCurrentAuthenticatedSession: jest.fn() }));
jest.mock('../server', () => ({
  executeAuthenticatedAgentAdministrationMutation: jest.fn(),
  executeAuthenticatedAgentAdministrationRequest: jest.fn(),
}));

const mockedSession = jest.mocked(getCurrentAuthenticatedSession);
const mockedMutation = jest.mocked(executeAuthenticatedAgentAdministrationMutation);
const mockedRequest = jest.mocked(executeAuthenticatedAgentAdministrationRequest);

const agent: ManagedAiAgent = {
  id: '00000000-0000-4000-8000-000000000101',
  code: 'commercial-assistant',
  name: 'Assistente comercial',
  description: null,
  type: 'customer-service',
  status: 'active',
  contexts: ['whatsapp'],
  customerFacing: true,
  platformManaged: true,
  promptVersions: [],
  runtimeConfigs: [],
  configurationStatus: 'incomplete',
  technicalConfigurationMutable: false,
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
    },
    issuedAt: '2026-08-29T10:00:00.000Z',
    expiresAt: '2026-08-29T18:00:00.000Z',
    rememberDevice: false,
  };
}

describe('agent administration server actions', () => {
  afterEach(() => jest.clearAllMocks());

  it('requires ai-agents:view before loading the real catalog', async () => {
    mockedSession.mockResolvedValue(session(['dashboard:view']));

    await expect(loadAiAgentsAction()).resolves.toMatchObject({
      success: false,
      publicCode: 'FORBIDDEN',
    });
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('returns the catalog to a viewer', async () => {
    mockedSession.mockResolvedValue(session(['ai-agents:view']));
    mockedRequest.mockResolvedValue([agent]);

    await expect(loadAiAgentsAction()).resolves.toEqual({ success: true, agents: [agent] });
  });

  it('publishes tenant instructions only for managers with versioned idempotency', async () => {
    mockedSession.mockResolvedValue(session(['ai-agents:view', 'ai-agents:manage']));
    mockedMutation.mockResolvedValue({
      agentId: agent.id,
      promptVersionId: '00000000-0000-4000-8000-000000000201',
      version: 2,
      contentHash: 'sha256:new',
      idempotent: false,
    });
    const input = {
      agentId: agent.id,
      commandId: '00000000-0000-4000-8000-000000000301',
      expectedVersion: 1,
      content: 'Responda com objetividade.',
    };

    await expect(updateTenantAgentInstructionsAction(input)).resolves.toMatchObject({
      success: true,
      version: 2,
    });
    expect(mockedMutation).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/ai-agents');
  });
});
