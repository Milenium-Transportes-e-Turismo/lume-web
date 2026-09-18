import { redirect } from 'next/navigation';

import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { DepartmentPanel, getDepartmentNavigation } from '@/features/navigation';

export const metadata = { title: 'Operação | Lume' };

export default async function OperationsPage() {
  const session = await getCurrentAuthenticatedSession();
  if (session === null) redirect('/login');

  const navigation = getDepartmentNavigation(session.user, '/operacao');
  if (!navigation) redirect('/dashboard');

  return (
    <DepartmentPanel
      user={session.user}
      title="Operação"
      description="Acompanhe os atalhos operacionais disponíveis para o seu perfil."
      navigation={navigation}
    />
  );
}
