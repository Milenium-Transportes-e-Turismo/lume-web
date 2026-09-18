import { redirect } from 'next/navigation';

import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { DepartmentPanel, getDepartmentNavigation } from '@/features/navigation';

export const metadata = { title: 'Financeiro | Lume' };

export default async function FinancialPage() {
  const session = await getCurrentAuthenticatedSession();
  if (session === null) redirect('/login');

  const navigation = getDepartmentNavigation(session.user, '/financeiro');
  if (!navigation) redirect('/dashboard');

  return (
    <DepartmentPanel
      user={session.user}
      title="Financeiro"
      description="Acesse os registros financeiros autorizados para o seu perfil."
      navigation={navigation}
    />
  );
}
