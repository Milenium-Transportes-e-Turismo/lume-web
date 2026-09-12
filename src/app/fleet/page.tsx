import type { Metadata } from 'next';
import { AuthenticatedShell } from '@/features/navigation';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { CatalogWorkspace } from '@/features/transport/components/catalog-workspace';

export const metadata: Metadata = { title: 'Frota | Lume' };
export default async function CatalogPage() {
  const session = await requireTenantSession(['trips:view', 'trips:manage']);
  return (
    <AuthenticatedShell user={session.user}>
      <CatalogWorkspace user={session.user} resource="fleet" />
    </AuthenticatedShell>
  );
}
