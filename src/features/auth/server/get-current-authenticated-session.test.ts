/** @jest-environment node */

import type {
  ApiAuthenticationTokens,
  ApiTokenStorage,
  AuthenticationGateway,
  SessionStorage,
} from '../application';
import { AUTHENTICATED_SESSION_VERSION, type AuthenticatedSession, type User } from '../domain';
import {
  createCookieApiTokenStorage,
  createCookieSessionStorage,
  createTenantApiAuthenticationGateway,
} from '../infrastructure';
import { getCurrentAuthenticatedSession } from './get-current-authenticated-session';

jest.mock('../infrastructure', () => ({
  createCookieApiTokenStorage: jest.fn(),
  createCookieSessionStorage: jest.fn(),
  createTenantApiAuthenticationGateway: jest.fn(),
}));

const mockedCreateCookieApiTokenStorage = jest.mocked(createCookieApiTokenStorage);
const mockedCreateCookieSessionStorage = jest.mocked(createCookieSessionStorage);
const mockedCreateAuthenticationGateway = jest.mocked(createTenantApiAuthenticationGateway);
const originalSimulationFlag = process.env.AUTH_SIMULATION_ENABLED;

function createValidSession(): AuthenticatedSession {
  return {
    version: AUTHENTICATED_SESSION_VERSION,
    id: 'session-employee-001',
    user: {
      id: 'employee-001',
      name: 'Usuário armazenado',
      type: 'employee',
      departments: ['commercial'],
      permissions: ['dashboard:view'],
      clientCategory: null,
      isActive: true,
    },
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    rememberDevice: false,
  };
}

function createCurrentUser(overrides: Partial<User> = {}): User {
  return {
    id: 'employee-001',
    name: 'Usuário atualizado',
    type: 'employee',
    departments: ['financial'],
    permissions: ['dashboard:view', 'financial:view'],
    clientCategory: null,
    isActive: true,
    ...overrides,
  } as User;
}

