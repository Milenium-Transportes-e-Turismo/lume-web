import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ExternalLink, FileSearch, ShieldAlert, Sparkles } from 'lucide-react';

import { hasPermission } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';
import {
  promoteRegistrationCandidateAction,
  reviewRegistrationCandidateAction,
} from '@/features/registrations/actions';
import {
  CandidateDecisionActions,
  PromoteCandidateButton,
  ReadonlyConversationDialog,
  RegistrationForm,
  RelatedRegistrationsFields,
  type RelatedRegistrationInitialValue,
} from '@/features/registrations/components';
import type {
  RegistrationCandidate,
  RegistrationCandidateSource,
  RegistrationEmail,
  RegistrationPhone,
  RegistrationType,
} from '@/features/registrations/domain';
import { executeAuthenticatedRegistrationRequest } from '@/features/registrations/server';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { formatCnpj, formatCpf } from '@/shared/utils/brazilian-data';
import { formatPersonName } from '@/shared/utils/person-name';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export const metadata: Metadata = { title: 'Revisar candidato | Lume' };

const statusLabels: Readonly<Record<RegistrationCandidate['status'], string>> = {
  imported: 'Importado',
  processing: 'Processando',
  'insufficient-data': 'Dados insuficientes',
  'ready-for-decision': 'Pronto para decidir',
  ambiguous: 'Ambíguo',
  'in-review': 'Em revisão',
  unidentified: 'Não identificado',
  ignored: 'Ignorado',
  approved: 'Aprovado',
  promoted: 'Promovido',
  error: 'Erro',
};

function stringValue(payload: Readonly<Record<string, unknown>> | null, key: string) {
  const value = payload?.[key];
  return typeof value === 'string' ? value : undefined;
}

function objectValue(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function confirmedGraph(payload: Readonly<Record<string, unknown>> | null) {
  if (!payload || !Array.isArray(payload.registrations)) return null;
  const primaryLocalId =
    typeof payload.primaryLocalId === 'string' ? payload.primaryLocalId : 'primary';
  const registrations = payload.registrations.flatMap((entry) => {
    const value = objectValue(entry);
    const registration = objectValue(value?.registration);
    return typeof value?.localId === 'string' && registration
      ? [{ localId: value.localId, registration }]
      : [];
  });
  const relationships = Array.isArray(payload.relationships)
    ? payload.relationships.flatMap((relationship) => {
        const value = objectValue(relationship);
        return value ? [value] : [];
      })
    : [];
  return { primaryLocalId, registrations, relationships };
}

function relatedInitialValues(
  payload: Readonly<Record<string, unknown>> | null,
): RelatedRegistrationInitialValue[] {
  const graph = confirmedGraph(payload);
  if (!graph) return [];
  return graph.registrations
    .filter((entry) => entry.localId !== graph.primaryLocalId)
    .map((entry) => {
      const relationship = graph.relationships.find(
        (item) => item.sourceLocalId === entry.localId || item.targetLocalId === entry.localId,
      );
      const firstPhone = phones(entry.registration)?.[0];
      const firstEmail = emails(entry.registration)?.[0];
      return {
        localId: entry.localId,
        type: (stringValue(entry.registration, 'type') as RegistrationType) ?? 'pf',
        firstName: stringValue(entry.registration, 'firstName'),
        lastName: stringValue(entry.registration, 'lastName'),
        legalName: stringValue(entry.registration, 'legalName'),
        tradeName: stringValue(entry.registration, 'tradeName'),
        cpf: stringValue(entry.registration, 'cpf'),
        cnpj: stringValue(entry.registration, 'cnpj'),
        phone: firstPhone?.number,
        email: firstEmail?.address,
        roleCodes: stringValues(entry.registration, 'roleCodes'),
        tagCodes: stringValues(entry.registration, 'tagCodes'),
        relationshipType: typeof relationship?.type === 'string' ? relationship.type : undefined,
        relationshipDirection:
          relationship?.sourceLocalId === graph.primaryLocalId
            ? 'primary-to-related'
            : 'related-to-primary',
        jobTitle: typeof relationship?.jobTitle === 'string' ? relationship.jobTitle : undefined,
        department:
          typeof relationship?.department === 'string' ? relationship.department : undefined,
        isPrimary: relationship?.isPrimary === true,
        notes: typeof relationship?.notes === 'string' ? relationship.notes : undefined,
      };
    });
}

function stringValues(payload: Readonly<Record<string, unknown>> | null, key: string) {
  const value = payload?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

function phones(
  payload: Readonly<Record<string, unknown>> | null,
): RegistrationPhone[] | undefined {
  const value = payload?.phones;
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const data = item as Record<string, unknown>;
    if (typeof data.number !== 'string') return [];
    const type = ['mobile', 'commercial', 'residential', 'other'].includes(String(data.type))
      ? (data.type as RegistrationPhone['type'])
      : 'mobile';
    return [
      {
        number: data.number,
        type,
        isPrimary: data.isPrimary === true,
        hasWhatsApp: data.hasWhatsApp === true,
      },
    ];
  });
}

