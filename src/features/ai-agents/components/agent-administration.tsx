'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Bot,
  Braces,
  FilePenLine,
  History,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

import {
  loadAiAgentExecutionsAction,
  loadAiAgentsAction,
  loadTenantAgentInstructionVersionsAction,
  rollbackTenantAgentInstructionsAction,
  updateTenantAgentInstructionsAction,
} from '../actions';
import {
  getActiveAiAgentRuntime,
  getActiveTenantInstructionVersion,
  type AiAgentExecutionPage,
  type AiAgentTenantInstructionVersion,
  type ManagedAiAgent,
} from '../domain';
import { AgentExecutionPanel } from './agent-execution-panel';

const STATUS_LABELS: Readonly<Record<string, string>> = {
  active: 'Ativo',
  inactive: 'Inativo',
  draft: 'Rascunho',
  archived: 'Arquivado',
};
const CONFIGURATION_LABELS = {
  ready: 'Pronto',
  incomplete: 'Configuração incompleta',
} as const;

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replaceAll('-', ' ').replaceAll('_', ' ');
}

function agentMatches(agent: ManagedAiAgent, search: string): boolean {
  const normalized = search.trim().toLocaleLowerCase('pt-BR');
  if (!normalized) return true;
  return [agent.name, agent.code, agent.description ?? '', agent.type, ...agent.contexts]
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .includes(normalized);
}

export interface AgentAdministrationProps {
  readonly initialAgents: readonly ManagedAiAgent[];
  readonly initialExecutions: AiAgentExecutionPage | null;
  readonly initialError?: string;
  readonly initialExecutionsError?: string;
  readonly canManage: boolean;
}

