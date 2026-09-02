import { NextResponse } from 'next/server';

import { WhatsAppConversationRepositoryError } from '@/features/whatsapp-conversations/application';
import {
  pollWhatsAppConversationForDashboard,
  pollWhatsAppConversationPageForDashboard,
  searchWhatsAppMessagesForDashboard,
} from '@/features/whatsapp-conversations/server';
import { hasServiceCapability } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import {
  isWhatsAppConversationDepartment,
  WHATSAPP_REQUEST_STATUSES,
  type WhatsAppRequestStatus,
} from '@/features/whatsapp-conversations/domain';

export const dynamic = 'force-dynamic';

function errorStatus(error: WhatsAppConversationRepositoryError): number {
  if (error.code === 'unauthorized') return 401;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'not-found') return 404;
  if (error.code === 'conflict') return 409;
  if (error.code === 'validation') return 400;
  if (error.code === 'too-many-requests') return 429;
  return 503;
}

export async function GET(request: Request) {
  const session = await getCurrentAuthenticatedSession();

  if (session === null || !hasServiceCapability(session.user, 'view')) {
    return NextResponse.json(
      { message: 'Acesso não autorizado ao painel de WhatsApp.' },
      { status: session === null ? 401 : 403 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const conversationId = searchParams.get('conversationId')?.trim();
  const messageSearch = searchParams.get('messageSearch')?.trim();
  const rawMessagePage = Number.parseInt(searchParams.get('messagePage') ?? '1', 10);
  const messagePage =
    Number.isSafeInteger(rawMessagePage) && rawMessagePage > 0 ? rawMessagePage : 1;
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawPageSize = Number.parseInt(searchParams.get('pageSize') ?? '25', 10);
  const pageSize =
    Number.isSafeInteger(rawPageSize) && rawPageSize > 0 && rawPageSize <= 100 ? rawPageSize : 25;
  const search = searchParams.get('search')?.trim() || undefined;
  const rawDepartment = searchParams.get('department');
  const department = isWhatsAppConversationDepartment(rawDepartment) ? rawDepartment : undefined;
  const rawControl = searchParams.get('control');
  const control =
    rawControl === 'bot' ||
    rawControl === 'human' ||
    rawControl === 'paused' ||
    rawControl === 'closed'
      ? rawControl
      : undefined;
  const rawRequestStatus = searchParams.get('requestStatus');
  const requestStatus =
    typeof rawRequestStatus === 'string' &&
    (WHATSAPP_REQUEST_STATUSES as readonly string[]).includes(rawRequestStatus)
      ? (rawRequestStatus as WhatsAppRequestStatus)
      : undefined;
  const rawArchive = searchParams.get('archive');
  const archive =
    rawArchive === 'active' || rawArchive === 'archived' || rawArchive === 'all'
      ? rawArchive
      : 'active';

  try {
    if (conversationId) {
      if (messageSearch) {
        if (messageSearch.length < 2 || messageSearch.length > 160) {
          return NextResponse.json(
            { message: 'Digite ao menos dois caracteres para pesquisar.' },
            { status: 400 },
          );
        }
        const result = await searchWhatsAppMessagesForDashboard(
          conversationId,
          messageSearch,
          messagePage,
        );
        if (!result) {
          return NextResponse.json({ message: 'Pesquisa inválida.' }, { status: 400 });
        }
        return NextResponse.json(result);
      }
      const conversation = await pollWhatsAppConversationForDashboard(conversationId, messagePage);

      if (conversation === null) {
        return NextResponse.json({ message: 'Conversa não encontrada.' }, { status: 404 });
      }

      return NextResponse.json({ conversation });
    }

    const result = await pollWhatsAppConversationPageForDashboard({
      page,
      pageSize,
      search,
      department,
      control,
      requestStatus,
      archive,
    });
    return NextResponse.json({
      conversations: result.conversations,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      metrics: result.metrics,
    });
  } catch (error) {
    if (error instanceof WhatsAppConversationRepositoryError) {
      return NextResponse.json({ message: error.message }, { status: errorStatus(error) });
    }

    return NextResponse.json(
      { message: 'Não foi possível consultar a Tenant API.' },
      { status: 503 },
    );
  }
}
