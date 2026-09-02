import type { AuthenticatedSession } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';

import { AgentAdministration } from '../components';
import type { AiAgentExecutionPage, ManagedAiAgent } from '../domain';

export interface AiAgentsPageProps {
  readonly session: AuthenticatedSession;
  readonly initialAgents: readonly ManagedAiAgent[];
  readonly initialExecutions: AiAgentExecutionPage | null;
  readonly initialError?: string;
  readonly initialExecutionsError?: string;
}

export function AiAgentsPage({
  session,
  initialAgents,
  initialExecutions,
  initialError,
  initialExecutionsError,
}: AiAgentsPageProps) {
  return (
    <AuthenticatedShell user={session.user}>
      <div className="mx-auto w-full max-w-[1800px] p-3 sm:p-4 lg:p-6">
        <AgentAdministration
          initialAgents={initialAgents}
          initialExecutions={initialExecutions}
          initialError={initialError}
          initialExecutionsError={initialExecutionsError}
          canManage={session.user.permissions.includes('ai-agents:manage')}
        />
      </div>
    </AuthenticatedShell>
  );
}
