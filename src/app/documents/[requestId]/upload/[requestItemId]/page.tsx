import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

import { DocumentManagementError } from '@/features/document-management/application';
import { DocumentUploadForm } from '@/features/document-management/components';
import { DOCUMENT_STATUS_LABELS } from '@/features/document-management/domain';
import {
  executeAuthenticatedDocumentRequest,
  requireDocumentSession,
} from '@/features/document-management/server';
import { AuthenticatedShell } from '@/features/navigation';
import { buttonVariants } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

const UPLOADABLE_STATUSES = [
  'pending-upload',
  'pending-human-review',
  'resubmission-required',
  'rejected',
  'expired',
] as const;

export default async function LightweightDocumentUploadPage({
  params,
}: {
  readonly params: Promise<{ requestId: string; requestItemId: string }>;
}) {
  const session = await requireDocumentSession();
  const { requestId, requestItemId } = await params;
  let request;
  try {
    request = await executeAuthenticatedDocumentRequest((gateway) => gateway.getRequest(requestId));
  } catch (error) {
    if (error instanceof DocumentManagementError && error.code === 'unauthorized') {
      redirect('/auth/session-expired');
    }
    redirect('/documents?error=Não foi possível abrir a solicitação.');
  }

  const item = request.items.find((candidate) => candidate.id === requestItemId);
  if (!item || !UPLOADABLE_STATUSES.some((status) => status === item.status)) {
    redirect(`/documents/${requestId}?error=Este documento não está disponível para envio.`);
  }

  const accepts = Array.isArray(item.config.acceptedMimeTypes)
    ? item.config.acceptedMimeTypes.filter((entry): entry is string => typeof entry === 'string')
    : ['application/pdf', 'image/jpeg', 'image/png'];
  const requiresFrontBack = item.config.requiresFrontBack === true;
  const successUrl = `/documents/${requestId}?success=${encodeURIComponent(
    'Documento enviado para revisão.',
  )}`;

  return (
    <AuthenticatedShell user={session.user}>
      <main className="lume-page max-w-2xl space-y-4">
        <Link
          href={`/documents/${requestId}`}
          prefetch={false}
          className={buttonVariants({ variant: 'ghost' })}
        >
          <ArrowLeft aria-hidden="true" />
          Voltar para meus documentos
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{item.documentType.name}</CardTitle>
            <CardDescription>
              {DOCUMENT_STATUS_LABELS[item.status]} ·{' '}
              {item.requirement === 'required'
                ? 'Obrigatório'
                : item.requirement === 'optional'
                  ? 'Opcional'
                  : 'Condicional'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUploadForm
              uploadUrl={`/api/document-management/items/${item.id}/submissions/complete`}
              itemId={item.id}
              accepts={accepts}
              requiresFrontBack={requiresFrontBack}
              repeatableByDependent={item.config.repeatableByDependent === true}
              allowsMultiplePages={item.config.allowsMultiplePages === true}
              replace={item.status === 'pending-human-review'}
              initiallyExpanded
              successUrl={successUrl}
            />
          </CardContent>
        </Card>
      </main>
    </AuthenticatedShell>
  );
}
