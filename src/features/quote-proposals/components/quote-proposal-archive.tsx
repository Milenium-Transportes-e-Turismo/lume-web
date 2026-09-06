'use client';

import { Search, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/form-select';

import {
  filterQuoteProposalsByCategory,
  type PendingQuoteProposal,
  type QuoteProposalCategory,
} from '../domain';
import { ProposalHistory } from './proposal-history';

type ArchiveCategory = Exclude<QuoteProposalCategory, 'pending'>;
type PeriodFilter = 'all' | '7' | '30' | '90';

const periodLabels: Record<PeriodFilter, string> = {
  all: 'Todo o período',
  '7': 'Últimos 7 dias',
  '30': 'Últimos 30 dias',
  '90': 'Últimos 90 dias',
};

const categoryContent: Record<
  ArchiveCategory,
  {
    title: string;
    description: string;
    emptyMessage: string;
    itemLabel: { singular: string; plural: string };
  }
> = {
  sent: {
    title: 'Orçamentos enviados',
    description: 'Propostas entregues pelo WhatsApp que aguardam a decisão do cliente.',
    emptyMessage: 'Nenhum orçamento enviado aguardando decisão.',
    itemLabel: { singular: 'enviado', plural: 'enviados' },
  },
  approved: {
    title: 'Orçamentos aprovados',
    description: 'Propostas aprovadas com registro da decisão comercial.',
    emptyMessage: 'Nenhum orçamento aprovado foi encontrado.',
    itemLabel: { singular: 'aprovado', plural: 'aprovados' },
  },
  cancelled: {
    title: 'Orçamentos cancelados',
    description: 'Propostas recusadas ou canceladas, com o motivo registrado no histórico.',
    emptyMessage: 'Nenhum orçamento cancelado foi encontrado.',
    itemLabel: { singular: 'cancelado', plural: 'cancelados' },
  },
};

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function proposalRoute(proposal: PendingQuoteProposal): string {
  return `${proposal.summary.origin?.trim() || 'Origem não informada'} → ${
    proposal.summary.destination?.trim() || 'Destino não informado'
  }`;
}

export interface QuoteProposalArchiveProps {
  readonly category: ArchiveCategory;
  readonly initialProposals: readonly PendingQuoteProposal[];
  readonly initialError?: string | null;
  readonly canManage?: boolean;
  readonly showHeader?: boolean;
}

export function QuoteProposalArchive({
  category,
  initialProposals,
  initialError = null,
  canManage = true,
  showHeader = true,
}: QuoteProposalArchiveProps) {
  const [proposals, setProposals] = React.useState(initialProposals);
  const [search, setSearch] = React.useState('');
  const [route, setRoute] = React.useState('all');
  const [period, setPeriod] = React.useState<PeriodFilter>('all');
  const [feedback, setFeedback] = React.useState<string | null>(initialError);
  const [filterReferenceTime] = React.useState(() => Date.now());
  const content = categoryContent[category];
  const categorized = React.useMemo(
    () => filterQuoteProposalsByCategory(proposals, category),
    [category, proposals],
  );
  const routes = React.useMemo(
    () =>
      [...new Set(categorized.map(proposalRoute))].sort((left, right) =>
        left.localeCompare(right, 'pt-BR'),
      ),
    [categorized],
  );
  const filtered = React.useMemo(() => {
    const query = normalizeSearch(search);
    const cutoff =
      period === 'all' ? null : filterReferenceTime - Number(period) * 24 * 60 * 60 * 1_000;

    return categorized.filter((proposal) => {
      if (route !== 'all' && proposalRoute(proposal) !== route) return false;
      if (cutoff !== null && new Date(proposal.updatedAt).valueOf() < cutoff) return false;
      if (!query) return true;

      return normalizeSearch(
        [
          proposal.contact.name,
          proposal.contact.phone,
          proposal.summary.sequence,
          proposal.summary.origin,
          proposal.summary.destination,
          proposal.proposalDocument?.fileName,
          proposal.decision.reason,
        ]
          .filter(Boolean)
          .join(' '),
      ).includes(query);
    });
  }, [categorized, filterReferenceTime, period, route, search]);
  const hasFilters = search.trim() !== '' || route !== 'all' || period !== 'all';

  function clearFilters() {
    setSearch('');
    setRoute('all');
    setPeriod('all');
  }

  function registerCreated(proposal: PendingQuoteProposal) {
    setProposals((current) => [
      proposal,
      ...current.filter((candidate) => candidate.quoteRequestId !== proposal.quoteRequestId),
    ]);
    setFeedback('Nova solicitação cadastrada e direcionada para Orçamentos pendentes.');
    window.dispatchEvent(new CustomEvent('quote-proposals:count'));
  }

  function registerDecision(proposal: PendingQuoteProposal) {
    setProposals((current) =>
      current.map((candidate) =>
        candidate.quoteRequestId === proposal.quoteRequestId ? proposal : candidate,
      ),
    );
    setFeedback(
      proposal.decision.status === 'approved'
        ? 'Orçamento aprovado e movido para Aprovados.'
        : 'Orçamento cancelado e motivo registrado.',
    );
  }

  return (
    <section className="space-y-4">
      {showHeader ? (
        <header>
          <p className="text-sm font-semibold text-primary-emphasis">Comercial · Orçamentos</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{content.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{content.description}</p>
        </header>
      ) : null}

      {feedback ? (
        <div
          role={initialError && feedback === initialError ? 'alert' : 'status'}
          className={
            initialError && feedback === initialError
              ? 'rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-emphasis'
              : 'rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-emphasis'
          }
        >
          {feedback}
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid min-w-0 items-center gap-3 md:grid-cols-[minmax(15rem,1.5fr)_minmax(12rem,1fr)_minmax(10rem,0.65fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Pesquisar orçamentos</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, telefone, rota, arquivo ou motivo"
              className="h-9 pl-9"
            />
          </label>
          <Select value={route} onValueChange={(value) => setRoute(value ?? 'all')}>
            <SelectTrigger className="h-9 w-full min-w-0" aria-label="Filtrar por rota">
              <SelectValue>{route === 'all' ? 'Todas as rotas' : route}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as rotas</SelectItem>
              {routes.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={(value) => setPeriod((value as PeriodFilter | null) ?? 'all')}
          >
            <SelectTrigger className="h-9 w-full min-w-0" aria-label="Filtrar por período">
              <SelectValue>{periodLabels[period]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-9 w-full md:w-auto"
            disabled={!hasFilters}
            onClick={clearFilters}
          >
            <X aria-hidden="true" />
            Limpar
          </Button>
        </div>

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtros ativos">
            {search.trim() ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-emphasis">
                Pesquisa: {search.trim()}
              </span>
            ) : null}
            {route !== 'all' ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-emphasis">
                Rota: {route}
              </span>
            ) : null}
            {period !== 'all' ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-emphasis">
                Últimos {period} dias
              </span>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} de {categorized.length}
            </span>
          </div>
        ) : null}
      </div>

      <ProposalHistory
        proposals={filtered}
        total={filtered.length}
        title={content.title}
        description={content.description}
        emptyMessage={
          hasFilters
            ? 'Nenhum orçamento corresponde aos filtros selecionados.'
            : content.emptyMessage
        }
        itemLabel={content.itemLabel}
        showDecisionActions={canManage && category === 'sent'}
        showCreateAction={false}
        onCreated={registerCreated}
        onDecided={registerDecision}
        onError={setFeedback}
      />
    </section>
  );
}
