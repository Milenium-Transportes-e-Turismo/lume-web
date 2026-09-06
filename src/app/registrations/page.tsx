import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactRound, Search, ShieldCheck, Tags } from 'lucide-react';

import { hasPermission } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';
import { executeAuthenticatedRegistrationRequest } from '@/features/registrations/server';
import { requireTenantSession } from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { DynamicFilterForm } from '@/shared/dynamic-filter-form';
import { formatCnpj, formatCpf, formatPhone } from '@/shared/utils/brazilian-data';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import { Input } from '@/shared/ui/input';
import { NativeSelectOption } from '@/shared/ui/native-select';
import { ReadableNativeSelect as NativeSelect } from '@/shared/readable-native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export const metadata: Metadata = {
  title: 'Cadastro | Lume',
  description: 'Identidades, Papéis, Marcadores e contatos da operação.',
};

type SearchParams = {
  page?: string;
  search?: string;
  status?: string;
  type?: string;
  roleCodes?: string;
  tagCodes?: string;
  sort?: string;
  error?: string;
  success?: string;
};

function href(search: SearchParams, next: Partial<SearchParams>) {
  const values = new URLSearchParams();
  Object.entries({ ...search, ...next }).forEach(([key, value]) => {
    if (value && key !== 'error' && key !== 'success') values.set(key, value);
  });
  return `/registrations?${values.toString()}`;
}

function registrationDocument(type: 'pf' | 'pj', cpf: string | null, cnpj: string | null) {
  const value = type === 'pf' ? cpf : cnpj;
  if (!value) return 'Não informado';
  return type === 'pf' ? formatCpf(value) : formatCnpj(value);
}

