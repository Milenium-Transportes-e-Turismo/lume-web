import Link from 'next/link';
import type { AuditOperationList } from '../domain/api-usage';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui/card';
export function AuditOperations({
  operations,
  query,
}: {
  readonly operations: AuditOperationList;
  readonly query: { from?: string; to?: string; userId?: string };
}) {
  function pageUrl(page: number) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) search.set(key, value);
    search.set('operationPage', String(page));
    return '/administration?' + search;
  }
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Ações administrativas</CardTitle>
        <CardDescription>
          Quem realizou a ação, qual registro foi afetado e quais dados mudaram. Eventos do mesmo
          comando aparecem juntos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!operations.data.length && (
          <p className="text-sm text-muted-foreground">Nenhuma ação registrada neste período.</p>
        )}
        {operations.data.map((operation) => (
          <details key={operation.id + operation.actorId} className="rounded-lg border p-3">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{operation.action}</strong>
                <time className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date(operation.createdAt))}
                </time>
              </div>
              <p className="mt-1 text-sm">
                {operation.actor} · {operation.module} · {operation.target}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {operation.changes.length
                  ? 'Alterações: ' + operation.changes.join(', ')
                  : operation.result}{' '}
                · {operation.events.length} evento(s) · Abrir detalhes
              </p>
            </summary>
            <dl className="mt-3 grid gap-2 border-t pt-3 text-sm">
              <div>
                <dt className="font-medium">Registro afetado</dt>
                <dd className="break-all">
                  {operation.target} ({operation.targetId})
                </dd>
              </div>
              <div>
                <dt className="font-medium">Identificador da operação</dt>
                <dd className="break-all">{operation.id}</dd>
              </div>
            </dl>
            <ul className="mt-3 space-y-2">
              {operation.events.map((event) => (
                <li key={event.source + event.id} className="rounded bg-muted/50 p-2 text-xs">
                  <p className="break-all font-mono">{event.code}</p>
                  <p className="break-all">
                    Evento: {event.id} · Registro: {event.targetId} · Fonte: {event.source}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ))}
        <nav
          aria-label="Páginas das ações administrativas"
          className="flex items-center justify-between text-sm"
        >
          <span>{operations.meta.total} operações</span>
          <div className="flex gap-4">
            {operations.meta.page > 1 && (
              <Link href={pageUrl(operations.meta.page - 1)}>Anterior</Link>
            )}
            {operations.meta.page < operations.meta.totalPages && (
              <Link href={pageUrl(operations.meta.page + 1)}>Próxima</Link>
            )}
          </div>
        </nav>
      </CardContent>
    </Card>
  );
}
