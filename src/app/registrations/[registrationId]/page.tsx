import { executeAuthenticatedDocumentRequest } from '@/features/document-management/server';
import { RegistrationDocumentRequestForm } from '@/features/registrations/components/registration-document-request-form';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Mail,
  Phone,
  Tags,
  UsersRound,
} from 'lucide-react';

import { hasPermission } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';
import {
  createRegistrationRelationshipAction,
  removeRegistrationRelationshipAction,
  updateRegistrationRelationshipAction,
} from '@/features/registrations/actions';
import { executeAuthenticatedRegistrationRequest } from '@/features/registrations/server';
import { RemoveRelationshipButton } from '@/features/registrations/components';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { DynamicFilterForm } from '@/shared/dynamic-filter-form';
import { formatCnpj, formatCpf, formatPhone } from '@/shared/utils/brazilian-data';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { NativeSelect, NativeSelectOption } from '@/shared/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';

export const metadata: Metadata = { title: 'Detalhes do Cadastro | Lume' };

function Field({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{value || 'Não informado'}</dd>
    </div>
  );
}

const historyLabels: Readonly<Record<string, string>> = {
  REGISTRATION_CREATED: 'Cadastro criado',
  REGISTRATION_UPDATED: 'Dados cadastrais atualizados',
  REGISTRATION_RELATIONSHIP_CREATED: 'Relacionamento adicionado',
  REGISTRATION_RELATIONSHIP_UPDATED: 'Relacionamento atualizado',
  REGISTRATION_RELATIONSHIP_REMOVED: 'Relacionamento removido',
  REGISTRATION_PROMOTED_FROM_RECONCILIATION: 'Promovido pela Conciliação',
  ROUTING_COMPANY_CREATED: 'Cliente cadastrado no modelo anterior',
  ROUTING_COMPANY_UPDATED: 'Dados atualizados no modelo anterior',
  ROUTING_COMPANY_STATUS_CHANGED: 'Situação alterada',
};

