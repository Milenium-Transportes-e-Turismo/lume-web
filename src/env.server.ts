import 'server-only';

import { parseServerEnv, type EnvironmentSource, type ServerEnv } from './env';

function readRuntimeEnvironment(): EnvironmentSource {
  return {
    NODE_ENV: process.env.NODE_ENV,
    LUME_TENANT_API_URL: process.env.LUME_TENANT_API_URL,
    LUME_TENANT_API_TIMEOUT_MS: process.env.LUME_TENANT_API_TIMEOUT_MS,
    LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS:
      process.env.LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS,
    LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS:
      process.env.LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS,
    SESSION_SECRET: process.env.SESSION_SECRET,
    AUTH_SIMULATION_ENABLED: process.env.AUTH_SIMULATION_ENABLED,
    LUME_TENANT_WHATSAPP_DATA_SOURCE: process.env.LUME_TENANT_WHATSAPP_DATA_SOURCE,
    MAP_STYLE_URL: process.env.MAP_STYLE_URL,
  };
}

export function getServerEnv(overrides: EnvironmentSource = {}): ServerEnv {
  return parseServerEnv({ ...readRuntimeEnvironment(), ...overrides });
}

export function getTenantApiConfig(
  missingUrlMessage = 'LUME_TENANT_API_URL is required when simulated authentication is disabled.',
): {
  readonly baseUrl: string;
  readonly timeoutMs: number;
} {
  const environment = getServerEnv();

  if (environment.LUME_TENANT_API_URL === undefined) {
    throw new Error(missingUrlMessage);
  }

  return {
    baseUrl: environment.LUME_TENANT_API_URL,
    timeoutMs: environment.LUME_TENANT_API_TIMEOUT_MS,
  };
}

export function getSessionSecret(missingMessage = 'SESSION_SECRET is required.'): string {
  const sessionSecret = getServerEnv().SESSION_SECRET;

  if (sessionSecret === undefined) {
    throw new Error(missingMessage);
  }

  return sessionSecret;
}