function emails(
  payload: Readonly<Record<string, unknown>> | null,
): RegistrationEmail[] | undefined {
  const value = payload?.emails;
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const data = item as Record<string, unknown>;
    if (typeof data.address !== 'string') return [];
    const type = ['personal', 'commercial', 'financial', 'other'].includes(String(data.type))
      ? (data.type as RegistrationEmail['type'])
      : 'personal';
    return [{ address: data.address, type, isPrimary: data.isPrimary === true }];
  });
}

function suggestedRoleCodes(candidate: RegistrationCandidate) {
  return candidate.suggestedRoles.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const code = (item as Record<string, unknown>).code;
    return typeof code === 'string' ? [code] : [];
  });
}

function payloadText(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Não informado';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

const evidenceRuleLabels: Readonly<Record<string, string>> = {
  TELEFONE_EXATO: 'Mesmo telefone encontrado nas duas fontes',
  DOCUMENTO_EXATO: 'Mesmo documento encontrado nas duas fontes',
  NOME_EXATO: 'Mesmo nome encontrado nas duas fontes',
};

const decisionActionLabels: Readonly<Record<string, string>> = {
  START_REVIEW: 'Revisão iniciada',
  SAVE_REVIEW: 'Revisão salva',
  MARK_UNIDENTIFIED: 'Marcado como não identificado',
  IGNORE: 'Candidato ignorado',
  APPROVE: 'Candidato aprovado',
  PROMOTE: 'Promovido ao Cadastro oficial',
};

function evidenceDetails(value: unknown) {
  if (typeof value === 'string') {
    return { title: value, detail: null, source: null, strength: null };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      title: 'Indício adicional encontrado',
      detail: null,
      source: null,
      strength: null,
    };
  }
  const item = value as Record<string, unknown>;
  const message = typeof item.message === 'string' ? item.message : null;
  const rule = typeof item.rule === 'string' ? item.rule : null;
  const title = (rule && evidenceRuleLabels[rule]) || message || 'Indício adicional encontrado';
  const detail =
    message && message !== title
      ? message
      : typeof item.ambiguityReason === 'string'
        ? item.ambiguityReason
        : null;
  const score = typeof item.score === 'number' ? item.score : null;
  const source =
    typeof item.source === 'string'
      ? item.source === 'Correspondências'
        ? 'Comparação entre fontes'
        : item.source
      : null;
  const strength =
    score === null
      ? null
      : score >= 90
        ? 'Correspondência forte'
        : score >= 60
          ? 'Correspondência relevante'
          : 'Indício complementar';
  return { title, detail, source, strength };
}