export default async function RegistrationDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ registrationId: string }>;
  readonly searchParams: Promise<{
    error?: string;
    success?: string;
    tab?: string;
    relationshipSearch?: string;
  }>;
}) {
  const session = await requireTenantSession([
    'clients:view',
    'clients:update',
    'clients:manage',
    'clients:history',
  ]);
  const [{ registrationId }, search] = await Promise.all([params, searchParams]);
  const canUpdate =
    hasPermission(session.user, 'clients:update') || hasPermission(session.user, 'clients:manage');
  const canHistory = hasPermission(session.user, 'clients:history');
  const [registration, history, options] = await Promise.all([
    executeAuthenticatedRegistrationRequest((gateway) => gateway.get(registrationId)),
    canHistory
      ? executeAuthenticatedRegistrationRequest((gateway) => gateway.history(registrationId))
      : Promise.resolve([]),
    canUpdate
      ? executeAuthenticatedRegistrationRequest((gateway) =>
          gateway.list({
            page: 1,
            pageSize: 100,
            search: search.relationshipSearch,
          }),
        )
      : Promise.resolve({ items: [], total: 0 }),
  ]);
  const canRequestDocuments =
    hasPermission(session.user, 'documents:manage') &&
    (session.user.isAdministrator ||
      session.user.departments.some((department) =>
        ['human-resources', 'personnel-department'].includes(department),
      ));
  const checklists =
    canRequestDocuments && registration.type === 'pf'
      ? await executeAuthenticatedDocumentRequest((gateway) => gateway.listChecklists())
      : [];
  const document =
    registration.type === 'pf'
      ? registration.cpf
        ? formatCpf(registration.cpf)
        : null
      : registration.cnpj
        ? formatCnpj(registration.cnpj)
        : null;

  return (
    <AuthenticatedShell user={session.user}>
      <main className="lume-page space-y-4">
        <PageFeedbackToast error={search.error} success={search.success} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Cadastro</p>
            <h1 className="text-3xl font-semibold tracking-tight">{registration.displayName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {registration.type === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}
              </Badge>
              <Badge variant={registration.status === 'active' ? 'default' : 'outline'}>
                {registration.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
              {registration.roles.map((role) => (
                <Badge key={role.id} variant="secondary">
                  {role.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/registrations" />}>
              Voltar
            </Button>
            {canUpdate ? (
              <Button render={<Link href={`/registrations/${registration.id}/edit`} />}>
                Editar Cadastro
              </Button>
            ) : null}
          </div>
        </header>

        {registration.address && (
          <Card>
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
            </CardHeader>
            <CardContent>
              {registration.address.street}, {registration.address.number}
              {registration.address.complement ? ' · ' + registration.address.complement : ''}
              <br />
              {registration.address.district} · {registration.address.city}/
              {registration.address.state} · CEP {registration.address.postalCode}
            </CardContent>
          </Card>
        )}
        {registration.serviceInstructions && (
          <Card>
            <CardHeader>
              <CardTitle>Instruções para atendimento</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap">
              {registration.serviceInstructions}
            </CardContent>
          </Card>
        )}
        {canRequestDocuments && registration.type === 'pf' && (
          <Card>
            <CardHeader>
              <CardTitle>Solicitar documentos</CardTitle>
              <CardDescription>
                A solicitação fica vinculada a esta pessoa, independentemente de uma conta de
                acesso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checklists.length ? (
                <RegistrationDocumentRequestForm
                  registrationId={registration.id}
                  checklists={checklists}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cadastre uma lista de documentos na Gestão documental.
                </p>
              )}
            </CardContent>
          </Card>
        )}
        <Tabs
          defaultValue={
            ['identity', 'contacts', 'relationships', 'history'].includes(search.tab ?? '')
              ? search.tab
              : 'identity'
          }
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="identity">Identidade</TabsTrigger>
            <TabsTrigger value="contacts">Contatos</TabsTrigger>
            <TabsTrigger value="relationships">Relacionamentos</TabsTrigger>
            {canHistory ? <TabsTrigger value="history">Histórico</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="identity" className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Dados oficiais</CardTitle>
                  <CardDescription>
                    Identidade compartilhada pelos módulos autorizados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {registration.type === 'pf' ? (
                      <>
                        <Field label="Nome" value={registration.firstName} />
                        <Field label="Sobrenome" value={registration.lastName} />
                        <Field label="Nome completo" value={registration.individualName} />
                      </>
                    ) : (
                      <>
                        <Field label="Razão social" value={registration.legalName} />
                        <Field label="Nome fantasia" value={registration.tradeName} />
                      </>
                    )}
                    <Field label={registration.type === 'pf' ? 'CPF' : 'CNPJ'} value={document} />
                    <Field label="Código AVIC" value={registration.avicExternalId} />
                    <Field
                      label="Situação"
                      value={registration.status === 'active' ? 'Ativo' : 'Inativo'}
                    />
                  </dl>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Papéis e Marcadores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium">Papéis</p>
                    <div className="flex flex-wrap gap-1.5">
                      {registration.roles.map((role) => (
                        <Badge key={role.id} variant="secondary">
                          <UsersRound aria-hidden="true" /> {role.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Marcadores</p>
                    <div className="flex flex-wrap gap-1.5">
                      {registration.tags.length ? (
                        registration.tags.map((tag) => (
                          <Badge key={tag.id} variant="outline">
                            <Tags aria-hidden="true" /> {tag.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum Marcador.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Integrações externas</CardTitle>
                <CardDescription>
                  Referências externas são associadas ao UUID interno; nunca substituem a identidade
                  do Cadastro.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {registration.externalReferences.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {registration.externalReferences.map((reference) => (
                      <div className="rounded-lg border p-3" key={reference.id}>
                        <p className="font-medium">{reference.provider}</p>
                        <p className="text-sm text-muted-foreground">
                          {reference.resourceType} · {reference.externalResourceId}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma referência externa vinculada. A estrutura está pronta para Google e
                    AVIC.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-3">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Telefones</CardTitle>
              </CardHeader>
              <CardContent>
                {registration.phones.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {registration.phones.map((phone) => (
                      <div className="flex items-start gap-3 rounded-lg border p-3" key={phone.id}>
                        <Phone aria-hidden="true" className="mt-0.5 size-4 text-primary" />
                        <div>
                          <p className="font-medium">
                            {formatPhone(phone.normalizedValue ?? phone.number)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {phone.type} {phone.isPrimary ? '· principal' : ''}{' '}
                            {phone.hasWhatsApp ? '· WhatsApp' : ''}
                          </p>
                          {phone.activeUntil ? (
                            <Badge variant="outline" className="mt-2">
                              Histórico até{' '}
                              {new Date(`${phone.activeUntil}T12:00:00`).toLocaleDateString(
                                'pt-BR',
                              )}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Nenhum telefone cadastrado.</p>
                )}
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>E-mails</CardTitle>
              </CardHeader>
              <CardContent>
                {registration.emails.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {registration.emails.map((email) => (
                      <div className="flex items-start gap-3 rounded-lg border p-3" key={email.id}>
                        <Mail aria-hidden="true" className="mt-0.5 size-4 text-primary" />
                        <div>
                          <p className="break-all font-medium">{email.address}</p>
                          <p className="text-sm text-muted-foreground">
                            {email.type} {email.isPrimary ? '· principal' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Nenhum e-mail cadastrado.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relationships" className="space-y-3">
            {canUpdate ? (
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Novo relacionamento</CardTitle>
                  <CardDescription>
                    Relacione pessoas a empresas ou outros Cadastros sem copiar dados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DynamicFilterForm key={search.relationshipSearch ?? ''} className="space-y-1.5">
                    <input type="hidden" name="tab" value="relationships" />
                    <Input
                      type="search"
                      name="relationshipSearch"
                      defaultValue={search.relationshipSearch}
                      placeholder="Pesquisar por nome, documento, telefone ou e-mail"
                      aria-label="Pesquisar Cadastro relacionado"
                    />
                    <p className="text-xs text-muted-foreground">
                      Os resultados são atualizados automaticamente.
                    </p>
                  </DynamicFilterForm>
                  <form
                    action={createRegistrationRelationshipAction}
                    className="grid gap-3 lg:grid-cols-2"
                  >
                    <input type="hidden" name="registrationId" value={registration.id} />
                    <div className="space-y-1.5">
                      <Label htmlFor="related-registration">Cadastro relacionado</Label>
                      <NativeSelect
                        id="related-registration"
                        name="targetRegistrationId"
                        required
                        className="w-full"
                        defaultValue=""
                      >
                        <NativeSelectOption value="" disabled>
                          Selecione
                        </NativeSelectOption>
                        {options.items
                          .filter((option) => option.id !== registration.id)
                          .map((option) => (
                            <NativeSelectOption key={option.id} value={option.id}>
                              {option.displayName}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="relationship-type">Tipo de relacionamento</Label>
                      <Input
                        id="relationship-type"
                        name="relationshipType"
                        required
                        placeholder="Ex.: trabalha em, representa, pertence a"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="job-title">Cargo ou função</Label>
                      <Input id="job-title" name="jobTitle" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="department">Departamento</Label>
                      <Input id="department" name="department" />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <Label htmlFor="relationship-notes">Observações</Label>
                      <Textarea id="relationship-notes" name="notes" maxLength={1000} />
                    </div>
                    <Label className="flex items-center gap-2">
                      <Checkbox name="isPrimary" /> Relacionamento principal
                    </Label>
                    <div className="flex justify-end">
                      <Button>Adicionar relacionamento</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-2">
              {registration.relationships.length ? (
                registration.relationships.map((relationship) => (
                  <Card key={relationship.id} size="sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">
                            <Link
                              className="text-primary hover:underline"
                              href={`/registrations/${relationship.relatedRegistration.id}`}
                            >
                              {relationship.relatedRegistration.displayName}
                            </Link>
                          </CardTitle>
                          <CardDescription>{relationship.type}</CardDescription>
                        </div>
                        {relationship.direction === 'outgoing' ? (
                          <ArrowUpRight aria-label="Relacionamento de saída" className="size-4" />
                        ) : (
                          <ArrowDownLeft
                            aria-label="Relacionamento de entrada"
                            className="size-4"
                          />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {relationship.jobTitle || relationship.department ? (
                        <p className="text-sm">
                          {[relationship.jobTitle, relationship.department]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                      {relationship.notes ? (
                        <p className="text-sm text-muted-foreground">{relationship.notes}</p>
                      ) : null}
                      {canUpdate && relationship.direction === 'outgoing' ? (
                        <div className="space-y-3">
                          <details className="rounded-lg border p-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              Editar relacionamento
                            </summary>
                            <form
                              action={updateRegistrationRelationshipAction}
                              className="mt-3 grid gap-3 sm:grid-cols-2"
                            >
                              <input type="hidden" name="registrationId" value={registration.id} />
                              <input type="hidden" name="relationshipId" value={relationship.id} />
                              <input
                                type="hidden"
                                name="targetRegistrationId"
                                value={relationship.relatedRegistration.id}
                              />
                              <input
                                type="hidden"
                                name="expectedVersion"
                                value={relationship.version}
                              />
                              <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor={`relationship-type-${relationship.id}`}>
                                  Tipo de relacionamento
                                </Label>
                                <Input
                                  id={`relationship-type-${relationship.id}`}
                                  name="relationshipType"
                                  defaultValue={relationship.type}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`relationship-job-${relationship.id}`}>
                                  Cargo ou função
                                </Label>
                                <Input
                                  id={`relationship-job-${relationship.id}`}
                                  name="jobTitle"
                                  defaultValue={relationship.jobTitle ?? ''}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`relationship-department-${relationship.id}`}>
                                  Departamento
                                </Label>
                                <Input
                                  id={`relationship-department-${relationship.id}`}
                                  name="department"
                                  defaultValue={relationship.department ?? ''}
                                />
                              </div>
                              <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor={`relationship-notes-${relationship.id}`}>
                                  Observações
                                </Label>
                                <Textarea
                                  id={`relationship-notes-${relationship.id}`}
                                  name="notes"
                                  defaultValue={relationship.notes ?? ''}
                                  maxLength={1000}
                                />
                              </div>
                              <Label className="flex items-center gap-2">
                                <Checkbox
                                  name="isPrimary"
                                  defaultChecked={relationship.isPrimary}
                                />{' '}
                                Relacionamento principal
                              </Label>
                              <div className="flex justify-end">
                                <Button type="submit" size="sm">
                                  Salvar relacionamento
                                </Button>
                              </div>
                            </form>
                          </details>
                          <form
                            id={`remove-relationship-${relationship.id}`}
                            action={removeRegistrationRelationshipAction}
                          >
                            <input type="hidden" name="registrationId" value={registration.id} />
                            <input type="hidden" name="relationshipId" value={relationship.id} />
                            <input
                              type="hidden"
                              name="expectedVersion"
                              value={relationship.version}
                            />
                            <RemoveRelationshipButton
                              formId={`remove-relationship-${relationship.id}`}
                              relatedName={relationship.relatedRegistration.displayName}
                            />
                          </form>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card size="sm" className="lg:col-span-2">
                  <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <Building2 aria-hidden="true" className="size-6" />
                    Nenhum relacionamento cadastrado.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {canHistory ? (
            <TabsContent value="history" className="space-y-3">
              {history.length ? (
                history.map((entry) => (
                  <Card key={entry.id} size="sm">
                    <CardHeader className="py-4">
                      <CardTitle className="text-base">
                        {historyLabels[entry.action] || 'Alteração no Cadastro'}
                      </CardTitle>
                      <CardDescription>
                        {new Date(entry.createdAt).toLocaleString('pt-BR')} ·{' '}
                        {entry.actorName || 'Sistema'}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))
              ) : (
                <Card size="sm">
                  <CardContent className="p-6 text-muted-foreground">
                    Nenhuma alteração registrada.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ) : null}
        </Tabs>
      </main>
    </AuthenticatedShell>
  );
}
