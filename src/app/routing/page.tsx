import { RoutePlannerForm } from '@/features/route-planner/components/route-planner-form';
import { hasPermission } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';
import { requireTenantSession } from '@/features/tenant-administration/server';

export default async function RoutingPage() {
  const session = await requireTenantSession(['route-planner:view', 'route-planner:calculate']);
  return (
    <AuthenticatedShell user={session.user}>
      <main
        aria-label="Roteirização"
        className="h-[calc(100dvh-3rem)] md:h-dvh min-h-0 w-full overflow-hidden"
      >
        <RoutePlannerForm canCalculate={hasPermission(session.user, 'route-planner:calculate')} />
      </main>
    </AuthenticatedShell>
  );
}