export function AgentAdministration({
  initialAgents,
  initialExecutions,
  initialError = '',
  initialExecutionsError = '',
  canManage,
}: AgentAdministrationProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [selectedId, setSelectedId] = useState(initialAgents[0]?.id ?? null);
  const [executions, setExecutions] = useState<AiAgentExecutionPage | null>(initialExecutions);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feedback, setFeedback] = useState(initialError);
  const [feedbackCode, setFeedbackCode] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'neutral' | 'error'>(
    initialError ? 'error' : 'neutral',
  );
  const [executionError, setExecutionError] = useState(initialExecutionsError);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [instructionHistoryOpen, setInstructionHistoryOpen] = useState(false);
  const [instructionVersions, setInstructionVersions] = useState<
    readonly AiAgentTenantInstructionVersion[]
  >([]);
  const [instructionHistoryLoaded, setInstructionHistoryLoaded] = useState(false);
  const [instructionHistoryError, setInstructionHistoryError] = useState('');
  const [instructionSearch, setInstructionSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const commandId = useRef<string | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          (statusFilter === 'all' || agent.status === statusFilter) && agentMatches(agent, search),
      ),
    [agents, search, statusFilter],
  );
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;
  const runtime = selected ? getActiveAiAgentRuntime(selected) : null;
  const statuses = [...new Set(agents.map((agent) => agent.status))];
  const filteredInstructionVersions = useMemo(() => {
    const normalized = instructionSearch.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return instructionVersions;
    return instructionVersions.filter((version) =>
      [String(version.version), version.status, version.content, version.contentHash]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(normalized),
    );
  }, [instructionSearch, instructionVersions]);

  function showError(message: string, publicCode = '') {
    setFeedback(message);
    setFeedbackCode(publicCode);
    setFeedbackTone('error');
  }

  function loadExecutions(agentId: string, page = 1) {
    setExecutionError('');
    startTransition(async () => {
      const result = await loadAiAgentExecutionsAction({ agentId, page, limit: 25 });
      if (!result.success) {
        setExecutionError(result.message);
        return;
      }
      setExecutions(result.executions);
    });
  }

  function selectAgent(agentId: string) {
    if (agentId === selectedId) return;
    setSelectedId(agentId);
    setExecutions(null);
    setInstructionsOpen(false);
    setInstructions('');
    setInstructionHistoryOpen(false);
    setInstructionVersions([]);
    setInstructionHistoryLoaded(false);
    setInstructionHistoryError('');
    setInstructionSearch('');
    commandId.current = null;
    loadExecutions(agentId);
    requestAnimationFrame(() =>
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function openInstructionHistory() {
    if (!selected) return;
    const agentId = selected.id;
    setInstructionHistoryOpen(true);
    setInstructionHistoryError('');
    if (instructionHistoryLoaded) return;
    startTransition(async () => {
      const result = await loadTenantAgentInstructionVersionsAction({ agentId });
      if (!result.success) {
        setInstructionHistoryError(result.message);
        return;
      }
      setInstructionVersions(result.versions);
      setInstructionHistoryLoaded(true);
    });
  }

  function reloadInstructionHistory(agentId: string) {
    setInstructionHistoryError('');
    startTransition(async () => {
      const result = await loadTenantAgentInstructionVersionsAction({ agentId });
      if (!result.success) {
        setInstructionHistoryError(result.message);
        return;
      }
      setInstructionVersions(result.versions);
      setInstructionHistoryLoaded(true);
    });
  }

  function rollbackInstructions(version: AiAgentTenantInstructionVersion) {
    if (!selected) return;
    const activeAgent = selected;
    setInstructionHistoryError('');
    startTransition(async () => {
      const result = await rollbackTenantAgentInstructionsAction({
        agentId: activeAgent.id,
        versionId: version.id,
        commandId: globalThis.crypto.randomUUID(),
        expectedVersion: getActiveTenantInstructionVersion(activeAgent),
      });
      if (!result.success) {
        if (result.versions) {
          setInstructionVersions(result.versions);
          setInstructionHistoryLoaded(true);
        }
        if (result.agents) setAgents(result.agents);
        setInstructionHistoryError(result.message);
        return;
      }
      setInstructionVersions(result.versions);
      setInstructionHistoryLoaded(true);
      const refreshed = await loadAiAgentsAction();
      if (refreshed.success) setAgents(refreshed.agents);
      setFeedback(result.message);
      setFeedbackCode('');
      setFeedbackTone('neutral');
    });
  }

  function refresh() {
    setFeedback('');
    setFeedbackCode('');
    setFeedbackTone('neutral');
    startTransition(async () => {
      const result = await loadAiAgentsAction();
      if (!result.success) {
        showError(result.message, result.publicCode);
        return;
      }
      setAgents(result.agents);
      const nextSelectedId = result.agents.some((agent) => agent.id === selectedId)
        ? selectedId
        : (result.agents[0]?.id ?? null);
      setSelectedId(nextSelectedId);
      if (nextSelectedId) loadExecutions(nextSelectedId);
      else setExecutions(null);
    });
  }

  function submitInstructions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const activeAgent = selected;
    commandId.current ??= globalThis.crypto.randomUUID();
    startTransition(async () => {
      const result = await updateTenantAgentInstructionsAction({
        agentId: activeAgent.id,
        commandId: commandId.current,
        expectedVersion: getActiveTenantInstructionVersion(activeAgent),
        content: instructions,
      });
      if (!result.success) {
        if (result.agents) setAgents(result.agents);
        showError(result.message, result.publicCode);
        return;
      }

      const refreshed = await loadAiAgentsAction();
      if (refreshed.success) setAgents(refreshed.agents);
      if (instructionHistoryLoaded) reloadInstructionHistory(activeAgent.id);
      setFeedback(result.message);
      setFeedbackCode('');
      setFeedbackTone('neutral');
      setInstructionsOpen(false);
      setInstructions('');
      commandId.current = null;
    });
  }

  const activeCount = agents.filter((agent) => agent.status === 'active').length;
  const incompleteCount = agents.filter(
    (agent) => agent.configurationStatus === 'incomplete',
  ).length;

  return (
    <section aria-labelledby="agents-title" className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary-emphasis">
            Administração
          </p>
          <h1 id="agents-title" className="text-2xl font-bold tracking-tight">
            Agentes de IA
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Consulte configuração efetiva, versões de instruções e evidências de execução. A
            configuração técnica é somente leitura neste ambiente.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} disabled={isPending}>
          <RefreshCw aria-hidden="true" className={isPending ? 'animate-spin' : ''} /> Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-2" aria-label="Resumo dos agentes">
        {[
          ['Agentes', agents.length],
          ['Ativos', activeCount],
          ['Atenção', incompleteCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card px-3 py-2">
            <small className="text-[10px] font-bold uppercase text-muted-foreground">{label}</small>
            <strong className="mt-0.5 block text-lg">{value}</strong>
          </div>
        ))}
      </div>

      {feedback ? (
        <Alert variant={feedbackTone === 'error' ? 'destructive' : 'default'}>
          {feedbackTone === 'error' ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          <AlertTitle>
            {feedbackTone === 'error' ? 'Operação não concluída' : 'Atualização'}
          </AlertTitle>
          <AlertDescription>
            {feedback}
            {feedbackCode ? ` Código do erro: ${feedbackCode}.` : ''}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-[42rem] overflow-hidden rounded-xl border bg-card xl:grid-cols-[17rem_22rem_minmax(0,1fr)]">
        <aside
          className="flex min-h-0 flex-col border-b xl:border-r xl:border-b-0"
          aria-label="Lista de agentes"
        >
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Label htmlFor="agent-search" className="sr-only">
                Buscar agentes
              </Label>
              <Input
                id="agent-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, código ou contexto"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? 'all')}>
              <SelectTrigger aria-label="Filtrar agentes por status" className="w-full">
                <span>
                  {statusFilter === 'all' ? 'Todos os status' : statusLabel(statusFilter)}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
            {isPending && agents.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-6 animate-spin" /> Carregando
                agentes
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-5 text-center">
                <Bot aria-hidden="true" className="size-8 text-muted-foreground" />
                <strong>Nenhum agente encontrado</strong>
                <p className="text-sm text-muted-foreground">
                  Ajuste a busca ou o filtro de status.
                </p>
              </div>
            ) : (
              filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  aria-controls="agent-details-panel agent-executions-title"
                  aria-pressed={selectedId === agent.id}
                  onClick={() => selectAgent(agent.id)}
                  className="flex w-full items-start gap-3 border-b px-3 py-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-pressed:bg-primary/5 aria-pressed:shadow-[inset_3px_0_0_var(--primary)]"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-emphasis">
                    <Bot aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{agent.name}</strong>
                    <span className="block truncate text-xs text-muted-foreground">
                      {agent.code}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge variant={agent.status === 'active' ? 'default' : 'outline'}>
                        {statusLabel(agent.status)}
                      </Badge>
                      <Badge
                        variant={
                          agent.configurationStatus === 'ready' ? 'secondary' : 'destructive'
                        }
                      >
                        {CONFIGURATION_LABELS[agent.configurationStatus]}
                      </Badge>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div
          ref={detailsRef}
          id="agent-details-panel"
          tabIndex={-1}
          className="min-w-0 border-b xl:border-r xl:border-b-0"
        >
          {selected ? (
            <div className="space-y-4 p-3 sm:p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">{selected.name}</h2>
                  {selected.platformManaged ? (
                    <Badge variant="outline">
                      <ShieldCheck aria-hidden="true" /> Plataforma
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.description ?? 'Sem descrição publicada.'}
                </p>
              </div>

              <dl className="grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {[
                  ['Código', selected.code],
                  ['Tipo', statusLabel(selected.type)],
                  ['Status', statusLabel(selected.status)],
                  ['Exposição', selected.customerFacing ? 'Atende clientes' : 'Uso interno'],
                ].map(([term, value]) => (
                  <div key={term} className="min-w-0 bg-card px-3 py-2">
                    <dt className="text-[10px] font-bold uppercase text-muted-foreground">
                      {term}
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-semibold" title={value}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <section aria-labelledby="effective-runtime-title" className="rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Braces aria-hidden="true" className="size-4 text-primary-emphasis" />
                  <h3 id="effective-runtime-title" className="text-sm font-bold">
                    Runtime efetivo
                  </h3>
                </div>
                {runtime ? (
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Provider</dt>
                      <dd className="font-semibold">
                        {runtime.provider === 'openai' ? 'OpenAI' : runtime.provider}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Modelo</dt>
                      <dd className="truncate font-semibold" title={runtime.model}>
                        {runtime.model}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Versão</dt>
                      <dd className="font-semibold">{runtime.version}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Estado</dt>
                      <dd className="font-semibold">{statusLabel(runtime.status)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum runtime ativo publicado.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Provider e modelo são exibidos para diagnóstico; alterações técnicas não são
                  feitas nesta tela.
                </p>
              </section>

              <section
                aria-labelledby="tenant-instructions-title"
                className="rounded-xl border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 id="tenant-instructions-title" className="text-sm font-bold">
                      Instruções do tenant
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Versão ativa: {getActiveTenantInstructionVersion(selected) || 'nenhuma'}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={openInstructionHistory}
                      >
                        <History aria-hidden="true" /> Histórico
                      </Button>
                      {selected.status === 'active' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setInstructionsOpen(true)}
                        >
                          <FilePenLine aria-hidden="true" /> Nova versão
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  O histórico traz conteúdo com segredos ocultados pela API. Publicar ou restaurar
                  sempre cria uma nova versão imutável e auditável.
                </p>
              </section>

              <section aria-labelledby="agent-contexts-title" className="rounded-xl border p-3">
                <h3 id="agent-contexts-title" className="text-sm font-bold">
                  Contextos habilitados
                </h3>
                {selected.contexts.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.contexts.map((context) => (
                      <Badge key={context} variant="secondary">
                        {statusLabel(context)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum contexto publicado.</p>
                )}
              </section>
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-2 px-6 text-center">
              <Bot aria-hidden="true" className="size-9 text-muted-foreground" />
              <strong>Selecione um agente</strong>
              <p className="text-sm text-muted-foreground">
                A configuração efetiva aparecerá aqui.
              </p>
            </div>
          )}
        </div>

        <AgentExecutionPanel
          executions={executions}
          loading={isPending}
          error={executionError}
          onPageChange={(page) => selected && loadExecutions(selected.id, page)}
        />
      </div>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={submitInstructions} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Publicar instruções para {selected?.name}</DialogTitle>
              <DialogDescription>
                Escreva o conteúdo completo da próxima versão. Consulte o histórico quando precisar
                recuperar uma orientação anterior.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="tenant-agent-instructions">Instruções completas</Label>
              <Textarea
                id="tenant-agent-instructions"
                value={instructions}
                onChange={(event) => {
                  setInstructions(event.target.value);
                  commandId.current = null;
                }}
                rows={12}
                maxLength={20_000}
                required
                disabled={isPending}
                placeholder="Defina tom, limites e orientações específicas deste tenant…"
              />
              <p className="text-right text-xs text-muted-foreground">
                {instructions.length}/20.000
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInstructionsOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !instructions.trim()}>
                {isPending ? 'Publicando…' : 'Publicar nova versão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={instructionHistoryOpen} onOpenChange={setInstructionHistoryOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico de instruções de {selected?.name}</DialogTitle>
            <DialogDescription>
              Conteúdo sensível é ocultado na origem. Restaurar copia a versão escolhida para uma
              nova versão ativa; o histórico anterior permanece intacto.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Label htmlFor="instruction-history-search" className="sr-only">
              Buscar no histórico de instruções
            </Label>
            <Input
              id="instruction-history-search"
              type="search"
              value={instructionSearch}
              onChange={(event) => setInstructionSearch(event.target.value)}
              placeholder="Buscar por versão, status, conteúdo ou hash"
              className="pl-9"
            />
          </div>

          {instructionHistoryError ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>Histórico indisponível</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{instructionHistoryError}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending || !selected}
                  onClick={() => selected && reloadInstructionHistory(selected.id)}
                >
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2" aria-live="polite" aria-busy={isPending}>
            {isPending && !instructionHistoryLoaded ? (
              <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> Carregando
                histórico
              </div>
            ) : instructionHistoryLoaded && filteredInstructionVersions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma versão corresponde à busca.
              </div>
            ) : (
              filteredInstructionVersions.map((version) => {
                const isActive = version.status === 'active';
                return (
                  <article key={version.id} className="rounded-xl border p-3">
                    <header className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm">Versão {version.version}</strong>
                          <Badge variant={isActive ? 'default' : 'outline'}>
                            {statusLabel(version.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Criada em {new Date(version.createdAt).toLocaleString('pt-BR')} · hash{' '}
                          <span className="font-mono">{version.contentHash}</span>
                        </p>
                      </div>
                      {!isActive ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending || !selected || selected.status !== 'active'}
                          onClick={() => rollbackInstructions(version)}
                          aria-label={`Restaurar versão ${version.version} como nova versão`}
                        >
                          <RotateCcw aria-hidden="true" /> Restaurar
                        </Button>
                      ) : null}
                    </header>
                    <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/55 p-3 font-sans text-xs leading-relaxed">
                      {version.content || 'Conteúdo vazio após sanitização.'}
                    </pre>
                  </article>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
