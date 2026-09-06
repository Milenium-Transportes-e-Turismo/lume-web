import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { hasPermission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { AuthenticatedShell } from '@/features/navigation';
import { RegistrationDataReviewGatewayError } from '@/features/registration-data-reviews/application';
import { RegistrationDataReviewWorkspace } from '@/features/registration-data-reviews/components';
import { executeAuthenticatedRegistrationDataReviewRequest } from '@/features/registration-data-reviews/server';

export const metadata: Metadata = {
  title: 'Revisões cadastrais | Lume',
  description: 'Fila humana de divergências cadastrais com proveniência.',
};

export default async function RegistrationDataReviewsPage() {
  const session = await getCurrentAuthenticatedSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.user, 'clients:manage')) redirect('/dashboard');

  const { reviews, initialError } = await executeAuthenticatedRegistrationDataReviewRequest(
    (gateway) => gateway.list(),
  )
    .then((value) => ({ reviews: value, initialError: '' }))
    .catch((error: unknown) => {
      if (error instanceof RegistrationDataReviewGatewayError && error.code === 'unauthorized') {
        redirect('/auth/session-expired');
      }
      return {
        reviews: [],
        initialError:
          error instanceof RegistrationDataReviewGatewayError
            ? `${error.message} Código: ${error.publicCode}.`
            : 'Não foi possível carregar a fila de revisões cadastrais.',
      };
    });

  return (
    <AuthenticatedShell user={session.user}>
      <div className="lume-page ">
        <RegistrationDataReviewWorkspace initialReviews={reviews} initialError={initialError} />
      </div>
    </AuthenticatedShell>
  );
}
