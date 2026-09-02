import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { hasPermission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { AgentAdministrationError } from '@/features/ai-agents/application';
import type { AiAgentExecutionPage, ManagedAiAgent } from '@/features/ai-agents/domain';
import { AiAgentsPage } from '@/features/ai-agents/pages';
import { executeAuthenticatedAgentAdministrationRequest } from '@/features/ai-agents/server';

export const metadata: Metadata = {
  title: 'Agentes de IA | Lume',
  description: 'Administração e auditoria dos agentes de IA do tenant.',
};

export default async function Page() {
  const session = await getCurrentAuthenticatedSession();

  if (session === null) {
    redirect('/login');
  }

  if (!hasPermission(session.user, 'ai-agents:view')) {
    redirect('/dashboard');
  }

  let initialError = '';
  let agents: readonly ManagedAiAgent[] = [];
  try {
    agents = await executeAuthenticatedAgentAdministrationRequest((gateway) =>
      gateway.listAgents(),
    );
  } catch (error) {
    if (error instanceof AgentAdministrationError && error.code === 'unauthorized') {
      redirect('/auth/session-expired');
    }
    initialError =
      error instanceof AgentAdministrationError
        ? `${error.message} Código do erro: ${error.publicCode}.`
        : 'Não foi possível carregar os agentes de IA.';
  }

  let initialExecutions: AiAgentExecutionPage | null = null;
  let initialExecutionsError = '';
  const firstAgent = agents[0];
  if (firstAgent) {
    try {
      initialExecutions = await executeAuthenticatedAgentAdministrationRequest((gateway) =>
        gateway.listExecutions(firstAgent.id, 1, 25),
      );
    } catch (error) {
      initialExecutionsError =
        error instanceof AgentAdministrationError
          ? error.message
          : 'Não foi possível carregar as execuções do agente.';
    }
  }

  return (
    <AiAgentsPage
      session={session}
      initialAgents={agents}
      initialExecutions={initialExecutions}
      initialError={initialError}
      initialExecutionsError={initialExecutionsError}
    />
  );
}
