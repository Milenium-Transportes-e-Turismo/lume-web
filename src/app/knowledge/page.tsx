import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { hasPermission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { KnowledgeGatewayError } from '@/features/knowledge-management/application';
import { KnowledgeManagement } from '@/features/knowledge-management/components';
import { executeAuthenticatedKnowledgeRequest } from '@/features/knowledge-management/server';
import { AuthenticatedShell } from '@/features/navigation';

export const metadata: Metadata = {
  title: 'Conhecimento | Lume',
  description: 'Gestão de conteúdo versionado e evidências dos agentes.',
};

function message(error: unknown, fallback: string): string {
  return error instanceof KnowledgeGatewayError
    ? `${error.message} Código: ${error.publicCode}.`
    : fallback;
}

export default async function KnowledgePage() {
  const session = await getCurrentAuthenticatedSession();
  if (!session) redirect('/login');
  const canView =
    hasPermission(session.user, 'knowledge:view') ||
    hasPermission(session.user, 'knowledge:manage') ||
    hasPermission(session.user, 'knowledge:publish');
  if (!canView) redirect('/dashboard');

  const [departmentsResult, basesResult, documentsResult, suggestionsResult, gapsResult] =
    await Promise.allSettled([
      executeAuthenticatedKnowledgeRequest((gateway) => gateway.listDepartments()),
      executeAuthenticatedKnowledgeRequest((gateway) => gateway.listBases()),
      executeAuthenticatedKnowledgeRequest((gateway) => gateway.listDocuments()),
      executeAuthenticatedKnowledgeRequest((gateway) => gateway.listSuggestions()),
      executeAuthenticatedKnowledgeRequest((gateway) => gateway.listGaps()),
    ]);
  const unauthorized = [
    departmentsResult,
    basesResult,
    documentsResult,
    suggestionsResult,
    gapsResult,
  ].some(
    (result) =>
      result.status === 'rejected' &&
      result.reason instanceof KnowledgeGatewayError &&
      result.reason.code === 'unauthorized',
  );
  if (unauthorized) redirect('/auth/session-expired');

  return (
    <AuthenticatedShell user={session.user}>
      <div className="lume-page ">
        <KnowledgeManagement
          initialDepartments={
            departmentsResult.status === 'fulfilled' ? departmentsResult.value : []
          }
          initialBases={basesResult.status === 'fulfilled' ? basesResult.value : []}
          initialDocuments={documentsResult.status === 'fulfilled' ? documentsResult.value : []}
          initialSuggestions={
            suggestionsResult.status === 'fulfilled' ? suggestionsResult.value : []
          }
          initialGaps={gapsResult.status === 'fulfilled' ? gapsResult.value : []}
          initialErrors={{
            departments:
              departmentsResult.status === 'rejected'
                ? message(departmentsResult.reason, 'Não foi possível carregar os departamentos.')
                : undefined,
            bases:
              basesResult.status === 'rejected'
                ? message(basesResult.reason, 'Não foi possível carregar as bases.')
                : undefined,
            documents:
              documentsResult.status === 'rejected'
                ? message(documentsResult.reason, 'Não foi possível carregar os documentos.')
                : undefined,
            suggestions:
              suggestionsResult.status === 'rejected'
                ? message(suggestionsResult.reason, 'Não foi possível carregar as sugestões.')
                : undefined,
            gaps:
              gapsResult.status === 'rejected'
                ? message(gapsResult.reason, 'Não foi possível carregar as lacunas.')
                : undefined,
          }}
          permissions={{
            canView,
            canManage: hasPermission(session.user, 'knowledge:manage'),
            canPublish: hasPermission(session.user, 'knowledge:publish'),
          }}
        />
      </div>
    </AuthenticatedShell>
  );
}
