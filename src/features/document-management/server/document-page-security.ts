import 'server-only';

import { redirect } from 'next/navigation';

import { hasPermission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

export async function requireDocumentSession(manage = false) {
  const session = await getCurrentAuthenticatedSession();
  if (session === null) redirect('/login');
  if (!hasPermission(session.user, manage ? 'documents:manage' : 'documents:view')) {
    redirect('/dashboard');
  }
  if (
    manage &&
    !session.user.isAdministrator &&
    !session.user.departments.some((department) =>
      ['management', 'personnel-department', 'human-resources'].includes(department),
    )
  ) {
    redirect('/dashboard');
  }
  return session;
}
