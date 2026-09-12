import { AuthenticatedShell } from '@/features/navigation';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { TransportWorkspace } from '@/features/transport/components/transport-workspace';

export const metadata = { title: 'Registros | Lume' };
export default async function TransportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const session = await requireTenantSession([
    'trips:view',
    'trips:manage',
    'contracts:view',
    'contracts:manage',
  ]);
  return (
    <AuthenticatedShell user={session.user}>
      <TransportWorkspace key={tab} user={session.user} initialTab={tab} />
    </AuthenticatedShell>
  );
}
