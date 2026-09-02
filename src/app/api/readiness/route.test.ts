/** @jest-environment node */

import { GET } from './route';

const originalFetch = global.fetch;
const originalNodeEnvironment = process.env.NODE_ENV;
const originalTenantApiUrl = process.env.LUME_TENANT_API_URL;
const originalTenantApiTimeout = process.env.LUME_TENANT_API_TIMEOUT_MS;
const originalSessionSecret = process.env.SESSION_SECRET;
const originalSimulationFlag = process.env.AUTH_SIMULATION_ENABLED;
const originalWhatsAppDataSource = process.env.LUME_TENANT_WHATSAPP_DATA_SOURCE;

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('GET /api/readiness', () => {
  beforeEach(() => {
    restoreEnvironment('NODE_ENV', 'production');
    process.env.LUME_TENANT_API_URL = 'https://tenant-api.test/api/v1';
    process.env.LUME_TENANT_API_TIMEOUT_MS = '1500';
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-bytes';
    process.env.AUTH_SIMULATION_ENABLED = 'false';
    process.env.LUME_TENANT_WHATSAPP_DATA_SOURCE = 'api';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    restoreEnvironment('NODE_ENV', originalNodeEnvironment);
    restoreEnvironment('LUME_TENANT_API_URL', originalTenantApiUrl);
    restoreEnvironment('LUME_TENANT_API_TIMEOUT_MS', originalTenantApiTimeout);
    restoreEnvironment('SESSION_SECRET', originalSessionSecret);
    restoreEnvironment('AUTH_SIMULATION_ENABLED', originalSimulationFlag);
    restoreEnvironment('LUME_TENANT_WHATSAPP_DATA_SOURCE', originalWhatsAppDataSource);
    jest.restoreAllMocks();
  });

  it('is ready only when the Tenant API readiness endpoint is healthy', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      configuration: 'valid',
      dependencies: { tenantApi: 'ready' },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://tenant-api.test/api/v1/health/ready',
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    [
      'the API rejects readiness',
      () => jest.mocked(global.fetch).mockResolvedValue({ ok: false } as Response),
    ],
    [
      'the API is unreachable',
      () => jest.mocked(global.fetch).mockRejectedValue(new Error('offline')),
    ],
  ])('returns 503 when %s', async (_scenario, arrange) => {
    arrange();

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not-ready',
      configuration: 'valid',
      dependencies: { tenantApi: 'unavailable' },
    });
  });

  it('returns 503 without contacting the network when configuration is invalid', async () => {
    delete process.env.LUME_TENANT_API_URL;

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not-ready',
      configuration: 'invalid',
      dependencies: { tenantApi: 'not-checked' },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['SESSION_SECRET ausente', 'SESSION_SECRET', undefined],
    ['SESSION_SECRET curto', 'SESSION_SECRET', 'short'],
    ['SESSION_SECRET de exemplo', 'SESSION_SECRET', 'replace-with-at-least-32-random-characters'],
    ['autenticação simulada', 'AUTH_SIMULATION_ENABLED', 'true'],
    ['dados mockados do WhatsApp', 'LUME_TENANT_WHATSAPP_DATA_SOURCE', 'mock'],
  ])('returns 503 without contacting the network with %s', async (_scenario, key, value) => {
    restoreEnvironment(key, value);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not-ready',
      configuration: 'invalid',
      dependencies: { tenantApi: 'not-checked' },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
