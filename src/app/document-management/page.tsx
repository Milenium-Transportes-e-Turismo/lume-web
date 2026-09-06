import { redirect } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

import { DocumentManagementError } from '@/features/document-management/application';
import {
  BatchDocumentRequestForm,
  DocumentRequestList,
} from '@/features/document-management/components';
import {
  type DocumentRequestList as DocumentRequestListType,
  type DocumentTypeSummary,
} from '@/features/document-management/domain';
import {
  executeAuthenticatedDocumentRequest,
  requireDocumentSession,
} from '@/features/document-management/server';
import { AuthenticatedShell } from '@/features/navigation';
import type { TenantUserList } from '@/features/tenant-administration/domain';
import { executeAuthenticatedTenantRequest } from '@/features/tenant-administration/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';

export default async function DocumentManagementPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireDocumentSession(true);
  const query = await searchParams;
  let requests: DocumentRequestListType;
  let documentTypes: readonly DocumentTypeSummary[];
  let users: TenantUserList;
  const serviceErrors: string[] = [];
  const [requestsResult, documentTypesResult, usersResult] = await Promise.allSettled([
    executeAuthenticatedDocumentRequest((gateway) => gateway.listRequests({ pageSize: 50 })),
    executeAuthenticatedDocumentRequest((gateway) => gateway.listDocumentTypes()),
    executeAuthenticatedTenantRequest((gateway) => gateway.listUsers({ pageSize: 100 })),
  ]);
  for (const result of [requestsResult, documentTypesResult]) {
    if (
      result.status === 'rejected' &&
      result.reason instanceof DocumentManagementError &&
      result.reason.code === 'unauthorized'
    ) {
      redirect('/auth/session-expired');
    }
  }
  if (requestsResult.status === 'fulfilled') requests = requestsResult.value;
  else {
    requests = {
      data: [],
      meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
    serviceErrors.push('Não foi possível carregar as solicitações em acompanhamento.');
  }
  if (documentTypesResult.status === 'fulfilled') documentTypes = documentTypesResult.value;
  else {
    documentTypes = [];
    serviceErrors.push('Não foi possível carregar os tipos de documentos.');
  }
  if (usersResult.status === 'fulfilled') users = usersResult.value;
  else {
    users = {
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    };
    serviceErrors.push('Não foi possível carregar os titulares.');
  }

  return (
    <AuthenticatedShell user={session.user}>
      <div className="lume-page space-y-5 md:space-y-6">
        <header>
          <div>
            <p className="text-sm font-medium text-primary-emphasis">RH e Departamento Pessoal</p>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Gestão documental</h1>
            <p className="text-sm text-muted-foreground">
              Solicite, acompanhe, revise e renove documentos sem aprovação automática.
            </p>
          </div>
        </header>
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>1. Cadastro</CardTitle>
              <CardDescription>
                RH/DP informa o perfil; a lista documental é calculada automaticamente sem duplicar
                documentos.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2. Acompanhamento</CardTitle>
              <CardDescription>
                Esta tela mostra pendências, envios, revisões, reenvios e vencimentos.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>3. Extração e download</CardTitle>
              <CardDescription>
                Abra uma solicitação para confirmar os dados e baixar XLSX e arquivos daquele
                usuário.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <PageFeedbackToast
          error={query.error ? [query.error, ...serviceErrors] : serviceErrors}
          success={query.success}
        />

        <Card>
          <Collapsible className="group/document-batch">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:p-6">
              <span>
                <span className="block font-semibold">Criar solicitação avulsa</span>
                <span className="block text-sm text-muted-foreground">
                  Escolha os documentos uma vez e envie solicitações individuais para um ou mais
                  usuários.
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-open/document-batch:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <BatchDocumentRequestForm users={users.data} documentTypes={documentTypes} />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Solicitações em acompanhamento</h2>
          <DocumentRequestList requests={requests.data} management />
        </section>
      </div>
    </AuthenticatedShell>
  );
}
