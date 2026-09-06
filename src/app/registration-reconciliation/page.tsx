import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BadgeCheck,
  Database,
  FileWarning,
  Inbox,
  MessageCircle,
  Search,
  TriangleAlert,
} from 'lucide-react';

import { hasPermission } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';
import { ReconciliationImport } from '@/features/registrations/components';
import type { RegistrationCandidateStatus } from '@/features/registrations/domain';
import { executeAuthenticatedRegistrationRequest } from '@/features/registrations/server';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { DynamicFilterForm } from '@/shared/dynamic-filter-form';
import { formatCnpj, formatCpf, formatPhone } from '@/shared/utils/brazilian-data';
import { formatPersonName } from '@/shared/utils/person-name';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Input } from '@/shared/ui/input';
import { NativeSelect, NativeSelectOption } from '@/shared/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export const metadata: Metadata = {
  title: 'Conciliação de Cadastros | Lume',
  description: 'Revisão individual de identidades sugeridas a partir de fontes históricas.',
};

const candidateStatus = {
  imported: { label: 'Importado', variant: 'outline' },
  processing: { label: 'Processando', variant: 'outline' },
  'insufficient-data': { label: 'Dados insuficientes', variant: 'destructive' },
  'ready-for-decision': { label: 'Pronto para decidir', variant: 'secondary' },
  ambiguous: { label: 'Ambíguo', variant: 'destructive' },
  'in-review': { label: 'Em revisão', variant: 'secondary' },
  unidentified: { label: 'Não identificado', variant: 'outline' },
  ignored: { label: 'Ignorado', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  promoted: { label: 'Promovido', variant: 'default' },
  error: { label: 'Erro', variant: 'destructive' },
} as const satisfies Readonly<
  Record<
    RegistrationCandidateStatus,
    { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive' }
  >
>;

type SearchParams = {
  page?: string;
  search?: string;
  statuses?: string;
  type?: string;
  suggestedRoleCode?: string;
  hasDocument?: string;
  hasDocumentIssue?: string;
  hasWhatsApp?: string;
  hasConversation?: string;
  highConfidence?: string;
  incomplete?: string;
  reviewedBy?: string;
  batchId?: string;
  sort?: string;
  error?: string;
  success?: string;
};

function href(search: SearchParams, next: Partial<SearchParams>) {
  const values = new URLSearchParams();
  Object.entries({ ...search, ...next }).forEach(([key, value]) => {
    if (value && key !== 'error' && key !== 'success') values.set(key, value);
  });
  return `/registration-reconciliation?${values.toString()}`;
}

function candidateDocument(value: string | null) {
  if (!value) return 'Não informado';
  if (value.length === 11) return formatCpf(value);
  if (value.length === 14) return formatCnpj(value);
  return value;
}

function candidateDisplayName(candidate: {
  readonly displayName: string | null;
  readonly confirmedType: 'pf' | 'pj' | null;
  readonly suggestedType: 'pf' | 'pj' | null;
}) {
  if (!candidate.displayName) return 'Nome indisponível';
  const value = candidate.displayName;
  return (candidate.confirmedType ?? candidate.suggestedType) === 'pf'
    ? formatPersonName(value)
    : value;
}

function batchRowErrors(counts: Readonly<Record<string, unknown>>): string[] {
  const value = counts.rowErrors;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export default async function RegistrationReconciliationPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  const session = await requireTenantSession(['clients:history', 'clients:manage']);
  const search = await searchParams;
  const page = Math.max(1, Number(search.page) || 1);
  const pageSize = 30;
  const [result, batches, catalog] = await Promise.all([
    executeAuthenticatedRegistrationRequest((gateway) =>
      gateway.listCandidates({
        page,
        pageSize,
        search: search.search,
        statuses: search.statuses,
        type: search.type,
        suggestedRoleCode: search.suggestedRoleCode,
        hasDocument:
          search.hasDocument === 'true' ? true : search.hasDocument === 'false' ? false : undefined,
        hasDocumentIssue: search.hasDocumentIssue === 'true' ? true : undefined,
        hasWhatsApp:
          search.hasWhatsApp === 'true' ? true : search.hasWhatsApp === 'false' ? false : undefined,
        hasConversation:
          search.hasConversation === 'true'
            ? true
            : search.hasConversation === 'false'
              ? false
              : undefined,
        highConfidence: search.highConfidence === 'true' ? true : undefined,
        incomplete: search.incomplete === 'true' ? true : undefined,
        reviewedBy: search.reviewedBy,
        batchId: search.batchId,
        sort: search.sort,
      }),
    ),
    executeAuthenticatedRegistrationRequest((gateway) => gateway.listBatches()),
    executeAuthenticatedRegistrationRequest((gateway) => gateway.catalog()),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / pageSize));
  const openCount =
    (result.counts['ready-for-decision'] ?? 0) +
    (result.counts.ambiguous ?? 0) +
    (result.counts['in-review'] ?? 0) +
    (result.counts.unidentified ?? 0);

  return (
    <AuthenticatedShell user={session.user}>
      <main className="lume-page space-y-4">
        <PageFeedbackToast error={search.error} success={search.success} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Pré-cadastro permanente</p>
            <h1 className="text-3xl font-semibold tracking-tight">Conciliação de Cadastros</h1>
            <p className="text-muted-foreground">
              Compare evidências, corrija dados e promova somente identidades revisadas para o
              Cadastro oficial.
            </p>
          </div>
          <Button variant="outline" render={<Link href="/registrations" />}>
            Voltar ao Cadastro
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card size="sm">
            <CardContent className="flex items-center gap-3 p-3">
              <Inbox aria-hidden="true" className="size-5 text-primary" />
              <div>
                <p className="text-2xl font-semibold">{openCount}</p>
                <p className="text-xs text-muted-foreground">Aguardando decisão</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3 p-3">
              <TriangleAlert
                aria-hidden="true"
                className="size-5 text-amber-600 dark:text-amber-400"
              />
              <div>
                <p className="text-2xl font-semibold">{result.counts.ambiguous ?? 0}</p>
                <p className="text-xs text-muted-foreground">Ambíguos</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3 p-3">
              <BadgeCheck
                aria-hidden="true"
                className="size-5 text-emerald-600 dark:text-emerald-400"
              />
              <div>
                <p className="text-2xl font-semibold">{result.counts.promoted ?? 0}</p>
                <p className="text-xs text-muted-foreground">Promovidos</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3 p-3">
              <Database aria-hidden="true" className="size-5 text-primary" />
              <div>
                <p className="text-2xl font-semibold">{batches.length}</p>
                <p className="text-xs text-muted-foreground">Lotes importados</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {hasPermission(session.user, 'clients:manage') ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Importar nova análise</CardTitle>
              <CardDescription>
                O hash do arquivo e as identidades estáveis das fontes impedem duplicações.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReconciliationImport />
            </CardContent>
          </Card>
        ) : null}

        <Card size="sm">
          <CardHeader>
            <CardTitle>Fila para revisão</CardTitle>
            <CardDescription>
              Refine a lista abaixo; as alterações são aplicadas automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DynamicFilterForm
              key={JSON.stringify(search)}
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1fr)_13rem_13rem_13rem]"
            >
              <div className="relative md:col-span-2 xl:col-span-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  name="search"
                  defaultValue={search.search}
                  className="pl-9"
                  placeholder="Nome, documento, telefone ou cidade"
                  aria-label="Pesquisar na Conciliação de Cadastros"
                />
              </div>
              <NativeSelect
                className="w-full"
                name="statuses"
                defaultValue={search.statuses}
                aria-label="Filtrar candidatos por situação"
              >
                <NativeSelectOption value="">Todas as situações</NativeSelectOption>
                {Object.entries(candidateStatus).map(([value, option]) => (
                  <NativeSelectOption value={value} key={value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                className="w-full"
                name="type"
                defaultValue={search.type}
                aria-label="Filtrar candidatos por tipo de pessoa"
              >
                <NativeSelectOption value="">PF e PJ</NativeSelectOption>
                <NativeSelectOption value="pf">Pessoa física</NativeSelectOption>
                <NativeSelectOption value="pj">Pessoa jurídica</NativeSelectOption>
              </NativeSelect>
              <NativeSelect
                className="w-full"
                name="suggestedRoleCode"
                defaultValue={search.suggestedRoleCode}
                aria-label="Filtrar candidatos por Papel sugerido"
              >
                <NativeSelectOption value="">Todos os Papéis sugeridos</NativeSelectOption>
                {catalog.roles
                  .filter((role) => role.active !== false)
                  .map((role) => (
                    <NativeSelectOption value={role.code} key={role.id}>
                      {role.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
              <details className="rounded-lg border p-3 md:col-span-2 xl:col-span-4">
                <summary className="cursor-pointer text-sm font-medium">Filtros avançados</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <NativeSelect
                    className="w-full"
                    name="batchId"
                    defaultValue={search.batchId}
                    aria-label="Filtrar candidatos por lote de importação"
                  >
                    <NativeSelectOption value="">Todos os lotes</NativeSelectOption>
                    {batches.map((batch) => (
                      <NativeSelectOption value={batch.id} key={batch.id}>
                        {new Date(batch.createdAt).toLocaleDateString('pt-BR')} · {batch.fileName}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    className="w-full"
                    name="hasDocument"
                    defaultValue={search.hasDocument}
                    aria-label="Filtrar candidatos pela presença de documento"
                  >
                    <NativeSelectOption value="">Com ou sem documento</NativeSelectOption>
                    <NativeSelectOption value="true">Possui documento</NativeSelectOption>
                    <NativeSelectOption value="false">Sem documento</NativeSelectOption>
                  </NativeSelect>
                  <NativeSelect
                    className="w-full"
                    name="hasDocumentIssue"
                    defaultValue={search.hasDocumentIssue}
                    aria-label="Filtrar candidatos por problema no documento"
                  >
                    <NativeSelectOption value="">Qualquer documento</NativeSelectOption>
                    <NativeSelectOption value="true">Documento inválido</NativeSelectOption>
                  </NativeSelect>
                  <NativeSelect
                    className="w-full"
                    name="hasWhatsApp"
                    defaultValue={search.hasWhatsApp}
                    aria-label="Filtrar candidatos pela presença de WhatsApp"
                  >
                    <NativeSelectOption value="">Com ou sem WhatsApp</NativeSelectOption>
                    <NativeSelectOption value="true">Possui WhatsApp</NativeSelectOption>
                    <NativeSelectOption value="false">Sem WhatsApp</NativeSelectOption>
                  </NativeSelect>
                  <NativeSelect
                    className="w-full"
                    name="hasConversation"
                    defaultValue={search.hasConversation}
                    aria-label="Filtrar candidatos pela presença de conversa"
                  >
                    <NativeSelectOption value="">Com ou sem conversa</NativeSelectOption>
                    <NativeSelectOption value="true">Conversa disponível</NativeSelectOption>
                    <NativeSelectOption value="false">Sem conversa disponível</NativeSelectOption>
                  </NativeSelect>
                  <NativeSelect
                    className="w-full"
                    name="highConfidence"
                    defaultValue={search.highConfidence}
                    aria-label="Filtrar candidatos por alta confiança"
                  >
                    <NativeSelectOption value="">Qualquer confiança</NativeSelectOption>
                    <NativeSelectOption value="true">Alta confiança</NativeSelectOption>
                  </NativeSelect>
                  <NativeSelect
                    className="w-full"
                    name="incomplete"
                    defaultValue={search.incomplete}
                    aria-label="Filtrar candidatos por dados incompletos"
                  >
                    <NativeSelectOption value="">Completos e incompletos</NativeSelectOption>
                    <NativeSelectOption value="true">Dados incompletos</NativeSelectOption>
                  </NativeSelect>
                  <Input
                    name="reviewedBy"
                    defaultValue={search.reviewedBy}
                    placeholder="Revisado por (nome)"
                    aria-label="Filtrar por usuário revisor"
                  />
                  <NativeSelect
                    className="w-full"
                    name="sort"
                    defaultValue={search.sort}
                    aria-label="Ordenar candidatos"
                  >
                    <NativeSelectOption value="priority">Prioridade operacional</NativeSelectOption>
                    <NativeSelectOption value="name">Nome</NativeSelectOption>
                    <NativeSelectOption value="updated">Atualização recente</NativeSelectOption>
                  </NativeSelect>
                </div>
              </details>
              <p className="flex items-center justify-between gap-3 text-xs text-muted-foreground md:col-span-2 xl:col-span-4">
                <span>Digite ou selecione um valor para atualizar a fila.</span>
                <Link
                  className="font-medium text-primary hover:underline"
                  href="/registration-reconciliation"
                >
                  Limpar filtros
                </Link>
              </p>
            </DynamicFilterForm>
          </CardContent>
        </Card>

        {result.items.length === 0 ? (
          <Card size="sm">
            <CardContent className="p-0">
              <Empty className="min-h-72">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum candidato nesta visualização</EmptyTitle>
                  <EmptyDescription>
                    Importe uma planilha ou ajuste os filtros. Registros técnicos do WhatsApp não
                    aparecem como pessoas.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <Card size="sm" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidato</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Evidências</TableHead>
                      <TableHead>Qualidade</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell>
                          <Link
                            className="font-medium text-primary hover:underline"
                            href={`/registration-reconciliation/${candidate.id}`}
                          >
                            {candidateDisplayName(candidate)}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {[candidate.city, candidate.state].filter(Boolean).join(' / ') ||
                              'Localidade não informada'}
                          </p>
                        </TableCell>
                        <TableCell>
                          {candidateDocument(candidate.documentNormalized)}
                          {candidate.documentValid === false ? (
                            <p className="text-xs text-destructive">Inválido</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {candidate.phoneNormalized
                            ? formatPhone(candidate.phoneNormalized)
                            : 'Não informado'}
                          {candidate.whatsappConversationId ? (
                            <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                              <MessageCircle aria-hidden="true" className="size-3" /> Conversa
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <p>{candidate.sources.length} fonte(s)</p>
                          <p className="text-xs text-muted-foreground">
                            Confiança {candidate.confidence}/100
                          </p>
                        </TableCell>
                        <TableCell>
                          {candidate.qualityIssues.length ? (
                            <span className="flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                              <FileWarning aria-hidden="true" className="size-4" />{' '}
                              {candidate.qualityIssues.length} alerta(s)
                            </span>
                          ) : (
                            'Sem alertas'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={candidateStatus[candidate.status].variant}>
                            {candidateStatus[candidate.status].label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {result.items.map((candidate) => (
                  <article className="space-y-2 p-3" key={candidate.id}>
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        className="font-semibold text-primary"
                        href={`/registration-reconciliation/${candidate.id}`}
                      >
                        {candidateDisplayName(candidate)}
                      </Link>
                      <Badge variant={candidateStatus[candidate.status].variant}>
                        {candidateStatus[candidate.status].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {candidateDocument(candidate.documentNormalized)} ·{' '}
                      {candidate.phoneNormalized
                        ? formatPhone(candidate.phoneNormalized)
                        : 'sem telefone'}
                    </p>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Paginação">
          <p className="text-sm text-muted-foreground">
            Página {page} de {pages} · {result.total} candidatos
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              render={
                page > 1 ? <Link href={href(search, { page: String(page - 1) })} /> : undefined
              }
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={page >= pages}
              render={
                page < pages ? <Link href={href(search, { page: String(page + 1) })} /> : undefined
              }
            >
              Próxima
            </Button>
          </div>
        </nav>

        {batches.length ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Lotes recentes</CardTitle>
              <CardDescription>Auditoria de arquivos importados.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {batches.slice(0, 6).map((batch) => (
                <div className="rounded-lg border p-3" key={batch.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium" title={batch.fileName}>
                      {batch.fileName}
                    </p>
                    <Badge variant={batch.status === 'failed' ? 'destructive' : 'outline'}>
                      {batch.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(batch.createdAt).toLocaleString('pt-BR')} · {batch.importedRows} novas
                    fontes · {batch.errorRows} erros
                  </p>
                  {batchRowErrors(batch.counts).length ? (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer font-medium text-destructive">
                        Investigar linhas com erro
                      </summary>
                      <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-5 text-muted-foreground">
                        {batchRowErrors(batch.counts).map((error, index) => (
                          <li key={`${index}-${error}`}>{error}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </AuthenticatedShell>
  );
}
