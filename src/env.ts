import 'server-only';

import { z } from 'zod';

export const DEFAULT_TENANT_API_TIMEOUT_MS = 5_000;
export const DEFAULT_DOCUMENT_REVIEW_TIMEOUT_MS = 300_000;
export const DEFAULT_WHATSAPP_IMPORT_TIMEOUT_MS = 600_000;
export const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const MINIMUM_TENANT_API_TIMEOUT_MS = 100;
const MAXIMUM_TENANT_API_TIMEOUT_MS = 30_000;
const MINIMUM_LONG_RUNNING_TIMEOUT_MS = 30_000;
const MINIMUM_SESSION_SECRET_BYTES = 32;

export type EnvironmentSource = Partial<
  Record<
    | 'NODE_ENV'
    | 'LUME_TENANT_API_URL'
    | 'LUME_TENANT_API_TIMEOUT_MS'
    | 'LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS'
    | 'LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS'
    | 'SESSION_SECRET'
    | 'AUTH_SIMULATION_ENABLED'
    | 'AUTH_LOCAL_AUTO_LOGIN'
    | 'LUME_TENANT_WHATSAPP_DATA_SOURCE'
    | 'MAP_STYLE_URL',
    string | undefined
  >
>;

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

function numericEnvironmentValue(defaultValue: number) {
  return z.preprocess((value) => {
    const normalized = emptyStringToUndefined(value);
    return normalized === undefined ? defaultValue : Number(normalized);
  }, z.number());
}

const nodeEnvironmentSchema = z.preprocess(
  emptyStringToUndefined,
  z.enum(['development', 'test', 'production']).default('development'),
);

const tenantApiUrlSchema = z
  .string()
  .trim()
  .url('LUME_TENANT_API_URL must be a valid absolute URL.')
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'LUME_TENANT_API_URL must use HTTP or HTTPS.',
  })
  .transform((value) => value.replace(/\/+$/, ''));

const optionalTenantApiUrlSchema = z.preprocess(
  emptyStringToUndefined,
  tenantApiUrlSchema.optional(),
);

const tenantApiTimeoutSchema = numericEnvironmentValue(DEFAULT_TENANT_API_TIMEOUT_MS)
  .pipe(z.number().int())
  .refine(
    (value) => value >= MINIMUM_TENANT_API_TIMEOUT_MS && value <= MAXIMUM_TENANT_API_TIMEOUT_MS,
    {
      message: `LUME_TENANT_API_TIMEOUT_MS must be an integer between ${MINIMUM_TENANT_API_TIMEOUT_MS} and ${MAXIMUM_TENANT_API_TIMEOUT_MS}.`,
    },
  );

function longRunningTimeoutSchema(environmentName: string, defaultValue: number) {
  return numericEnvironmentValue(defaultValue)
    .pipe(z.number().int())
    .refine((value) => value >= MINIMUM_LONG_RUNNING_TIMEOUT_MS, {
      message: `${environmentName} must be an integer greater than or equal to ${MINIMUM_LONG_RUNNING_TIMEOUT_MS}.`,
    });
}

const optionalSessionSecretSchema = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .refine((value) => new TextEncoder().encode(value).byteLength >= MINIMUM_SESSION_SECRET_BYTES, {
      message: `SESSION_SECRET must contain at least ${MINIMUM_SESSION_SECRET_BYTES} bytes.`,
    })
    .optional(),
);

const booleanEnvironmentSchema = (environmentName: string) =>
  z
    .preprocess(
      (value) => {
        const normalized = emptyStringToUndefined(value);
        return typeof normalized === 'string' ? normalized.trim().toLowerCase() : normalized;
      },
      z
        .enum(['true', 'false'], {
          error: `${environmentName} must be "true" or "false".`,
        })
        .default('false'),
    )
    .transform((value) => value === 'true');

