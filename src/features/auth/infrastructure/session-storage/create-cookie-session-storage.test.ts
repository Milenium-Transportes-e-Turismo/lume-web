/** @jest-environment node */

import { cookies } from 'next/headers';

import { CookieSessionStorage } from './cookie-session-storage';
import { createCookieSessionStorage } from './create-cookie-session-storage';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

const SESSION_SECRET = 'test-session-secret-with-more-than-thirty-two-bytes';

const originalSessionSecret = process.env.SESSION_SECRET;
const mockedCookies = jest.mocked(cookies);

function createNextCookieStoreMock(): Awaited<ReturnType<typeof cookies>> {
  return {
    delete: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

describe('createCookieSessionStorage', () => {
  it('supplies the same local demo identity to module adapters without reading cookies', async () => {
    const original = process.env;
    process.env = {
      ...original,
      NODE_ENV: 'development',
      AUTH_SIMULATION_ENABLED: 'true',
      AUTH_LOCAL_AUTO_LOGIN: 'true',
      LUME_TENANT_WHATSAPP_DATA_SOURCE: 'mock',
    };
    try {
      const storage = await createCookieSessionStorage();
      expect((await storage.get())?.user.id).toBe('local-demo-user');
      expect(mockedCookies).not.toHaveBeenCalled();
    } finally {
      process.env = original;
    }
  });

  beforeEach(() => {
    process.env.SESSION_SECRET = SESSION_SECRET;
    mockedCookies.mockResolvedValue(createNextCookieStoreMock());
  });

  afterEach(() => {
    mockedCookies.mockReset();

    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }
  });

  it('creates the adapter with the asynchronous Next.js cookie store', async () => {
    await expect(createCookieSessionStorage()).resolves.toBeInstanceOf(CookieSessionStorage);

    expect(mockedCookies).toHaveBeenCalledTimes(1);
  });

  it('rejects creation when SESSION_SECRET is missing', async () => {
    delete process.env.SESSION_SECRET;

    await expect(createCookieSessionStorage()).rejects.toThrow(
      'SESSION_SECRET is required to create the session storage.',
    );
  });
});
