import { hasPermission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { KnowledgeGatewayError } from '@/features/knowledge-management/application';
import { executeAuthenticatedKnowledgeMutation } from '@/features/knowledge-management/server';

interface RouteContext {
  readonly params: Promise<{ readonly documentId: string; readonly versionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentAuthenticatedSession();
  const canRead =
    session !== null &&
    (hasPermission(session.user, 'knowledge:view') ||
      hasPermission(session.user, 'knowledge:manage') ||
      hasPermission(session.user, 'knowledge:publish'));
  if (!canRead) {
    return Response.json(
      { message: 'Você não tem acesso a este original.' },
      { status: session === null ? 401 : 403 },
    );
  }
  const { documentId, versionId } = await context.params;
  try {
    const source = await executeAuthenticatedKnowledgeMutation((gateway) =>
      gateway.getOriginal(documentId, versionId),
    );
    const headers = new Headers();
    for (const name of [
      'content-type',
      'content-length',
      'content-disposition',
      'x-content-sha256',
    ]) {
      const value = source.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "sandbox; default-src 'none'");
    return new Response(source.body, { status: 200, headers });
  } catch (error) {
    const status =
      error instanceof KnowledgeGatewayError
        ? error.code === 'unauthorized'
          ? 401
          : error.code === 'forbidden'
            ? 403
            : error.code === 'not-found'
              ? 404
              : 502
        : 500;
    return Response.json({ message: 'Não foi possível baixar o original.' }, { status });
  }
}
