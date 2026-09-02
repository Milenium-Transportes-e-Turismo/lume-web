import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { hasServiceCapability } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { WhatsAppConversationRepositoryError } from '@/features/whatsapp-conversations/application';
import {
  getWhatsAppConversationMetrics,
  type WhatsAppConversation,
  type WhatsAppConversationMetrics,
  type WhatsAppServiceAssignmentTarget,
} from '@/features/whatsapp-conversations/domain';
import { WhatsAppConversationsPage } from '@/features/whatsapp-conversations/pages';
import {
  getWhatsAppConversationPageForDashboard,
  getWhatsAppServiceAssignmentTargetsForDashboard,
} from '@/features/whatsapp-conversations/server';

export const metadata: Metadata = {
  title: 'Painel WhatsApp | Lume',
  description: 'Gestão protegida das conversas comerciais recebidas pelo WhatsApp.',
};

export default async function Page() {
  const session = await getCurrentAuthenticatedSession();

  if (session === null) {
    redirect('/login');
  }

  if (session.user.type !== 'employee' || !hasServiceCapability(session.user, 'view')) {
    redirect('/dashboard');
  }

  let conversations: readonly WhatsAppConversation[] = [];
  let pagination = { page: 1, pageSize: 25, total: 0, totalPages: 0 };
  let metrics: WhatsAppConversationMetrics = getWhatsAppConversationMetrics([]);
  let initialError: string | null = null;
  let assignmentTargets: readonly WhatsAppServiceAssignmentTarget[] = [];

  try {
    const result = await getWhatsAppConversationPageForDashboard({ page: 1, pageSize: 25 });
    conversations = result.conversations;
    pagination = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
    metrics = result.metrics;
  } catch (error) {
    if (error instanceof WhatsAppConversationRepositoryError && error.code === 'unauthorized') {
      redirect('/auth/session-expired');
    }

    initialError =
      error instanceof WhatsAppConversationRepositoryError
        ? error.message
        : 'Não foi possível carregar as conversas.';
  }

  if (hasServiceCapability(session.user, 'transfer')) {
    try {
      assignmentTargets = await getWhatsAppServiceAssignmentTargetsForDashboard();
    } catch (error) {
      if (error instanceof WhatsAppConversationRepositoryError && error.code === 'unauthorized') {
        redirect('/auth/session-expired');
      }
      // A falha do catálogo não impede a consulta do inbox.
    }
  }

  return (
    <WhatsAppConversationsPage
      session={session}
      conversations={conversations}
      pagination={pagination}
      metrics={metrics}
      initialError={initialError}
      assignmentTargets={assignmentTargets}
    />
  );
}
