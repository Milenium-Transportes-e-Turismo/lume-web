import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { hasPermission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { AuthenticatedShell } from '@/features/navigation';
import { WhatsAppContactsPage } from '@/features/whatsapp-contacts/pages';

export const metadata: Metadata = {
  title: 'Contatos | Lume',
  description: 'Exportação de cadastros aprovados para Google Contacts.',
};

export default async function Page() {
  const session = await getCurrentAuthenticatedSession();
  if (session === null) redirect('/login');
  const canExport =
    hasPermission(session.user, 'documents:view') ||
    hasPermission(session.user, 'documents:manage');
  if (!hasPermission(session.user, 'clients:view')) {
    redirect('/dashboard');
  }
  return (
    <AuthenticatedShell user={session.user}>
      <WhatsAppContactsPage canExport={canExport} />
    </AuthenticatedShell>
  );
}
