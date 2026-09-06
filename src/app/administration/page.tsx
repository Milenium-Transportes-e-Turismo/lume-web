import { AuditOperations } from '@/features/tenant-administration/components/audit-operations';
import { redirect } from 'next/navigation';

import { AuthenticatedShell } from '@/features/navigation';
import { ApiUsageDashboard } from '@/features/tenant-administration/components/api-usage-dashboard';
import type { ApiUsageResultFilter } from '@/features/tenant-administration/domain';
import {
  executeAuthenticatedTenantRequest,
  requireTenantSession,
  rethrowTenantPageError,
} from '@/features/tenant-administration/server';

export default async function AdministrationPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    from?: string;
    to?: string;
    userId?: string;
    status?: string;
    page?: string;
    operationPage?: string;
  }>;
}) {
  const session = await requireTenantSession(['settings:view']);
  if (!session.user.isAdministrator) redirect('/dashboard');
  const query = await searchParams;
  const status = ['success', 'client-error', 'server-error'].includes(query.status ?? '')
    ? (query.status as ApiUsageResultFilter)
    : undefined;
  const filters = {
    from: query.from?.trim() || undefined,
    to: query.to?.trim() || undefined,
    userId: query.userId?.trim() || undefined,
    status,
    page: Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1),
  };
  const [summary, requests, users, operations] = await executeAuthenticatedTenantRequest(
    (gateway) =>
      Promise.all([
        gateway.getApiUsageSummary({ from: filters.from, to: filters.to }),
        gateway.listApiUsageRequests({ ...filters, pageSize: 25 }),
        gateway.listUsers({ page: 1, pageSize: 100 }),
        gateway.listAuditOperations({
          from: filters.from,
          to: filters.to,
          userId: filters.userId,
          page: Math.max(1, Number.parseInt(query.operationPage ?? '1', 10) || 1),
          pageSize: 25,
        }),
      ]),
  ).catch((error: unknown) => rethrowTenantPageError(error));
  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-5 lg:p-6">
        <h1 className="mb-5 text-3xl font-semibold">Administração</h1>
        <AuditOperations
          operations={operations}
          query={{ from: filters.from, to: filters.to, userId: filters.userId }}
        />
        <details>
          <summary className="mb-4 cursor-pointer font-semibold">
            Uso da API e registros técnicos de requisições
          </summary>
          <ApiUsageDashboard
            summary={summary}
            requests={requests}
            users={users}
            filters={filters}
          />
        </details>
      </main>
    </AuthenticatedShell>
  );
}
