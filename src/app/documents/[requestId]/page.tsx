import { redirect } from 'next/navigation';

import { DocumentManagementError } from '@/features/document-management/application';
import { DocumentRequestWorkspace } from '@/features/document-management/components';
import {
  executeAuthenticatedDocumentRequest,
  requireDocumentSession,
} from '@/features/document-management/server';
import { AuthenticatedShell } from '@/features/navigation';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';

export default async function DocumentRequestPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ requestId: string }>;
  readonly searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireDocumentSession();
  const { requestId } = await params;
  const query = await searchParams;
  let request;
  try {
    request = await executeAuthenticatedDocumentRequest((gateway) => gateway.getRequest(requestId));
  } catch (error) {
    if (error instanceof DocumentManagementError && error.code === 'unauthorized') {
      redirect('/auth/session-expired');
    }
    redirect('/documents?error=Não foi possível abrir a solicitação.');
  }
  const returnPath = `/documents/${requestId}`;

  return (
    <AuthenticatedShell user={session.user}>
      <div className="lume-page max-w-6xl space-y-4">
        <PageFeedbackToast error={query.error} success={query.success} />
        <DocumentRequestWorkspace request={request} canReview={false} returnPath={returnPath} />
      </div>
    </AuthenticatedShell>
  );
}
