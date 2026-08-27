import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthenticatedShell } from '@/features/navigation';
import { createRegistrationAction } from '@/features/registrations/actions';
import { RegistrationForm } from '@/features/registrations/components';
import { executeAuthenticatedRegistrationRequest } from '@/features/registrations/server';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { Button } from '@/shared/ui/button';

export const metadata: Metadata = { title: 'Novo Cadastro | Lume' };

export default async function NewRegistrationPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    error?: string;
    name?: string;
    phone?: string;
    type?: 'pf' | 'pj';
  }>;
}) {
  const session = await requireTenantSession(['clients:create']);
  const [search, catalog] = await Promise.all([
    searchParams,
    executeAuthenticatedRegistrationRequest((gateway) => gateway.catalog()),
  ]);
  const [firstName = '', ...lastParts] = (search.name ?? '').trim().split(/\s+/);
  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
        <PageFeedbackToast error={search.error} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Cadastro</p>
            <h1 className="text-3xl font-semibold tracking-tight">Nova identidade</h1>
            <p className="text-muted-foreground">
              Cadastre a pessoa ou empresa uma vez e atribua todos os Papéis necessários.
            </p>
          </div>
          <Button variant="outline" render={<Link href="/registrations" />}>
            Voltar
          </Button>
        </header>
        <RegistrationForm
          action={createRegistrationAction}
          catalog={catalog}
          initialValues={{
            type: search.type,
            firstName,
            lastName: lastParts.join(' '),
            phone: search.phone,
          }}
        />
      </main>
    </AuthenticatedShell>
  );
}
