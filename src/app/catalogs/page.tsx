import type { Metadata } from 'next';
import { AuthenticatedShell } from '@/features/navigation';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { CatalogWorkspace } from '@/features/transport/components/catalog-workspace';

export const metadata: Metadata = { title: 'Tipos e categorias | Lume' };
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const catalogKind = ['service-type', 'vehicle-type', 'category'].includes(kind ?? '')
    ? kind
    : undefined;
  const session = await requireTenantSession(['trips:view', 'trips:manage']);
  return (
    <AuthenticatedShell user={session.user}>
      <CatalogWorkspace
        user={session.user}
        resource="catalogs"
        key={catalogKind}
        catalogKind={catalogKind}
      />
    </AuthenticatedShell>
  );
}
