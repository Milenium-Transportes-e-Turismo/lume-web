import Link from 'next/link';

import { updateClientAction } from '@/features/clients/actions/client-actions';
import { ClientForm } from '@/features/clients/components/client-form';
import { clientDisplayName } from '@/features/clients/components/client-format';
import { AuthenticatedShell } from '@/features/navigation';
import { executeAuthenticatedRoutingRequest } from '@/features/routing/server';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { Button } from '@/shared/ui/button';

export default async function EditClientPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ clientId: string }>;
  readonly searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireTenantSession(['clients:update']);
  const [{ clientId }, search] = await Promise.all([params, searchParams]);
  const client = await executeAuthenticatedRoutingRequest((gateway) =>
    gateway.getCompany(clientId),
  );
  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
        <PageFeedbackToast error={search.error} />
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Clientes</p>
            <h1 className="text-3xl font-semibold">Editar {clientDisplayName(client)}</h1>
          </div>
          <Button variant="outline" render={<Link href={`/clients/${client.id}`} />}>
            Cancelar
          </Button>
        </header>
        <ClientForm action={updateClientAction} client={client} />
      </main>
    </AuthenticatedShell>
  );
}
