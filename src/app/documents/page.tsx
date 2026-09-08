import { redirect } from 'next/navigation';

import { DocumentManagementError } from '@/features/document-management/application';
import { DocumentRequestList } from '@/features/document-management/components';
import {
  executeAuthenticatedDocumentRequest,
  requireDocumentSession,
} from '@/features/document-management/server';
import type { DocumentRequestList as DocumentRequestListType } from '@/features/document-management/domain';
import { AuthenticatedShell } from '@/features/navigation';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';

export default async function DocumentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; success?: string; page?: string }>;
}) {
  const session = await requireDocumentSession();
  const query = await searchParams;
  let requests: DocumentRequestListType;
  let loadError: string | undefined;
  try {
    requests = await executeAuthenticatedDocumentRequest((gateway) =>
      gateway.listRequests({
        page: Math.max(1, Number(query.page) || 1),
        pageSize: 20,
        subjectUserId: session.user.id,
      }),
    );
  } catch (error) {
    if (error instanceof DocumentManagementError && error.code === 'unauthorized') {
      redirect('/auth/session-expired');
    }
    loadError = 'Não foi possível carregar suas solicitações. Tente novamente.';
    requests = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
  }

  return (
    <AuthenticatedShell user={session.user}>
      <div className="lume-page space-y-6">
        <header>
          <p className="text-sm font-medium text-primary-emphasis">Área segura</p>
          <h1 className="text-2xl font-bold tracking-tight">Meus documentos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe prazos, pendências, recusas, renovações e o progresso de cada checklist.
          </p>
        </header>
        <PageFeedbackToast error={loadError ?? query.error} success={query.success} />
        {!loadError && <DocumentRequestList requests={requests.data} />}
      </div>
    </AuthenticatedShell>
  );
}