function createSessionStorageMock(session: AuthenticatedSession | null): SessionStorage {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(session),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

const tokens: ApiAuthenticationTokens = {
  accessToken: 'current-access-token',
  refreshToken: 'refresh-token-with-at-least-forty-characters-123456',
  accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

function createTokenStorageMock(value: ApiAuthenticationTokens | null = tokens): ApiTokenStorage {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(value),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

function createAuthenticationGatewayMock(user: User = createCurrentUser()): AuthenticationGateway {
  return {
    authenticate: jest.fn(),
    getCurrentIdentity: jest.fn().mockResolvedValue(user),
    requestPasswordReset: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    completePasswordChange: jest.fn(),
  };
}

function restoreSimulationFlag() {
  if (originalSimulationFlag === undefined) {
    delete process.env.AUTH_SIMULATION_ENABLED;
  } else {
    process.env.AUTH_SIMULATION_ENABLED = originalSimulationFlag;
  }
}

describe('getCurrentAuthenticatedSession', () => {
  it('opens the local demo without a cookie, credentials or API access', async () => {
    const original = process.env;
    process.env = {
      ...original,
      NODE_ENV: 'development',
      AUTH_SIMULATION_ENABLED: 'true',
      AUTH_LOCAL_AUTO_LOGIN: 'true',
      LUME_TENANT_WHATSAPP_DATA_SOURCE: 'mock',
    };
    try {
      const session = await getCurrentAuthenticatedSession();
      expect(session?.user.name).toBe('Demonstração local');
      expect(session?.user.departments).toContain('commercial');
      expect(mockedCreateCookieSessionStorage).not.toHaveBeenCalled();
      expect(mockedCreateCookieApiTokenStorage).not.toHaveBeenCalled();
      expect(mockedCreateAuthenticationGateway).not.toHaveBeenCalled();
    } finally {
      process.env = original;
    }
  });

  beforeEach(() => {
    process.env.AUTH_SIMULATION_ENABLED = 'false';
  });

  afterEach(() => {
    jest.clearAllMocks();
    restoreSimulationFlag();
  });

  it('revalidates the identity and returns current departments and permissions', async () => {
    const session = createValidSession();
    const currentUser = createCurrentUser();
    const authenticationGateway = createAuthenticationGatewayMock(currentUser);
    mockedCreateCookieSessionStorage.mockResolvedValue(createSessionStorageMock(session));
    mockedCreateCookieApiTokenStorage.mockResolvedValue(createTokenStorageMock());
    mockedCreateAuthenticationGateway.mockReturnValue(authenticationGateway);

    await expect(getCurrentAuthenticatedSession()).resolves.toEqual({
      ...session,
      user: currentUser,
    });
    expect(authenticationGateway.getCurrentIdentity).toHaveBeenCalledWith(tokens.accessToken);
  });

  it('returns null for an expired local session without calling the API', async () => {
    const expiredSession: AuthenticatedSession = {
      ...createValidSession(),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    };
    mockedCreateCookieSessionStorage.mockResolvedValue(createSessionStorageMock(expiredSession));

    await expect(getCurrentAuthenticatedSession()).resolves.toBeNull();
    expect(mockedCreateCookieApiTokenStorage).not.toHaveBeenCalled();
    expect(mockedCreateAuthenticationGateway).not.toHaveBeenCalled();
  });

  it('fails closed when the encrypted API token is absent', async () => {
    mockedCreateCookieSessionStorage.mockResolvedValue(
      createSessionStorageMock(createValidSession()),
    );
    mockedCreateCookieApiTokenStorage.mockResolvedValue(createTokenStorageMock(null));
    mockedCreateAuthenticationGateway.mockReturnValue(createAuthenticationGatewayMock());

    await expect(getCurrentAuthenticatedSession()).resolves.toBeNull();
  });

  it('fails closed when auth/me rejects a deactivated, suspended or stale token', async () => {
    const authenticationGateway = createAuthenticationGatewayMock();
    jest
      .mocked(authenticationGateway.getCurrentIdentity)
      .mockRejectedValue(new Error('Unauthorized'));
    mockedCreateCookieSessionStorage.mockResolvedValue(
      createSessionStorageMock(createValidSession()),
    );
    mockedCreateCookieApiTokenStorage.mockResolvedValue(createTokenStorageMock());
    mockedCreateAuthenticationGateway.mockReturnValue(authenticationGateway);

    await expect(getCurrentAuthenticatedSession()).resolves.toBeNull();
  });

  it('rejects a valid token whose current user differs from the local session', async () => {
    mockedCreateCookieSessionStorage.mockResolvedValue(
      createSessionStorageMock(createValidSession()),
    );
    mockedCreateCookieApiTokenStorage.mockResolvedValue(createTokenStorageMock());
    mockedCreateAuthenticationGateway.mockReturnValue(
      createAuthenticationGatewayMock(createCurrentUser({ id: 'employee-002' })),
    );

    await expect(getCurrentAuthenticatedSession()).resolves.toBeNull();
  });

  it('keeps explicit non-production simulation independent from API tokens', async () => {
    process.env.AUTH_SIMULATION_ENABLED = 'true';
    const session = createValidSession();
    mockedCreateCookieSessionStorage.mockResolvedValue(createSessionStorageMock(session));

    await expect(getCurrentAuthenticatedSession()).resolves.toEqual(session);
    expect(mockedCreateCookieApiTokenStorage).not.toHaveBeenCalled();
    expect(mockedCreateAuthenticationGateway).not.toHaveBeenCalled();
  });

  it('returns null when session or token infrastructure is unavailable', async () => {
    mockedCreateCookieSessionStorage.mockRejectedValue(new Error('Missing session configuration'));
    await expect(getCurrentAuthenticatedSession()).resolves.toBeNull();

    mockedCreateCookieSessionStorage.mockResolvedValue(
      createSessionStorageMock(createValidSession()),
    );
    mockedCreateCookieApiTokenStorage.mockRejectedValue(new Error('Missing token configuration'));
    await expect(getCurrentAuthenticatedSession()).resolves.toBeNull();
  });
});
