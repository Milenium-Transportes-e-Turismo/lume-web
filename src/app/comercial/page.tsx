import { redirect } from 'next/navigation';

import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { DepartmentPanel, getDepartmentNavigation } from '@/features/navigation';

export const metadata = { title: 'Comercial | Lume' };

export default async function CommercialPage() {
  const session = await getCurrentAuthenticatedSession();
  if (session === null) redirect('/login');

  const navigation = getDepartmentNavigation(session.user, '/comercial');
  if (!navigation) redirect('/dashboard');

  return (
    <DepartmentPanel
      user={session.user}
      title="Comercial"
      description="Acesse as filas e os orçamentos liberados para o seu perfil."
      navigation={navigation}
    />
  );
}
