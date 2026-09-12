import { AuthenticatedShell } from '@/features/navigation';
import { hasPermission } from '@/features/auth/domain';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { IntegrationPanel } from '@/features/transport/components/integration-panel';
export const metadata = { title: 'Avic System | Lume' };
export default async function AvicIntegrationPage() {
  const session = await requireTenantSession(['trips:view', 'trips:manage']);
  return (
    <AuthenticatedShell user={session.user}>
      <main className="lume-page space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Avic System</h1>
        <IntegrationPanel canManage={hasPermission(session.user, 'trips:manage')} />
      </main>
    </AuthenticatedShell>
  );
}