export default async function RegistrationsPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  const session = await requireTenantSession([
    'clients:view',
    'clients:create',
    'clients:update',
    'clients:manage',
    'clients:history',
  ]);
  const search = await searchParams;
  const page = Math.max(1, Number(search.page) || 1);
  const pageSize = 20;
  const canView = hasPermission(session.user, 'clients:view');
  const [result, catalog] = canView
    ? await Promise.all([
        executeAuthenticatedRegistrationRequest((gateway) =>
          gateway.list({
            page,
            pageSize,
            search: search.search,
            status: search.status,
            type: search.type,
            roleCodes: search.roleCodes,
            tagCodes: search.tagCodes,
            sort: search.sort,
          }),
        ),
        executeAuthenticatedRegistrationRequest((gateway) => gateway.catalog()),
      ])
    : [
        { items: [], total: 0 },
        { roles: [], tags: [] },
      ];
  const pages = Math.max(1, Math.ceil(result.total / pageSize));
  const canReconcile =
    hasPermission(session.user, 'clients:history') || hasPermission(session.user, 'clients:manage');

  return (
    <AuthenticatedShell user={session.user}>
      <main className="lume-page space-y-4">
        <PageFeedbackToast error={search.error} success={search.success} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Identidades da operação</p>
            <h1 className="text-3xl font-semibold tracking-tight">Cadastro</h1>
            <p className="text-muted-foreground">
              Pessoas e empresas em uma base única, com vários Papéis, Marcadores e contatos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canReconcile ? (
              <Button variant="outline" render={<Link href="/registration-reconciliation" />}>
                <ShieldCheck aria-hidden="true" /> Conciliação
              </Button>
            ) : null}
            {hasPermission(session.user, 'clients:create') ? (
              <Button render={<Link href="/registrations/new" />}>
                <ContactRound aria-hidden="true" /> Novo Cadastro
              </Button>
            ) : null}
          </div>
        </header>

        <Card size="sm">
          <CardContent>
            <DynamicFilterForm
              key={JSON.stringify({
                search: search.search,
                status: search.status,
                type: search.type,
                roleCodes: search.roleCodes,
                tagCodes: search.tagCodes,
                sort: search.sort,
              })}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(17rem,1fr)_repeat(5,minmax(12rem,1fr))]"
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
                  placeholder="Nome, documento, telefone, e-mail ou AVIC"
                  aria-label="Pesquisar no Cadastro"
                />
              </div>
              <NativeSelect
                className="w-full"
                name="status"
                defaultValue={search.status}
                aria-label="Filtrar Cadastro por situação"
              >
                <NativeSelectOption value="">Todas as situações</NativeSelectOption>
                <NativeSelectOption value="active">Ativos</NativeSelectOption>
                <NativeSelectOption value="inactive">Inativos</NativeSelectOption>
              </NativeSelect>
              <NativeSelect
                className="w-full"
                name="type"
                defaultValue={search.type}
                aria-label="Filtrar Cadastro por tipo de pessoa"
              >
                <NativeSelectOption value="">PF e PJ</NativeSelectOption>
                <NativeSelectOption value="pf">Pessoa física</NativeSelectOption>
                <NativeSelectOption value="pj">Pessoa jurídica</NativeSelectOption>
              </NativeSelect>
              <NativeSelect
                className="w-full"
                name="roleCodes"
                defaultValue={search.roleCodes}
                aria-label="Filtrar Cadastro por Papel"
              >
                <NativeSelectOption value="">Todos os Papéis</NativeSelectOption>
                {catalog.roles
                  .filter((role) => role.active !== false)
                  .map((role) => (
                    <NativeSelectOption key={role.id} value={role.code}>
                      {role.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
              <NativeSelect
                className="w-full"
                name="tagCodes"
                defaultValue={search.tagCodes}
                aria-label="Filtrar Cadastro por Marcador"
              >
                <NativeSelectOption value="">Todos os Marcadores</NativeSelectOption>
                {catalog.tags
                  .filter((tag) => tag.active !== false)
                  .map((tag) => (
                    <NativeSelectOption key={tag.id} value={tag.code}>
                      {tag.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
              <NativeSelect
                className="w-full"
                name="sort"
                defaultValue={search.sort ?? 'name'}
                aria-label="Ordenar Cadastros"
              >
                <NativeSelectOption value="name">Nome</NativeSelectOption>
                <NativeSelectOption value="updated">Atualização recente</NativeSelectOption>
                <NativeSelectOption value="status">Situação</NativeSelectOption>
              </NativeSelect>
              <p className="flex items-center justify-between gap-3 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3 2xl:col-span-6">
                <span>Os filtros são aplicados automaticamente.</span>
                <Link className="font-medium text-primary hover:underline" href="/registrations">
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
                    <ContactRound aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum Cadastro encontrado</EmptyTitle>
                  <EmptyDescription>
                    Ajuste os filtros ou inclua a primeira identidade da operação.
                  </EmptyDescription>
                </EmptyHeader>
                {hasPermission(session.user, 'clients:create') ? (
                  <EmptyContent>
                    <Button render={<Link href="/registrations/new" />}>Novo Cadastro</Button>
                  </EmptyContent>
                ) : null}
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
                      <TableHead>Identidade</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Papéis</TableHead>
                      <TableHead>Contato principal</TableHead>
                      <TableHead>Marcadores</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((registration) => {
                      const primaryPhone =
                        registration.phones.find((phone) => phone.isPrimary) ??
                        registration.phones[0];
                      return (
                        <TableRow key={registration.id}>
                          <TableCell>
                            <Link
                              className="font-medium text-primary hover:underline"
                              href={`/registrations/${registration.id}`}
                            >
                              {registration.displayName}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {registration.type === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}
                            </p>
                          </TableCell>
                          <TableCell>
                            {registrationDocument(
                              registration.type,
                              registration.cpf,
                              registration.cnpj,
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-72 flex-wrap gap-1">
                              {registration.roles.map((role) => (
                                <Badge key={role.id} variant="secondary">
                                  {role.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {primaryPhone
                              ? formatPhone(primaryPhone.normalizedValue ?? primaryPhone.number)
                              : 'Não informado'}
                            {primaryPhone?.hasWhatsApp ? (
                              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                WhatsApp
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-72 flex-wrap gap-1">
                              {registration.tags.length ? (
                                registration.tags.map((tag) => (
                                  <Badge key={tag.id} variant="outline">
                                    <Tags aria-hidden="true" /> {tag.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground">Sem Marcadores</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={registration.status === 'active' ? 'default' : 'outline'}
                            >
                              {registration.status === 'active' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {result.items.map((registration) => (
                  <article className="space-y-2 p-3" key={registration.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          className="font-semibold text-primary"
                          href={`/registrations/${registration.id}`}
                        >
                          {registration.displayName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {registrationDocument(
                            registration.type,
                            registration.cpf,
                            registration.cnpj,
                          )}
                        </p>
                      </div>
                      <Badge variant={registration.status === 'active' ? 'default' : 'outline'}>
                        {registration.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {registration.roles.map((role) => (
                        <Badge key={role.id} variant="secondary">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Paginação">
          <p className="text-sm text-muted-foreground">
            Página {page} de {pages} · {result.total} registros
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
      </main>
    </AuthenticatedShell>
  );
}
