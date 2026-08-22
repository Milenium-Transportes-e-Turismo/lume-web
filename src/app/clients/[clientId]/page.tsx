import Link from 'next/link';

import { hasPermission } from '@/features/auth/domain';
import {
  addClientCommentAction,
  changeClientStatusAction,
  removeClientCommentAction,
  updateClientCommentAction,
} from '@/features/clients/actions/client-actions';
import {
  clientDisplayName,
  formatClientDocument,
  formatClientPhone,
} from '@/features/clients/components/client-format';
import { AuthenticatedShell } from '@/features/navigation';
import { executeAuthenticatedRoutingRequest } from '@/features/routing/server';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{value || 'Não informado'}</dd>
    </div>
  );
}

const historyLabels: Record<string, string> = {
  ROUTING_COMPANY_CREATED: 'Cliente cadastrado',
  ROUTING_COMPANY_UPDATED: 'Dados cadastrais atualizados',
  ROUTING_COMPANY_STATUS_CHANGED: 'Situação alterada',
  CLIENT_PROFILE_COMMENT_CREATED: 'Comentário incluído',
  CLIENT_PROFILE_COMMENT_UPDATED: 'Comentário atualizado',
  CLIENT_PROFILE_COMMENT_REMOVED: 'Comentário removido',
};

