import { publicEnv } from '@/env.public';

export const tenantBranding = {
  tenantName: publicEnv.NEXT_PUBLIC_TENANT_NAME,
  productName: publicEnv.NEXT_PUBLIC_TENANT_PRODUCT_NAME,
} as const;
