import { redirect } from 'next/navigation';

import { DocumentManagementError } from '@/features/document-management/application';
import { DocumentRequestWorkspace } from '@/features/document-management/components';
import {
  executeAuthenticatedDocumentRequest,
  requireDocumentSession,
} from '@/features/document-management/server';
import { AuthenticatedShell } from '@/features/navigation';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';

export default async function ManagedDocumentRequestPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ requestId: string }>;
  readonly searchParams: Promise<{ error?: string; success?: string; embedded?: string }>;
}) {
  const session = await requireDocumentSession(true);
  const { requestId } = await params;
  const query = await searchParams;
  let request;
  let documentTypes;
  try {
    [request, documentTypes] = await Promise.all([
      executeAuthenticatedDocumentRequest((gateway) => gateway.getRequest(requestId)),
      executeAuthenticatedDocumentRequest((gateway) => gateway.listDocumentTypes()),
    ]);
  } catch (error) {
    if (error instanceof DocumentManagementError && error.code === 'unauthorized') {
      redirect('/auth/session-expired');
    }
    redirect('/document-management?error=Não foi possível abrir a solicitação.');
  }
  const returnPath = `/document-management/${requestId}${query.embedded === '1' ? '?embedded=1' : ''}`;

  const content = (
    <div className="lume-page max-w-6xl space-y-4">
      <PageFeedbackToast error={query.error} success={query.success} />
      <DocumentRequestWorkspace
        request={request}
        canReview
        returnPath={returnPath}
        documentTypes={documentTypes}
      />
    </div>
  );
  return query.embedded === '1' ? (
    content
  ) : (
    <AuthenticatedShell user={session.user}>{content}</AuthenticatedShell>
  );
}
