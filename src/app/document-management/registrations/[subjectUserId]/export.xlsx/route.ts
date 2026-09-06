import { DocumentManagementError } from '@/features/document-management/application';
import {
  executeAuthenticatedDocumentRequest,
  requireDocumentSession,
} from '@/features/document-management/server';

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ subjectUserId: string }> },
): Promise<Response> {
  await requireDocumentSession(true);
  const { subjectUserId } = await params;
  try {
    const upstream = await executeAuthenticatedDocumentRequest((gateway) =>
      gateway.downloadUserExport(subjectUserId, 'registrations'),
    );
    const headers = new Headers();
    headers.set(
      'Content-Type',
      upstream.headers.get('content-type') ??
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    headers.set(
      'Content-Disposition',
      upstream.headers.get('content-disposition') ??
        'attachment; filename="dados-documentais.xlsx"',
    );
    headers.set('Cache-Control', 'private, no-store');
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    const status =
      error instanceof DocumentManagementError && error.code === 'forbidden' ? 403 : 502;
    return Response.json(
      { error: 'Não foi possível gerar os dados estruturados deste usuário.' },
      { status },
    );
  }
}
