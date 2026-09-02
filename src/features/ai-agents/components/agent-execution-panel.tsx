'use client';

import {
  AlertCircle,
  BookOpenText,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Wrench,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

import type { AiAgentExecutionPage } from '../domain';

const STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pendente',
  running: 'Em execução',
  completed: 'Concluída',
  succeeded: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  timed_out: 'Tempo esgotado',
  'timed-out': 'Tempo esgotado',
};

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  'service-session': 'Atendimento',
  service_session: 'Atendimento',
  manual: 'Execução manual',
  scheduled: 'Agendamento',
  system: 'Sistema',
};

function label(value: string, labels: Readonly<Record<string, string>>): string {
  return labels[value] ?? value.replaceAll('-', ' ').replaceAll('_', ' ');
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function metric(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${new Intl.NumberFormat('pt-BR').format(value)}${suffix}`;
}

export interface AgentExecutionPanelProps {
  readonly executions: AiAgentExecutionPage | null;
  readonly loading: boolean;
  readonly error: string;
  readonly onPageChange: (page: number) => void;
}

export function AgentExecutionPanel({
  executions,
  loading,
  error,
  onPageChange,
}: AgentExecutionPanelProps) {
  const totalPages = executions ? Math.max(1, Math.ceil(executions.total / executions.limit)) : 1;

  return (
    <section
      aria-labelledby="agent-executions-title"
      aria-busy={loading}
      className="flex min-h-[28rem] min-w-0 flex-col"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b px-3 py-2">
        <div>
          <h2 id="agent-executions-title" className="text-sm font-bold">
            Execuções auditáveis
          </h2>
          <p className="text-xs text-muted-foreground">
            {executions ? `${executions.total} registro(s)` : 'Selecione um agente'}
          </p>
        </div>
        {loading ? (
          <LoaderCircle aria-label="Carregando execuções" className="size-4 animate-spin" />
        ) : null}
      </header>

      {error ? (
        <Alert variant="destructive" className="m-3">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Execuções indisponíveis</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {!executions && !loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-2 px-5 text-center">
            <Bot aria-hidden="true" className="size-9 text-muted-foreground" />
            <strong>Selecione um agente</strong>
            <p className="max-w-sm text-sm text-muted-foreground">
              O histórico, as ferramentas e as fontes consultadas aparecerão aqui.
            </p>
          </div>
        ) : executions?.items.length === 0 && !loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-2 px-5 text-center">
            <Clock3 aria-hidden="true" className="size-9 text-muted-foreground" />
            <strong>Nenhuma execução registrada</strong>
            <p className="text-sm text-muted-foreground">
              Este agente ainda não possui histórico para o tenant.
            </p>
          </div>
        ) : (
          executions?.items.map((execution) => {
            const succeeded = ['completed', 'succeeded'].includes(execution.status);
            return (
              <article key={execution.id} className="rounded-xl border bg-card p-3 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={
                          succeeded
                            ? 'default'
                            : execution.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {succeeded ? <CheckCircle2 aria-hidden="true" /> : null}
                        {label(execution.status, STATUS_LABELS)}
                      </Badge>
                      <Badge variant="outline">{label(execution.source, SOURCE_LABELS)}</Badge>
                    </div>
                    <p
                      className="mt-1.5 truncate text-xs text-muted-foreground"
                      title={execution.id}
                    >
                      {dateTime(execution.startedAt)} · {execution.id}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <strong className="block">
                      {execution.provider === 'openai' ? 'OpenAI' : execution.provider}
                    </strong>
                    <span className="text-muted-foreground">{execution.model}</span>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border text-xs">
                  <div className="bg-card px-2 py-1.5">
                    <dt className="text-[10px] uppercase text-muted-foreground">Latência</dt>
                    <dd className="font-semibold">{metric(execution.latencyMs, ' ms')}</dd>
                  </div>
                  <div className="bg-card px-2 py-1.5">
                    <dt className="text-[10px] uppercase text-muted-foreground">Tokens</dt>
                    <dd className="font-semibold">{metric(execution.totalTokens)}</dd>
                  </div>
                  <div className="bg-card px-2 py-1.5">
                    <dt className="text-[10px] uppercase text-muted-foreground">Tentativas</dt>
                    <dd className="font-semibold">{execution.attempts.length}</dd>
                  </div>
                </dl>

                {execution.errorCode ? (
                  <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                    Falha: {execution.errorCode}
                  </p>
                ) : null}

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <details className="rounded-lg border px-2.5 py-2 text-xs">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold">
                      <Wrench aria-hidden="true" className="size-3.5" />
                      Ferramentas ({execution.toolCalls.length})
                    </summary>
                    {execution.toolCalls.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {execution.toolCalls.map((tool) => (
                          <li key={tool.id} className="flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate" title={tool.toolId}>
                              {tool.toolId}
                            </span>
                            <Badge variant={tool.status === 'failed' ? 'destructive' : 'outline'}>
                              {label(tool.status, STATUS_LABELS)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-muted-foreground">Nenhuma ferramenta acionada.</p>
                    )}
                  </details>

                  <details className="rounded-lg border px-2.5 py-2 text-xs">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold">
                      <BookOpenText aria-hidden="true" className="size-3.5" />
                      Fontes ({execution.knowledgeSources.length})
                    </summary>
                    {execution.knowledgeSources.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {execution.knowledgeSources.map((source) => (
                          <li key={`${source.documentVersionId}:${source.chunkId}`}>
                            <span
                              className="block truncate font-mono"
                              title={source.documentVersionId}
                            >
                              Documento {source.documentVersionId}
                            </span>
                            <span className="text-muted-foreground">
                              versão {source.documentVersionNumber}, trecho {source.chunkOrdinal}
                              {source.pageNumber ? `, página ${source.pageNumber}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        Nenhuma fonte de conhecimento usada.
                      </p>
                    )}
                  </details>
                </div>
              </article>
            );
          })
        )}
      </div>

      {executions && executions.total > executions.limit ? (
        <footer className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
          <span>
            Página {executions.page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Página anterior"
              disabled={loading || executions.page <= 1}
              onClick={() => onPageChange(executions.page - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Próxima página"
              disabled={loading || executions.page >= totalPages}
              onClick={() => onPageChange(executions.page + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
