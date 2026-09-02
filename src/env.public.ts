import { z } from 'zod';

type PublicEnvironmentSource = Partial<
  Record<'NEXT_PUBLIC_TENANT_NAME' | 'NEXT_PUBLIC_TENANT_PRODUCT_NAME', string | undefined>
>;

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

const publicTextSchema = (defaultValue: string) =>
  z.preprocess(emptyStringToUndefined, z.string().trim().min(1).default(defaultValue));

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_TENANT_NAME: publicTextSchema('Empresa'),
  NEXT_PUBLIC_TENANT_PRODUCT_NAME: publicTextSchema('Lume'),
});

export type PublicEnv = z.output<typeof publicEnvSchema>;

export function parsePublicEnv(source: PublicEnvironmentSource): PublicEnv {
  return publicEnvSchema.parse(source);
}

// Keep property access explicit: Next.js replaces only statically referenced
// NEXT_PUBLIC_* values when it builds the browser bundle.
export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_TENANT_NAME: process.env.NEXT_PUBLIC_TENANT_NAME,
  NEXT_PUBLIC_TENANT_PRODUCT_NAME: process.env.NEXT_PUBLIC_TENANT_PRODUCT_NAME,
});
