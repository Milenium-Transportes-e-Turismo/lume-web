import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthenticatedShell } from '@/features/navigation';
import { updateRegistrationAction } from '@/features/registrations/actions';
import { RegistrationForm } from '@/features/registrations/components';
import { executeAuthenticatedRegistrationRequest } from '@/features/registrations/server';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { Button } from '@/shared/ui/button';

export const metadata: Metadata = { title: 'Editar Cadastro | Lume' };

export default async function EditRegistrationPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ registrationId: string }>;
  readonly searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireTenantSession(['clients:update', 'clients:manage']);
  const [{ registrationId }, search] = await Promise.all([params, searchParams]);
  const [registration, catalog] = await Promise.all([
    executeAuthenticatedRegistrationRequest((gateway) => gateway.get(registrationId)),
    executeAuthenticatedRegistrationRequest((gateway) => gateway.catalog()),
  ]);
  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
        <PageFeedbackToast error={search.error} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Cadastro</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Editar {registration.displayName}
            </h1>
            <p className="text-muted-foreground">
              A alteração fica registrada no histórico auditável.
            </p>
          </div>
          <Button variant="outline" render={<Link href={`/registrations/${registration.id}`} />}>
            Cancelar
          </Button>
        </header>
        <RegistrationForm
          action={updateRegistrationAction}
          catalog={catalog}
          registration={registration}
        />
      </main>
    </AuthenticatedShell>
  );
}
