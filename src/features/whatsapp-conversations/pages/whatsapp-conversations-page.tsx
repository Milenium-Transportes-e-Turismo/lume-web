import {
  hasLegacyWhatsAppManagement,
  hasServiceCapability,
  type AuthenticatedSession,
} from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';

import { ConversationWorkspace } from '../components';
import type {
  WhatsAppConversation,
  WhatsAppConversationMetrics,
  WhatsAppServiceAssignmentTarget,
} from '../domain';
import { whatsAppConversationsPageStyles as styles } from './whatsapp-conversations-page.styles';

export interface WhatsAppConversationsPageProps {
  readonly session: AuthenticatedSession;
  readonly conversations: readonly WhatsAppConversation[];
  readonly pagination?: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
  readonly metrics?: WhatsAppConversationMetrics;
  readonly initialError?: string | null;
  readonly assignmentTargets?: readonly WhatsAppServiceAssignmentTarget[];
}

export function WhatsAppConversationsPage({
  session,
  conversations,
  pagination,
  metrics,
  initialError = null,
  assignmentTargets = [],
}: WhatsAppConversationsPageProps) {
  return (
    <AuthenticatedShell user={session.user}>
      <div className={styles.content()}>
        <ConversationWorkspace
          initialConversations={conversations}
          initialPagination={pagination}
          initialMetrics={metrics}
          initialError={initialError}
          currentUserId={session.user.id}
          initialAssignmentTargets={assignmentTargets}
          canViewCustomerContext={hasServiceCapability(session.user, 'view')}
          canRespondCustomerContext={hasServiceCapability(session.user, 'respond')}
          permissions={{
            respond: hasServiceCapability(session.user, 'respond'),
            assume: hasServiceCapability(session.user, 'assume'),
            transfer: hasServiceCapability(session.user, 'transfer'),
            priority: hasServiceCapability(session.user, 'priority'),
            close: hasServiceCapability(session.user, 'close'),
            legacyManagement: hasLegacyWhatsAppManagement(session.user),
          }}
        />
      </div>
    </AuthenticatedShell>
  );
}