const payloadFieldLabels: Readonly<Record<string, string>> = {
  nome: 'Nome',
  name: 'Nome',
  documento: 'Documento',
  document: 'Documento',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  telefone: 'Telefone',
  telefone_original: 'Telefone informado',
  phone: 'Telefone',
  email: 'E-mail',
  cidade: 'Cidade',
  city: 'Cidade',
  estado: 'Estado',
  state: 'Estado',
};

function payloadFieldLabel(key: string) {
  return (
    payloadFieldLabels[key] ??
    key.replace(/[_-]+/g, ' ').replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('pt-BR'))
  );
}

function formattedPayloadText(key: string, value: unknown) {
  if (typeof value !== 'string') return payloadText(value);
  const normalizedKey = key.toLocaleLowerCase('pt-BR');
  const digits = value.replace(/\D/g, '');
  if (
    normalizedKey.includes('cpf') ||
    (normalizedKey.includes('document') && digits.length === 11)
  ) {
    return formatCpf(value);
  }
  if (
    normalizedKey.includes('cnpj') ||
    (normalizedKey.includes('document') && digits.length === 14)
  ) {
    return formatCnpj(value);
  }
  return payloadText(value);
}

function isTechnicalPayloadField(key: string) {
  return /(^id$|(?:^|_)(?:chat|source|external|sqlite|row|jid|lid)_?id$|fingerprint|sha256|hash)/i.test(
    key,
  );
}

