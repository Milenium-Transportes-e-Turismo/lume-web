/** @jest-environment node */

import {
  DEFAULT_DOCUMENT_REVIEW_TIMEOUT_MS,
  DEFAULT_MAP_STYLE_URL,
  DEFAULT_TENANT_API_TIMEOUT_MS,
  DEFAULT_WHATSAPP_IMPORT_TIMEOUT_MS,
  parseServerEnv,
  resolveTenantApiBaseUrl,
  resolveTenantApiTimeout,
} from './env';
import { parsePublicEnv } from './env.public';

describe('environment configuration', () => {
  it('limits automatic login to explicit development simulation with mock data', () => {
    const local = {
      NODE_ENV: 'development',
      AUTH_SIMULATION_ENABLED: 'true',
      AUTH_LOCAL_AUTO_LOGIN: 'true',
      LUME_TENANT_WHATSAPP_DATA_SOURCE: 'mock',
    };
    expect(parseServerEnv(local).AUTH_LOCAL_AUTO_LOGIN).toBe(true);
    for (const overrides of [
      { NODE_ENV: 'production' },
      { NODE_ENV: 'test' },
      { AUTH_SIMULATION_ENABLED: 'false' },
      { LUME_TENANT_WHATSAPP_DATA_SOURCE: 'api' },
    ]) {
      expect(() => parseServerEnv({ ...local, ...overrides })).toThrow('AUTH_LOCAL_AUTO_LOGIN');
    }
  });

  it('applies safe defaults without requiring runtime secrets during a build', () => {
    expect(parseServerEnv({ NODE_ENV: 'development' })).toEqual({
      NODE_ENV: 'development',
      LUME_TENANT_API_TIMEOUT_MS: DEFAULT_TENANT_API_TIMEOUT_MS,
      LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS: DEFAULT_DOCUMENT_REVIEW_TIMEOUT_MS,
      LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS: DEFAULT_WHATSAPP_IMPORT_TIMEOUT_MS,
      AUTH_SIMULATION_ENABLED: false,
      AUTH_LOCAL_AUTO_LOGIN: false,
      LUME_TENANT_WHATSAPP_DATA_SOURCE: 'api',
      MAP_STYLE_URL: DEFAULT_MAP_STYLE_URL,
    });
  });

  it('normalizes the API URL and parses configured values', () => {
    expect(
      parseServerEnv({
        NODE_ENV: 'development',
        LUME_TENANT_API_URL: ' http://localhost:3333/api/v1/ ',
        LUME_TENANT_API_TIMEOUT_MS: '7500',
        AUTH_SIMULATION_ENABLED: 'true',
        LUME_TENANT_WHATSAPP_DATA_SOURCE: 'mock',
      }),
    ).toMatchObject({
      LUME_TENANT_API_URL: 'http://localhost:3333/api/v1',
      LUME_TENANT_API_TIMEOUT_MS: 7_500,
      AUTH_SIMULATION_ENABLED: true,
      LUME_TENANT_WHATSAPP_DATA_SOURCE: 'mock',
    });
  });

  it('rejects insecure or simulated production configuration', () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: 'production',
        LUME_TENANT_API_URL: 'http://tenant-api.example.com/api/v1',
      }),
    ).toThrow('LUME_TENANT_API_URL must use HTTPS in production.');

    expect(() =>
      parseServerEnv({
        NODE_ENV: 'production',
        AUTH_SIMULATION_ENABLED: 'true',
      }),
    ).toThrow('AUTH_SIMULATION_ENABLED cannot be enabled in production.');

    expect(() =>
      parseServerEnv({
        NODE_ENV: 'production',
        LUME_TENANT_WHATSAPP_DATA_SOURCE: 'mock',
      }),
    ).toThrow('WhatsApp mock data cannot be enabled in production.');
  });

  it('validates secrets and long-running timeouts', () => {
    expect(() =>
      parseServerEnv({
        SESSION_SECRET: 'short',
        LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS: '29999',
      }),
    ).toThrow('SESSION_SECRET must contain at least 32 bytes.');

    expect(() =>
      parseServerEnv({ LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS: 'not-a-number' }),
    ).toThrow();

    expect(parseServerEnv({ LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS: '7200000' })).toMatchObject(
      { LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS: 7_200_000 },
    );
  });

  it('keeps public variables separate and applies branding defaults', () => {
    expect(parsePublicEnv({})).toEqual({
      NEXT_PUBLIC_TENANT_NAME: 'Empresa',
      NEXT_PUBLIC_TENANT_PRODUCT_NAME: 'Lume',
    });
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_TENANT_NAME: ' Transportadora Aurora ',
        NEXT_PUBLIC_TENANT_PRODUCT_NAME: ' Portal Lume ',
      }),
    ).toEqual({
      NEXT_PUBLIC_TENANT_NAME: 'Transportadora Aurora',
      NEXT_PUBLIC_TENANT_PRODUCT_NAME: 'Portal Lume',
    });
  });

  it('preserves the existing API resolver contract', () => {
    expect(resolveTenantApiBaseUrl('http://localhost:3333/api/v1/')).toBe(
      'http://localhost:3333/api/v1',
    );
    expect(resolveTenantApiTimeout(undefined)).toBe(DEFAULT_TENANT_API_TIMEOUT_MS);
    expect(() =>
      resolveTenantApiBaseUrl('http://tenant-api.example.com/api/v1', 'production'),
    ).toThrow('LUME_TENANT_API_URL must use HTTPS in production.');
  });
});
