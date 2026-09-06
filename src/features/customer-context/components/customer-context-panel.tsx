'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleUserRound,
  LoaderCircle,
  Search,
  ShieldAlert,
  UserRoundCheck,
  X,
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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/form-select';
import { Textarea } from '@/shared/ui/textarea';

import {
  decideCustomerProfileSuggestionAction,
  loadCustomerContextAction,
  loadCustomerContextDetailsAction,
} from '../actions';
import type {
  CustomerContextDetailPage,
  CustomerContextDetailSection,
  CustomerContextSummary,
  CustomerProfileKey,
  CustomerProfileSuggestion,
  CustomerProfileSuggestionStatus,
} from '../domain';

const PROFILE_LABELS: Readonly<Record<CustomerProfileKey, string>> = {
  'proposal-delivery-preference': 'Entrega de propostas',
  'preferred-contact-channel': 'Canal preferido',
  'accessibility-need': 'Acessibilidade',
  language: 'Idioma',
  'service-preference': 'Preferência de atendimento',
  'communication-style': 'Estilo de comunicação',
  'travel-preference': 'Preferência de viagem',
  'billing-preference': 'Preferência de cobrança',
  'other-confirmed-preference': 'Outra preferência confirmada',
};
const STATUS_LABELS: Readonly<Record<CustomerProfileSuggestionStatus, string>> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  ignored: 'Ignorada',
};
const DETAIL_LABELS: Readonly<Record<CustomerContextDetailSection, string>> = {
  relationships: 'Vínculos',
  profile: 'Perfil',
  services: 'Atendimentos',
  quotes: 'Cotações',
  pending: 'Pendências',
};
const DETAIL_SECTIONS = Object.keys(DETAIL_LABELS) as CustomerContextDetailSection[];

function serialized(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Conteúdo não serializável.';
  }
}

function matchesSuggestion(suggestion: CustomerProfileSuggestion, search: string): boolean {
  const normalized = search.trim().toLocaleLowerCase('pt-BR');
  if (!normalized) return true;
  return [
    PROFILE_LABELS[suggestion.profileKey],
    suggestion.suggestedValue,
    suggestion.rationale ?? '',
    suggestion.status,
  ]
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .includes(normalized);
}

export interface CustomerContextPanelProps {
  readonly serviceSessionId: string;
  readonly nativeSession: boolean;
  readonly canView: boolean;
  readonly canRespond: boolean;
}

