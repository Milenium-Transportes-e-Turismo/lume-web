import Link from 'next/link';

import { createClientAction } from '@/features/clients/actions/client-actions';
import { ClientForm } from '@/features/clients/components/client-form';
import { AuthenticatedShell } from '@/features/navigation';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { Button } from '@/shared/ui/button';

export default async function NewClientPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; name?: string; phone?: string }>;
}) {
  const session = await requireTenantSession(['clients:create']);
  const search = await searchParams;
  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
        <PageFeedbackToast error={search.error} />
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Clientes</p>
            <h1 className="text-3xl font-semibold">Novo cliente</h1>
            <p className="text-muted-foreground">
              Preencha pessoa física ou jurídica; os dados das duas seções serão preservados.
            </p>
          </div>
          <Button variant="outline" render={<Link href="/clients" />}>
            Voltar
          </Button>
        </header>
        <ClientForm
          action={createClientAction}
          initialValues={{ name: search.name, phone: search.phone }}
        />
      </main>
    </AuthenticatedShell>
  );
}
