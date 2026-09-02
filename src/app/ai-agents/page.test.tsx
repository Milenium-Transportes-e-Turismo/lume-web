/** @jest-environment node */

import { redirect } from 'next/navigation';

import {
  AUTHENTICATED_SESSION_VERSION,
  type AuthenticatedSession,
  type Permission,
} from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { AiAgentsPage } from '@/features/ai-agents/pages';
import { executeAuthenticatedAgentAdministrationRequest } from '@/features/ai-agents/server';

import Page from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/features/auth/server', () => ({
  getCurrentAuthenticatedSession: jest.fn(),
}));

jest.mock('@/features/ai-agents/server', () => ({
  executeAuthenticatedAgentAdministrationRequest: jest.fn(),
}));

const mockedGetCurrentAuthenticatedSession = jest.mocked(getCurrentAuthenticatedSession);
const mockedRedirect = jest.mocked(redirect);
const mockedExecuteRequest = jest.mocked(executeAuthenticatedAgentAdministrationRequest);

function createSession(permissions: readonly Permission[]): AuthenticatedSession {
  return {
    version: AUTHENTICATED_SESSION_VERSION,
    id: 'session-employee-001',
    user: {
      id: 'employee-001',
      name: 'Maria Silva',
      type: 'employee',
      departments: [],
      permissions,
      clientCategory: null,
      isActive: true,
    },
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    rememberDevice: false,
  };
}

describe('AI agents page route', () => {
  beforeEach(() => {
    mockedRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
    mockedExecuteRequest.mockResolvedValue([]);
  });

  afterEach(() => {
    mockedGetCurrentAuthenticatedSession.mockReset();
    mockedRedirect.mockReset();
    mockedExecuteRequest.mockReset();
  });

  it('redirects a visitor without a session to login', async () => {
    mockedGetCurrentAuthenticatedSession.mockResolvedValue(null);

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/login');
  });

  it('redirects a user without AI agent access to the dashboard', async () => {
    mockedGetCurrentAuthenticatedSession.mockResolvedValue(createSession(['dashboard:view']));

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('renders the catalog for a session with AI agent access', async () => {
    const session = createSession(['dashboard:view', 'ai-agents:view']);
    mockedGetCurrentAuthenticatedSession.mockResolvedValue(session);

    const page = await Page();

    expect(page.type).toBe(AiAgentsPage);
    expect(page.props.session).toBe(session);
    expect(page.props.initialAgents).toEqual([]);
    expect(page.props.initialExecutions).toBeNull();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
