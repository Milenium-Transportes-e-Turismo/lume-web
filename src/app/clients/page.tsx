import Link from 'next/link';

import { hasPermission } from '@/features/auth/domain';
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
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

type Search = {
  page?: string;
  search?: string;
  status?: string;
  type?: string;
  sort?: string;
  error?: string;
  success?: string;
};

function query(search: Search, next: Partial<Search>) {
  const value = new URLSearchParams();
  Object.entries({ ...search, ...next }).forEach(([key, item]) => {
    if (item && key !== 'error' && key !== 'success') value.set(key, item);
  });
  return `/clients?${value.toString()}`;
}

export default async function ClientsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Search>;
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
  const result = hasPermission(session.user, 'clients:view')
    ? await executeAuthenticatedRoutingRequest((gateway) =>
        gateway.listCompanies({
          page,
          pageSize,
          search: search.search,
          status: search.status,
          clientType: search.type,
          sort: search.sort,
        }),
      )
    : { items: [], total: 0 };
  const pages = Math.max(1, Math.ceil(result.total / pageSize));
  return (
    <AuthenticatedShell user={session.user}>
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
        <PageFeedbackToast error={search.error} success={search.success} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Cadastro corporativo</p>
            <h1 className="text-3xl font-semibold">Clientes</h1>
            <p className="text-muted-foreground">
              Cadastro reutilizado pelos departamentos autorizados.
            </p>
          </div>
          {hasPermission(session.user, 'clients:create') ? (
            <Button render={<Link href="/clients/new" />}>Novo cliente</Button>
          ) : null}
        </header>
        <Card>
          <CardContent className="p-4">
            <form className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem_12rem_auto]">
              <Input
                name="search"
                defaultValue={search.search}
                placeholder="Nome, documento, telefone ou Código AVIC"
              />
              <select
                name="status"
                defaultValue={search.status}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Todas as situações</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
              <select
                name="type"
                defaultValue={search.type}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Todos os tipos</option>
                <option value="pf">Pessoa física</option>
                <option value="pj">Pessoa jurídica</option>
              </select>
              <select
                name="sort"
                defaultValue={search.sort}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="name">Ordenar por nome</option>
                <option value="status">Ordenar por situação</option>
                <option value="avic">Ordenar por Código AVIC</option>
              </select>
              <Button type="submit" variant="outline">
                Pesquisar
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Código AVIC</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/clients/${client.id}`}
                      >
                        {clientDisplayName(client)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatClientDocument(client.clientType === 'pf' ? client.cpf : client.cnpj)}
                    </TableCell>
                    <TableCell>
                      {formatClientPhone(
                        client.clientType === 'pf'
                          ? client.individualWhatsapp
                          : client.legalWhatsapp,
                      )}
                    </TableCell>
                    <TableCell>{client.avicExternalId || 'Não informado'}</TableCell>
                    <TableCell>
                      {client.clientType === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}
                    </TableCell>
                    <TableCell>{client.status === 'active' ? 'Ativo' : 'Inativo'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {result.items.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado.</p>
            ) : null}
          </CardContent>
        </Card>
        <nav className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {pages} · {result.total} registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              render={
                page > 1 ? <Link href={query(search, { page: String(page - 1) })} /> : undefined
              }
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={page >= pages}
              render={
                page < pages ? <Link href={query(search, { page: String(page + 1) })} /> : undefined
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
