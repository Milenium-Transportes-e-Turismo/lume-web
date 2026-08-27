import { Activity, Clock3, Database, TriangleAlert, UsersRound } from 'lucide-react';
import Link from 'next/link';

import type {
  ApiUsageRequestList,
  ApiUsageResultFilter,
  ApiUsageSummary,
  TenantUserList,
} from '../domain';
import { DynamicFilterForm } from '@/shared/dynamic-filter-form';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export interface ApiUsageDashboardFilters {
  readonly from?: string;
  readonly to?: string;
  readonly userId?: string;
  readonly status?: ApiUsageResultFilter;
  readonly page: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function resultTone(statusCode: number): string {
  if (statusCode >= 500) return 'bg-destructive/10 text-destructive-emphasis';
  if (statusCode >= 400) return 'bg-warning/15 text-warning-emphasis';
  return 'bg-success/10 text-success-emphasis';
}

function queryString(filters: ApiUsageDashboardFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.userId) query.set('userId', filters.userId);
  if (filters.status) query.set('status', filters.status);
  query.set('page', String(page));
  return query.toString();
}

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

export function paginationItems(
  currentPage: number,
  totalPages: number,
): readonly PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = [...new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const result: PaginationItem[] = [];

  for (const page of visiblePages) {
    const previous = result.at(-1);
    if (typeof previous === 'number' && page - previous > 1) {
      result.push(previous === 1 ? 'ellipsis-start' : 'ellipsis-end');
    }
    result.push(page);
  }

  return result;
}

export function ApiUsageDashboard({
  summary,
  requests,
  users,
  filters,
}: {
  readonly summary: ApiUsageSummary;
  readonly requests: ApiUsageRequestList;
  readonly users: TenantUserList;
  readonly filters: ApiUsageDashboardFilters;
}) {
  const totalBytes = summary.totals.requestBytes + summary.totals.responseBytes;
  const maxDailyRequests = Math.max(1, ...summary.daily.map((item) => item.requests));
  const metrics = [
    {
      label: 'Requisições',
      value: summary.totals.requests.toLocaleString('pt-BR'),
      icon: Activity,
    },
    {
      label: 'Usuários ativos',
      value: summary.totals.activeUsers.toLocaleString('pt-BR'),
      icon: UsersRound,
    },
    { label: 'Dados transferidos', value: formatBytes(totalBytes), icon: Database },
    { label: 'Tempo médio', value: `${summary.totals.averageDurationMs} ms`, icon: Clock3 },
    {
      label: 'Não concluídas',
      value: summary.totals.errors.toLocaleString('pt-BR'),
      icon: TriangleAlert,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-sm font-medium text-primary-emphasis">Administração da plataforma</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Uso e desempenho
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Acompanhe volume, transferência e tempo das ações realizadas na Lume. Conteúdo de
          documentos, mensagens e senhas não faz parte destas métricas.
        </p>
      </header>

      <DynamicFilterForm
        key={JSON.stringify(filters)}
        className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="grid gap-1 text-sm font-medium">
          Data inicial
          <Input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Data final
          <Input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Usuário
          <select
            name="userId"
            defaultValue={filters.userId ?? ''}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos os usuários</option>
            {users.data.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Resultado
          <select
            name="status"
            defaultValue={filters.status ?? ''}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos os resultados</option>
            <option value="success">Concluídas</option>
            <option value="client-error">Não concluídas</option>
            <option value="server-error">Falhas do serviço</option>
          </select>
        </label>
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs text-muted-foreground">Aplicação automática</span>
          <Button render={<Link href="/administration" />} variant="outline" size="sm">
            Limpar
          </Button>
        </div>
      </DynamicFilterForm>

      <section aria-label="Resumo do uso" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.label} size="sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardDescription>{metric.label}</CardDescription>
              <metric.icon className="size-4 text-primary-emphasis" aria-hidden="true" />
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {metric.value}
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Movimento diário</CardTitle>
            <CardDescription>Quantidade de ações registradas por dia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.daily.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ação no período.</p>
            ) : (
              summary.daily.map((day) => (
                <div
                  key={day.day}
                  className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm"
                >
                  <span>{new Date(`${day.day}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-primary/15">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, (day.requests / maxDailyRequests) * 100)}%` }}
                    />
                  </span>
                  <span className="tabular-nums">{day.requests}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Ações mais realizadas</CardTitle>
            <CardDescription>Nomes humanizados; nenhuma rota técnica é exibida.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.actions.map((action) => (
              <div
                key={action.action}
                className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{action.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(action.bytes)} · média de {action.averageDurationMs} ms
                  </p>
                </div>
                <span className="tabular-nums">{action.requests}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Uso por usuário</CardTitle>
          <CardDescription>Maiores volumes no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.users.map((user) => (
            <div key={user.id} className="rounded-lg border p-3">
              <p className="truncate font-medium">{user.name}</p>
              {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
              <p className="mt-2 text-sm">
                <strong>{user.requests}</strong> ações · {formatBytes(user.bytes)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
          <CardDescription>{requests.meta.total} registros encontrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Dados</TableHead>
                  <TableHead>Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.data.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{request.user.name}</p>
                      {request.user.email && (
                        <p className="text-xs text-muted-foreground">{request.user.email}</p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">{request.action}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${resultTone(request.statusCode)}`}
                      >
                        {request.result}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatBytes(request.requestBytes + request.responseBytes)}
                    </TableCell>
                    <TableCell>{request.durationMs} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 md:hidden">
            {requests.data.map((request) => (
              <article key={request.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{request.action}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${resultTone(request.statusCode)}`}
                  >
                    {request.result}
                  </span>
                </div>
                <p className="mt-2">{request.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(request.createdAt)} ·{' '}
                  {formatBytes(request.requestBytes + request.responseBytes)} · {request.durationMs}{' '}
                  ms
                </p>
              </article>
            ))}
          </div>
          {requests.meta.totalPages > 1 && (
            <nav
              aria-label="Paginação da atividade"
              className="mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:justify-end"
            >
              <Button
                render={
                  <Link
                    href={`/administration?${queryString(filters, Math.max(1, filters.page - 1))}`}
                  />
                }
                variant="outline"
                disabled={filters.page <= 1}
              >
                Anterior
              </Button>
              <div
                className="flex flex-wrap items-center justify-center gap-1"
                aria-label="Páginas"
              >
                {paginationItems(filters.page, requests.meta.totalPages).map((item) =>
                  typeof item === 'number' ? (
                    <Button
                      key={item}
                      render={
                        <Link
                          href={`/administration?${queryString(filters, item)}`}
                          aria-label={`Ir para a página ${item}`}
                        />
                      }
                      variant={item === filters.page ? 'default' : 'outline'}
                      size="icon-sm"
                      aria-current={item === filters.page ? 'page' : undefined}
                    >
                      {item}
                    </Button>
                  ) : (
                    <span
                      key={item}
                      className="px-1 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  ),
                )}
              </div>
              <Button
                render={
                  <Link
                    href={`/administration?${queryString(filters, Math.min(requests.meta.totalPages, filters.page + 1))}`}
                  />
                }
                variant="outline"
                disabled={filters.page >= requests.meta.totalPages}
              >
                Próxima
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