export default async function ClientPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ clientId: string }>;
  readonly searchParams: Promise<{ error?: string; success?: string; tab?: string }>;
}) {
  const session = await requireTenantSession([
    'clients:view',
    'clients:update',
    'clients:manage',
    'clients:history',
  ]);
  const [{ clientId }, search] = await Promise.all([params, searchParams]);
  const canUpdate =
    hasPermission(session.user, 'clients:update') || hasPermission(session.user, 'clients:manage');
  const canHistory = hasPermission(session.user, 'clients:history');
  const [client, comments, history] = await Promise.all([
    executeAuthenticatedRoutingRequest((gateway) => gateway.getCompany(clientId)),
    executeAuthenticatedRoutingRequest((gateway) => gateway.listCompanyComments(clientId)),
    canHistory
      ? executeAuthenticatedRoutingRequest((gateway) => gateway.listCompanyHistory(clientId))
      : Promise.resolve([]),
  ]);
  const name = clientDisplayName(client);
  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
        <PageFeedbackToast error={search.error} success={search.success} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Clientes</p>
            <h1 className="text-3xl font-semibold">{name}</h1>
            <p className="text-muted-foreground">
              {client.clientType === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'} ·{' '}
              {client.status === 'active' ? 'Ativo' : 'Inativo'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/clients" />}>
              Voltar
            </Button>
            {canUpdate ? (
              <Button render={<Link href={`/clients/${client.id}/edit`} />}>Editar cadastro</Button>
            ) : null}
          </div>
        </header>
        <Tabs
          defaultValue={
            search.tab === 'profile' || search.tab === 'history' ? search.tab : 'registered'
          }
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="registered">Dados cadastrais</TabsTrigger>
            <TabsTrigger value="profile">Perfil do cliente</TabsTrigger>
            {canHistory ? <TabsTrigger value="history">Histórico</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="registered" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Identificação</CardTitle>
                <CardDescription>
                  Informações compartilhadas pelos módulos autorizados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Nome" value={name} />
                  <Field
                    label="Razão social"
                    value={client.clientType === 'pj' ? client.legalName : null}
                  />
                  <Field label="Nome fantasia" value={client.tradeName} />
                  <Field
                    label={client.clientType === 'pf' ? 'CPF' : 'CNPJ'}
                    value={formatClientDocument(
                      client.clientType === 'pf' ? client.cpf : client.cnpj,
                    )}
                  />
                  <Field label="Código AVIC" value={client.avicExternalId} />
                  <Field
                    label="Situação"
                    value={client.status === 'active' ? 'Ativo' : 'Inativo'}
                  />
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Contato</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="E-mail"
                    value={client.clientType === 'pf' ? client.individualEmail : client.legalEmail}
                  />
                  <Field
                    label="WhatsApp"
                    value={formatClientPhone(
                      client.clientType === 'pf' ? client.individualWhatsapp : client.legalWhatsapp,
                    )}
                  />
                </dl>
                <div className="mt-5 space-y-2">
                  <p className="text-sm font-medium">Telefones adicionais</p>
                  {(client.clientType === 'pf' ? client.individualPhones : client.legalPhones)
                    .length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum telefone adicional.</p>
                  ) : (
                    (client.clientType === 'pf' ? client.individualPhones : client.legalPhones).map(
                      (phone, index) => (
                        <p className="text-sm" key={`${phone.number}-${index}`}>
                          {formatClientPhone(phone.number)}
                          {phone.description ? ` · ${phone.description}` : ''}
                        </p>
                      ),
                    )
                  )}
                </div>
              </CardContent>
            </Card>
            {canUpdate ? (
              <Card>
                <CardHeader>
                  <CardTitle>Situação do cadastro</CardTitle>
                  <CardDescription>
                    Clientes não são excluídos permanentemente; desative o cadastro para preservar o
                    histórico.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={changeClientStatusAction}>
                    <input type="hidden" name="clientId" value={client.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={client.status === 'active' ? 'inactive' : 'active'}
                    />
                    <Button variant={client.status === 'active' ? 'destructive' : 'default'}>
                      {client.status === 'active' ? 'Desativar cliente' : 'Reativar cliente'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
          <TabsContent value="profile" className="space-y-5">
            {canUpdate ? (
              <Card>
                <CardHeader>
                  <CardTitle>Novo comentário</CardTitle>
                  <CardDescription>
                    Registre informações úteis aos departamentos autorizados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={addClientCommentAction} className="space-y-3">
                    <input type="hidden" name="clientId" value={client.id} />
                    <Label htmlFor="comment">Comentário</Label>
                    <Textarea id="comment" name="comment" required maxLength={4000} />
                    <Button>Registrar comentário</Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-muted-foreground">
                    Nenhum comentário registrado.
                  </CardContent>
                </Card>
              ) : (
                comments.map((comment) => (
                  <Card key={comment.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{comment.authorName}</CardTitle>
                      <CardDescription>
                        {new Date(comment.createdAt).toLocaleString('pt-BR')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="whitespace-pre-wrap">{comment.comment}</p>
                      {canUpdate ? (
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-primary">
                            Editar comentário
                          </summary>
                          <div className="mt-3 grid gap-3">
                            <form action={updateClientCommentAction} className="space-y-3">
                              <input type="hidden" name="clientId" value={client.id} />
                              <input type="hidden" name="commentId" value={comment.id} />
                              <Textarea name="comment" required defaultValue={comment.comment} />
                              <Button size="sm">Salvar comentário</Button>
                            </form>
                            <form action={removeClientCommentAction}>
                              <input type="hidden" name="clientId" value={client.id} />
                              <input type="hidden" name="commentId" value={comment.id} />
                              <Button size="sm" variant="destructive">
                                Remover comentário
                              </Button>
                            </form>
                          </div>
                        </details>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          {canHistory ? (
            <TabsContent value="history" className="space-y-4">
              {history.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-muted-foreground">
                    Nenhuma alteração registrada.
                  </CardContent>
                </Card>
              ) : (
                history.map((entry) => (
                  <Card key={entry.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {historyLabels[entry.action] || 'Alteração no cadastro'}
                      </CardTitle>
                      <CardDescription>
                        {new Date(entry.createdAt).toLocaleString('pt-BR')} ·{' '}
                        {entry.actorName || 'Sistema'}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))
              )}
            </TabsContent>
          ) : null}
        </Tabs>
      </main>
    </AuthenticatedShell>
  );
}