const optionalMapStyleUrlSchema = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .trim()
    .url('MAP_STYLE_URL must be a valid absolute URL.')
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
      message: 'MAP_STYLE_URL must use HTTP or HTTPS.',
    })
    .default(DEFAULT_MAP_STYLE_URL),
);

export const serverEnvSchema = z
  .object({
    NODE_ENV: nodeEnvironmentSchema,
    LUME_TENANT_API_URL: optionalTenantApiUrlSchema,
    LUME_TENANT_API_TIMEOUT_MS: tenantApiTimeoutSchema,
    LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS: longRunningTimeoutSchema(
      'LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS',
      DEFAULT_DOCUMENT_REVIEW_TIMEOUT_MS,
    ),
    LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS: longRunningTimeoutSchema(
      'LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS',
      DEFAULT_WHATSAPP_IMPORT_TIMEOUT_MS,
    ),
    SESSION_SECRET: optionalSessionSecretSchema,
    AUTH_SIMULATION_ENABLED: booleanEnvironmentSchema('AUTH_SIMULATION_ENABLED'),
    AUTH_LOCAL_AUTO_LOGIN: booleanEnvironmentSchema('AUTH_LOCAL_AUTO_LOGIN'),
    LUME_TENANT_WHATSAPP_DATA_SOURCE: z.preprocess(
      (value) => {
        const normalized = emptyStringToUndefined(value);
        return typeof normalized === 'string' ? normalized.trim().toLowerCase() : normalized;
      },
      z
        .enum(['api', 'mock'], {
          error: 'LUME_TENANT_WHATSAPP_DATA_SOURCE must be "api" or "mock".',
        })
        .default('api'),
    ),
    MAP_STYLE_URL: optionalMapStyleUrlSchema,
  })
  .superRefine((environment, context) => {
    if (
      environment.AUTH_LOCAL_AUTO_LOGIN &&
      (environment.NODE_ENV !== 'development' ||
        !environment.AUTH_SIMULATION_ENABLED ||
        environment.LUME_TENANT_WHATSAPP_DATA_SOURCE !== 'mock')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_LOCAL_AUTO_LOGIN'],
        message:
          'AUTH_LOCAL_AUTO_LOGIN requires development, simulated authentication and mock data.',
      });
    }
    if (
      environment.NODE_ENV === 'production' &&
      environment.LUME_TENANT_API_URL !== undefined &&
      new URL(environment.LUME_TENANT_API_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['LUME_TENANT_API_URL'],
        message: 'LUME_TENANT_API_URL must use HTTPS in production.',
      });
    }

    if (environment.NODE_ENV === 'production' && environment.AUTH_SIMULATION_ENABLED) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_SIMULATION_ENABLED'],
        message: 'AUTH_SIMULATION_ENABLED cannot be enabled in production.',
      });
    }

    if (
      environment.NODE_ENV === 'production' &&
      environment.LUME_TENANT_WHATSAPP_DATA_SOURCE === 'mock'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['LUME_TENANT_WHATSAPP_DATA_SOURCE'],
        message: 'WhatsApp mock data cannot be enabled in production.',
      });
    }

    if (
      environment.NODE_ENV === 'production' &&
      new URL(environment.MAP_STYLE_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['MAP_STYLE_URL'],
        message: 'MAP_STYLE_URL must use HTTPS in production.',
      });
    }
  });

export type ServerEnv = z.output<typeof serverEnvSchema>;

export function parseServerEnv(source: EnvironmentSource): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function resolveTenantApiBaseUrl(
  value: string | undefined,
  nodeEnvironment: string | undefined = 'development',
): string {
  const environment = parseServerEnv({
    NODE_ENV: nodeEnvironment,
    LUME_TENANT_API_URL: value,
  });

  if (environment.LUME_TENANT_API_URL === undefined) {
    throw new Error('LUME_TENANT_API_URL is required when simulated authentication is disabled.');
  }

  return environment.LUME_TENANT_API_URL;
}

export function resolveTenantApiTimeout(value: string | undefined): number {
  return tenantApiTimeoutSchema.parse(value);
}
