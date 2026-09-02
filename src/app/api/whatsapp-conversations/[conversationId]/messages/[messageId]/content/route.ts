import { NextResponse } from 'next/server';

import { hasServiceCapability } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { WhatsAppConversationRepositoryError } from '@/features/whatsapp-conversations/application';
import { downloadWhatsAppMessageContentForDashboard } from '@/features/whatsapp-conversations/server';

interface RouteContext {
  readonly params: Promise<{
    readonly conversationId: string;
    readonly messageId: string;
  }>;
}

function contentDisposition(fileName: string, disposition: 'inline' | 'attachment'): string {
  const fallback =
    fileName
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/["\\\r\n]/g, '_')
      .slice(0, 180) || 'midia-whatsapp';
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getCurrentAuthenticatedSession();
  const canRead = session !== null && hasServiceCapability(session.user, 'view');

  if (!canRead) {
    return NextResponse.json(
      { message: 'Você não tem acesso a esta mídia.' },
      { status: session === null ? 401 : 403 },
    );
  }

  const { conversationId, messageId } = await context.params;
  try {
    const media = await downloadWhatsAppMessageContentForDashboard(conversationId, messageId);
    const buffer = new ArrayBuffer(media.bytes.byteLength);
    new Uint8Array(buffer).set(media.bytes);
    const shouldDownload = new URL(request.url).searchParams.get('download') === '1';
    return new Response(buffer, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': contentDisposition(
          media.fileName,
          shouldDownload ? 'attachment' : 'inline',
        ),
        'Content-Length': String(media.bytes.byteLength),
        'Content-Type': media.mimeType,
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status =
      error instanceof WhatsAppConversationRepositoryError
        ? error.code === 'not-found'
          ? 404
          : error.code === 'forbidden'
            ? 403
            : error.code === 'unauthorized'
              ? 401
              : 502
        : 502;
    return NextResponse.json(
      {
        message:
          status === 404
            ? 'Este arquivo não está mais disponível.'
            : 'Não foi possível carregar esta mídia.',
      },
      { status },
    );
  }
}
