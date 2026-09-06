import { RoutePlannerForm } from '@/features/route-planner/components/route-planner-form';
import { hasPermission } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';
import { requireTenantSession } from '@/features/tenant-administration/server';

export default async function RoutingPage() {
  const session = await requireTenantSession(['route-planner:view', 'route-planner:calculate']);
  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-primary">Planejamento de viagens</p>
          <h1 className="text-3xl font-bold tracking-tight">Roteirização e custos rodoviários</h1>
          <p className="max-w-4xl text-sm text-muted-foreground">
            Informe os locais ou selecione pontos no mapa. Os valores de distância, tempo e
            combustível são estimativas; tarifas ausentes nunca são incluídas no total.
          </p>
        </header>
        <RoutePlannerForm canCalculate={hasPermission(session.user, 'route-planner:calculate')} />
      </main>
    </AuthenticatedShell>
  );
}