function CandidateSourceList({
  sources,
}: {
  readonly sources: readonly RegistrationCandidateSource[];
}) {
  if (sources.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma fonte deste tipo.</p>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {sources.map((source) => (
        <article className="space-y-3 p-3" key={source.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-medium">{source.externalRecord.sourceSheet}</h3>
              <p className="text-xs text-muted-foreground">
                Linha {source.externalRecord.sourceRow}
              </p>
            </div>
            <Badge variant={source.isPrimary ? 'default' : 'outline'}>
              {source.isPrimary ? 'Fonte principal' : 'Fonte relacionada'}
            </Badge>
          </div>
          {source.evidence ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">{source.evidence}</p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {[
              ['Como foi informado', source.externalRecord.rawPayload],
              ['Após padronização', source.externalRecord.normalizedPayload],
            ].map(([title, payload]) => (
              <section key={title as string}>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {title as string}
                </h4>
                <dl className="space-y-1.5 text-sm">
                  {Object.entries(payload as Readonly<Record<string, unknown>>)
                    .filter(([key]) => !isTechnicalPayloadField(key))
                    .map(([key, value]) => (
                      <div className="grid grid-cols-[minmax(7rem,0.4fr)_1fr] gap-2" key={key}>
                        <dt className="break-words text-muted-foreground">
                          {payloadFieldLabel(key)}
                        </dt>
                        <dd className="break-words">{formattedPayloadText(key, value)}</dd>
                      </div>
                    ))}
                </dl>
              </section>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export default async function RegistrationCandidatePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ candidateId: string }>;
  readonly searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireTenantSession(['clients:history', 'clients:manage']);
  const [{ candidateId }, search] = await Promise.all([params, searchParams]);
  const [candidate, catalog] = await Promise.all([
    executeAuthenticatedRegistrationRequest((gateway) => gateway.getCandidate(candidateId)),
    executeAuthenticatedRegistrationRequest((gateway) => gateway.catalog()),
  ]);
  const canManage = hasPermission(session.user, 'clients:manage');
  const isAdministrator = session.user.isAdministrator === true;
  const canViewConversation =
    hasPermission(session.user, 'whatsapp-conversations:view') ||
    hasPermission(session.user, 'whatsapp-conversations:manage');
  const pdfSources = candidate.sources.filter(
    (source) => source.externalRecord.kind === 'pdf-customer',
  );
  const whatsappSources = candidate.sources.filter(
    (source) => source.externalRecord.kind === 'whatsapp-contact',
  );
  const graph = confirmedGraph(candidate.confirmedPayload);
  const confirmed =
    graph?.registrations.find((entry) => entry.localId === graph.primaryLocalId)?.registration ??
    candidate.confirmedPayload;
  const type =
    (stringValue(confirmed, 'type') as RegistrationType | undefined) ??
    candidate.confirmedType ??
    candidate.suggestedType ??
    'pf';
  const rawDisplayName =
    stringValue(confirmed, type === 'pj' ? 'legalName' : 'firstName') ??
    candidate.displayName ??
    '';
  const displayName = type === 'pf' ? formatPersonName(rawDisplayName) : rawDisplayName;
  const nameParts = displayName.trim().split(/\s+/);
  const initialPhones = phones(confirmed);
  const initialEmails = emails(confirmed);
  const document = candidate.documentNormalized;

  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-[96rem] space-y-4 p-4 md:p-6">
        <PageFeedbackToast error={search.error} success={search.success} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Conciliação de Cadastros</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {displayName || 'Candidato sem nome'}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{statusLabels[candidate.status]}</Badge>
              <Badge variant="outline">Confiança {candidate.confidence}/100</Badge>
              <Badge variant="outline">{candidate.sources.length} fonte(s)</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {candidate.whatsappConversationId && canViewConversation ? (
              <ReadonlyConversationDialog conversationId={candidate.whatsappConversationId} />
            ) : null}
            <Button variant="outline" render={<Link href="/registration-reconciliation" />}>
              Voltar à fila
            </Button>
          </div>
        </header>

        {candidate.qualityIssues.length ? (
          <Alert variant="destructive">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>Revise estes pontos antes de decidir</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-5">
                {candidate.qualityIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {candidate.status === 'promoted' && candidate.promotedRegistration ? (
          <Alert>
            <BadgeCheck aria-hidden="true" />
            <AlertTitle>Identidade promovida ao Cadastro oficial</AlertTitle>
            <AlertDescription>
              <Link
                className="inline-flex items-center gap-1 font-medium text-primary underline"
                href={`/registrations/${candidate.promotedRegistration.id}`}
              >
                {candidate.promotedRegistration.displayName} <ExternalLink aria-hidden="true" />
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(30rem,1fr)] xl:items-start">
          <div className="space-y-3">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Por que estes dados foram sugeridos?</CardTitle>
                <CardDescription>
                  Estes indícios ajudam na conferência, mas a decisão final continua sendo humana.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y rounded-lg border p-0">
                {candidate.evidence.map((item, index) => {
                  const evidence = evidenceDetails(item);
                  return (
                    <div className="flex gap-3 p-3" key={index}>
                      <Sparkles
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{evidence.title}</p>
                          {evidence.strength ? (
                            <Badge variant="outline">{evidence.strength}</Badge>
                          ) : null}
                        </div>
                        {evidence.detail ? (
                          <p className="mt-1 text-sm text-muted-foreground">{evidence.detail}</p>
                        ) : null}
                        {evidence.source ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Origem: {evidence.source}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {candidate.evidence.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    Não há indícios suficientes para explicar uma sugestão automática. Confira as
                    fontes antes de decidir.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {isAdministrator ? (
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Fontes e auditoria</CardTitle>
                  <CardDescription>
                    Informações de apoio disponíveis somente para administradores.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs
                    defaultValue={
                      pdfSources.length > 0
                        ? 'pdf'
                        : whatsappSources.length > 0
                          ? 'whatsapp'
                          : 'decisions'
                    }
                    className="gap-3"
                  >
                    <TabsList className="max-w-full overflow-x-auto">
                      <TabsTrigger value="pdf">Clientes PDF ({pdfSources.length})</TabsTrigger>
                      <TabsTrigger value="whatsapp">
                        Contatos WhatsApp ({whatsappSources.length})
                      </TabsTrigger>
                      <TabsTrigger value="decisions">Trilha de decisões</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pdf">
                      <CandidateSourceList sources={pdfSources} />
                    </TabsContent>
                    <TabsContent value="whatsapp">
                      <CandidateSourceList sources={whatsappSources} />
                    </TabsContent>
                    <TabsContent value="decisions">
                      {candidate.decisions.length ? (
                        <div className="divide-y rounded-lg border">
                          {candidate.decisions.map((decision) => (
                            <article className="p-3" key={decision.id}>
                              <p className="font-medium">
                                {decisionActionLabels[decision.action] ?? 'Decisão registrada'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(decision.createdAt).toLocaleString('pt-BR')} ·{' '}
                                {decision.actorName}
                              </p>
                              {decision.note ? (
                                <p className="mt-1 text-sm">{decision.note}</p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Nenhuma decisão registrada.
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-3 xl:sticky xl:top-3">
            {canManage && candidate.status !== 'promoted' ? (
              <RegistrationForm
                formId="candidate-review-form"
                action={reviewRegistrationCandidateAction}
                catalog={catalog}
                hiddenFields={{ candidateId: candidate.id, expectedVersion: candidate.version }}
                initialValues={{
                  type,
                  status: (stringValue(confirmed, 'status') as 'active' | 'inactive') ?? 'active',
                  avicExternalId: stringValue(confirmed, 'avicExternalId'),
                  firstName:
                    stringValue(confirmed, 'firstName') ?? (type === 'pf' ? nameParts[0] : ''),
                  lastName:
                    stringValue(confirmed, 'lastName') ??
                    (type === 'pf' ? nameParts.slice(1).join(' ') : ''),
                  legalName:
                    stringValue(confirmed, 'legalName') ??
                    (type === 'pj' ? (candidate.displayName ?? '') : ''),
                  tradeName: stringValue(confirmed, 'tradeName'),
                  cpf:
                    stringValue(confirmed, 'cpf') ??
                    (type === 'pf' && document?.length === 11 ? document : ''),
                  cnpj:
                    stringValue(confirmed, 'cnpj') ??
                    (type === 'pj' && document?.length === 14 ? document : ''),
                  phone: initialPhones?.length
                    ? undefined
                    : (candidate.phoneOriginal ?? candidate.phoneNormalized ?? ''),
                  phones: initialPhones,
                  emails: initialEmails,
                  roleCodes: stringValues(confirmed, 'roleCodes') ?? suggestedRoleCodes(candidate),
                  tagCodes: stringValues(confirmed, 'tagCodes'),
                }}
              >
                <RelatedRegistrationsFields
                  catalog={catalog}
                  initialValues={relatedInitialValues(candidate.confirmedPayload)}
                />
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Decisão individual</CardTitle>
                    <CardDescription>
                      Salvar não aprova. Aprovar valida os campos, mas ainda não cria o Cadastro.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="review-note">Justificativa ou observação</Label>
                      <Textarea id="review-note" name="note" maxLength={1000} />
                    </div>
                    <CandidateDecisionActions formId="candidate-review-form" />
                  </CardContent>
                </Card>
              </RegistrationForm>
            ) : null}

            {canManage && candidate.status === 'approved' ? (
              <Card size="sm" className="border-primary/40">
                <CardHeader>
                  <CardTitle>Promover ao Cadastro oficial</CardTitle>
                  <CardDescription>
                    A promoção é atômica, auditada e não pode criar duas identidades para o mesmo
                    candidato.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form id="candidate-promotion-form" action={promoteRegistrationCandidateAction}>
                    <input type="hidden" name="candidateId" value={candidate.id} />
                    <input type="hidden" name="expectedVersion" value={candidate.version} />
                    <PromoteCandidateButton formId="candidate-promotion-form" />
                  </form>
                </CardContent>
              </Card>
            ) : null}

            {!canManage ? (
              <Card size="sm">
                <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                  <FileSearch aria-hidden="true" className="size-5" />
                  Seu acesso permite consultar as evidências, mas não registrar decisões.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </main>
    </AuthenticatedShell>
  );
}