export function CustomerContextPanel({
  serviceSessionId,
  nativeSession,
  canView,
  canRespond,
}: CustomerContextPanelProps) {
  const [summary, setSummary] = useState<CustomerContextSummary | null>(null);
  const [suggestions, setSuggestions] = useState<readonly CustomerProfileSuggestion[]>([]);
  const [details, setDetails] = useState<CustomerContextDetailPage | null>(null);
  const [selectedSection, setSelectedSection] = useState<CustomerContextDetailSection>('profile');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerProfileSuggestionStatus | 'all'>('pending');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [ignoreTarget, setIgnoreTarget] = useState<CustomerProfileSuggestion | null>(null);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const commandIds = useRef(new Map<string, string>());

  const filteredSuggestions = useMemo(
    () =>
      suggestions.filter(
        (suggestion) =>
          (status === 'all' || suggestion.status === status) &&
          matchesSuggestion(suggestion, search),
      ),
    [search, status, suggestions],
  );

  function load() {
    setError('');
    setFeedback('');
    startTransition(async () => {
      const result = await loadCustomerContextAction({ serviceSessionId });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setSummary(result.summary);
      setSuggestions(result.suggestions);
    });
  }

  function loadDetails(section: CustomerContextDetailSection) {
    setSelectedSection(section);
    setDetails(null);
    setError('');
    startTransition(async () => {
      const result = await loadCustomerContextDetailsAction({
        serviceSessionId,
        section,
        limit: 20,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setDetails(result.details);
    });
  }

  function decide(
    suggestion: CustomerProfileSuggestion,
    decision: 'approved' | 'ignored',
    reason?: string,
  ) {
    const key = `${suggestion.id}:${decision}`;
    const commandId = commandIds.current.get(key) ?? globalThis.crypto.randomUUID();
    commandIds.current.set(key, commandId);
    setError('');
    setFeedback('');
    startTransition(async () => {
      const result = await decideCustomerProfileSuggestionAction({
        serviceSessionId,
        suggestionId: suggestion.id,
        commandId,
        expectedUpdatedAt: suggestion.updatedAt,
        decision,
        ...(reason ? { reason } : {}),
      });
      if (!result.success) {
        if (result.summary) setSummary(result.summary);
        if (result.suggestions) setSuggestions(result.suggestions);
        if (result.conflict) commandIds.current.delete(key);
        setError(result.message);
        return;
      }
      commandIds.current.delete(key);
      setSummary(result.summary);
      setSuggestions(result.suggestions);
      setFeedback(result.message);
      setIgnoreTarget(null);
      setIgnoreReason('');
    });
  }

  return (
    <section className="border-t border-border px-3 py-3" aria-labelledby="customer-context-title">
      <div className="flex items-center justify-between gap-2">
        <h4
          id="customer-context-title"
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
        >
          <CircleUserRound aria-hidden="true" className="size-3.5" /> Perfil do cliente
        </h4>
        {summary ? (
          <Button type="button" size="xs" variant="ghost" onClick={load} disabled={isPending}>
            Atualizar
          </Button>
        ) : null}
      </div>

      {!nativeSession ? (
        <p className="mt-2 rounded-lg bg-muted/50 p-2 text-[11px] leading-4 text-muted-foreground">
          Contexto de cliente disponível somente para sessões nativas de atendimento.
        </p>
      ) : !canView ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-[11px] leading-4 text-muted-foreground">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Sem permissão
          service:view para consultar este contexto.
        </p>
      ) : !summary ? (
        <div className="mt-2 rounded-lg border border-dashed p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Identidade confirmada, preferências aprovadas e sugestões ficam sob demanda.
          </p>
          <Button type="button" size="sm" className="mt-2" onClick={load} disabled={isPending}>
            {isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <UserRoundCheck aria-hidden="true" />
            )}
            {isPending ? 'Carregando…' : 'Carregar contexto'}
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <div className="rounded-lg border bg-muted/15 p-2.5">
            <small className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Identidade confirmada
            </small>
            <strong className="mt-0.5 block text-xs">
              {summary.identity?.displayName ?? 'Sem cadastro confirmado'}
            </strong>
            {summary.identity ? (
              <span className="text-[10px] text-muted-foreground">
                {summary.identity.kind === 'company' ? 'Pessoa jurídica' : 'Pessoa física'}
              </span>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xs">Preferências aprovadas</strong>
              <Badge variant="secondary">{summary.approvedProfile.length}</Badge>
            </div>
            {summary.approvedProfile.length ? (
              <dl className="mt-1.5 space-y-1">
                {summary.approvedProfile.map((item) => (
                  <div key={item.suggestionId} className="rounded-lg bg-muted/45 px-2 py-1.5">
                    <dt className="text-[9px] font-bold uppercase text-muted-foreground">
                      {PROFILE_LABELS[item.key]}
                    </dt>
                    <dd className="mt-0.5 text-[11px] font-semibold leading-4">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Nenhuma preferência aprovada.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xs">Sugestões de perfil</strong>
              <Badge variant="outline">{suggestions.length}</Badge>
            </div>
            <div className="mt-1.5 grid gap-1.5">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Label
                  htmlFor={`profile-suggestion-search-${serviceSessionId}`}
                  className="sr-only"
                >
                  Buscar sugestões de perfil
                </Label>
                <Input
                  id={`profile-suggestion-search-${serviceSessionId}`}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar sugestão"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus((value as CustomerProfileSuggestionStatus | 'all') ?? 'pending')
                }
              >
                <SelectTrigger
                  aria-label="Filtrar sugestões por status"
                  className="h-8 w-full text-xs"
                >
                  <span>{status === 'all' ? 'Todos os status' : STATUS_LABELS[status]}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {(['pending', 'approved', 'ignored'] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-2 space-y-1.5" aria-live="polite" aria-busy={isPending}>
              {filteredSuggestions.length === 0 ? (
                <p className="rounded-lg border border-dashed p-2 text-center text-[11px] text-muted-foreground">
                  Nenhuma sugestão corresponde aos filtros.
                </p>
              ) : (
                filteredSuggestions.map((suggestion) => (
                  <article key={suggestion.id} className="rounded-lg border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <small className="block truncate text-[9px] font-bold uppercase text-muted-foreground">
                          {PROFILE_LABELS[suggestion.profileKey]}
                        </small>
                        <strong className="mt-0.5 block text-[11px] leading-4">
                          {suggestion.suggestedValue}
                        </strong>
                      </div>
                      <Badge variant={suggestion.status === 'pending' ? 'default' : 'outline'}>
                        {STATUS_LABELS[suggestion.status]}
                      </Badge>
                    </div>
                    {suggestion.rationale ? (
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                        {suggestion.rationale}
                      </p>
                    ) : null}
                    <details className="mt-1.5 text-[10px]">
                      <summary className="cursor-pointer font-semibold text-primary-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Proveniência
                      </summary>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">
                        {serialized(suggestion.origin)}
                      </pre>
                    </details>
                    {suggestion.status === 'pending' && canRespond ? (
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <Button
                          type="button"
                          size="xs"
                          disabled={isPending}
                          onClick={() => decide(suggestion, 'approved')}
                        >
                          <Check aria-hidden="true" /> Aprovar
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => {
                            setIgnoreTarget(suggestion);
                            setIgnoreReason('');
                          }}
                        >
                          <X aria-hidden="true" /> Ignorar
                        </Button>
                      </div>
                    ) : suggestion.status === 'pending' ? (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Decisão exige service:respond.
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>

          <div>
            <strong className="text-xs">Detalhes sob demanda</strong>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {DETAIL_SECTIONS.map((section) => (
                <Button
                  key={section}
                  type="button"
                  size="xs"
                  variant={selectedSection === section && details ? 'secondary' : 'ghost'}
                  className="justify-between"
                  disabled={isPending}
                  onClick={() => loadDetails(section)}
                >
                  {DETAIL_LABELS[section]} <ChevronRight aria-hidden="true" />
                </Button>
              ))}
            </div>
            {details ? (
              <div className="mt-2 rounded-lg border p-2">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[11px]">{DETAIL_LABELS[details.section]}</strong>
                  <span className="text-[9px] text-muted-foreground">
                    {details.items.length} item(ns){details.hasMore ? ' · há mais' : ''}
                  </span>
                </div>
                {details.items.length ? (
                  <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[9px] leading-4">
                    {serialized(details.items)}
                  </pre>
                ) : (
                  <p className="mt-1 text-[10px] text-muted-foreground">Nenhum item nesta seção.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {error ? (
        <Alert variant="destructive" className="mt-2">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Contexto não atualizado</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {feedback ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-success/10 p-2 text-[11px] text-success-emphasis">
          <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> {feedback}
        </p>
      ) : null}

      <Dialog open={ignoreTarget !== null} onOpenChange={(open) => !open && setIgnoreTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ignorar sugestão de perfil</DialogTitle>
            <DialogDescription>
              A decisão fica auditada. Informe por que este dado não deve integrar o perfil.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ignore-profile-suggestion-reason">Motivo</Label>
            <Textarea
              id="ignore-profile-suggestion-reason"
              value={ignoreReason}
              onChange={(event) => {
                setIgnoreReason(event.target.value);
                if (ignoreTarget) commandIds.current.delete(`${ignoreTarget.id}:ignored`);
              }}
              rows={4}
              maxLength={500}
              required
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIgnoreTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !ignoreReason.trim() || !ignoreTarget}
              onClick={() => ignoreTarget && decide(ignoreTarget, 'ignored', ignoreReason.trim())}
            >
              {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              Confirmar decisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
