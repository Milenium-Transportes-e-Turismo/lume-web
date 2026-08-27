import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BadgeCheck,
  ExternalLink,
  FileSearch,
  MessageCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import { hasPermission } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';
import {
  promoteRegistrationCandidateAction,
  reviewRegistrationCandidateAction,
} from '@/features/registrations/actions';
import {
  CandidateDecisionActions,
  PromoteCandidateButton,
  RegistrationForm,
  RelatedRegistrationsFields,
  type RelatedRegistrationInitialValue,
} from '@/features/registrations/components';
import type {
  RegistrationCandidate,
  RegistrationEmail,
  RegistrationPhone,
  RegistrationType,
} from '@/features/registrations/domain';
import { executeAuthenticatedRegistrationRequest } from '@/features/registrations/server';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

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

function evidenceMessage(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return payloadText(value);
  const item = value as Record<string, unknown>;
  return [
    item.message,
    item.rule ? `Regra: ${item.rule}` : null,
    item.score ? `Score: ${item.score}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
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
  const graph = confirmedGraph(candidate.confirmedPayload);
  const confirmed =
    graph?.registrations.find((entry) => entry.localId === graph.primaryLocalId)?.registration ??
    candidate.confirmedPayload;
  const type =
    (stringValue(confirmed, 'type') as RegistrationType | undefined) ??
    candidate.confirmedType ??
    candidate.suggestedType ??
    'pf';
  const displayName =
    stringValue(confirmed, type === 'pj' ? 'legalName' : 'firstName') ??
    candidate.displayName ??
    '';
  const nameParts = displayName.trim().split(/\s+/);
  const initialPhones = phones(confirmed);
  const initialEmails = emails(confirmed);
  const document = candidate.documentNormalized;

  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-[96rem] space-y-5 p-4 md:p-8">
        <PageFeedbackToast error={search.error} success={search.success} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Conciliação de Cadastros</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {candidate.displayName || 'Candidato sem nome'}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{statusLabels[candidate.status]}</Badge>
              <Badge variant="outline">Confiança {candidate.confidence}/100</Badge>
              <Badge variant="outline">{candidate.sources.length} fonte(s)</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {candidate.whatsappConversationId ? (
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/whatsapp-conversations?conversationId=${candidate.whatsappConversationId}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <MessageCircle aria-hidden="true" /> Abrir conversa
              </Button>
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(30rem,1fr)] xl:items-start">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Evidências da sugestão</CardTitle>
                <CardDescription>
                  Dados brutos, normalizados e regras permanecem separados da decisão humana.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidate.evidence.map((item, index) => (
                  <div className="flex gap-3 rounded-xl border p-3" key={index}>
                    <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-sm">{evidenceMessage(item)}</p>
                  </div>
                ))}
                {candidate.evidence.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    A fonte não produziu evidência semântica suficiente.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {candidate.sources.map((source) => (
              <Card key={source.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {source.externalRecord.sourceSheet}
                      </CardTitle>
                      <CardDescription>
                        Linha {source.externalRecord.sourceRow} · {source.externalRecord.externalId}
                      </CardDescription>
                    </div>
                    <Badge variant={source.isPrimary ? 'default' : 'outline'}>
                      {source.isPrimary
                        ? 'Fonte primária'
                        : source.matchRule || 'Evidência associada'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {source.evidence ? (
                    <p className="rounded-lg bg-muted p-3 text-sm">{source.evidence}</p>
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-sm font-medium">Valor bruto</h3>
                      <dl className="space-y-2 text-sm">
                        {Object.entries(source.externalRecord.rawPayload).map(([key, value]) => (
                          <div className="grid grid-cols-[9rem_1fr] gap-2" key={key}>
                            <dt className="break-words text-muted-foreground">{key}</dt>
                            <dd className="break-words">{payloadText(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-medium">Valor normalizado</h3>
                      <dl className="space-y-2 text-sm">
                        {Object.entries(source.externalRecord.normalizedPayload).map(
                          ([key, value]) => (
                            <div className="grid grid-cols-[9rem_1fr] gap-2" key={key}>
                              <dt className="break-words text-muted-foreground">{key}</dt>
                              <dd className="break-words">{payloadText(value)}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader>
                <CardTitle>Trilha de decisões</CardTitle>
                <CardDescription>Registro imutável das revisões deste candidato.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {candidate.decisions.length ? (
                  candidate.decisions.map((decision) => (
                    <div className="rounded-xl border p-3" key={decision.id}>
                      <p className="font-medium">{decision.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(decision.createdAt).toLocaleString('pt-BR')} ·{' '}
                        {decision.actorName}
                      </p>
                      {decision.note ? <p className="mt-2 text-sm">{decision.note}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma decisão registrada.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5 xl:sticky xl:top-5">
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
                <Card>
                  <CardHeader>
                    <CardTitle>Decisão individual</CardTitle>
                    <CardDescription>
                      Salvar não aprova. Aprovar valida os campos, mas ainda não cria o Cadastro.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
              <Card className="border-primary/40">
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
              <Card>
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
