import type { Metadata } from 'next';
import { AuthenticatedShell } from '@/features/navigation';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { CatalogWorkspace } from '@/features/transport/components/catalog-workspace';

export const metadata: Metadata = { title: 'CNPJs do tenant | Lume' };
export default async function CatalogPage() {
  const session = await requireTenantSession(['clients:view', 'clients:manage']);
  return (
    <AuthenticatedShell user={session.user}>
      <CatalogWorkspace user={session.user} resource="companies" />
    </AuthenticatedShell>
  );
}
