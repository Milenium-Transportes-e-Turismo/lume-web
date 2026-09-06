'use client';

import {
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FileClock,
  FileText,
  LoaderCircle,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Send,
  Upload,
  Users,
  X,
} from 'lucide-react';
import * as React from 'react';

import { formatCivilDateTime } from '@/shared/lib/civil-date-time';
import { userFacingMessage } from '@/shared/lib/user-facing-message';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { ScrollArea } from '@/shared/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/form-select';
import { toast } from '@/shared/ui/toast';

import { refreshQuoteProposalQueueAction, sendQuoteProposalAction } from '../actions';
import {
  formatQuoteProposalPdfSize,
  formatQuoteProposalServiceType,
  type PendingQuoteProposal,
  type QuoteProposalDocument,
  type QuoteProposalPdfValidationResult,
  validateQuoteProposalPdf,
} from '../domain';
import { ProposalHistory } from './proposal-history';

export interface QuoteProposalWorkspaceProps {
  readonly initialPendingProposals?: readonly PendingQuoteProposal[];
  readonly initialPendingTotal?: number;
  readonly initialSentProposals?: readonly PendingQuoteProposal[];
  readonly initialSentTotal?: number;
  /** @deprecated Compatibilidade temporária com consumidores anteriores à separação de filas. */
  readonly initialProposals?: readonly PendingQuoteProposal[];
  readonly initialError?: string | null;
  readonly showHistory?: boolean;
  readonly canManage?: boolean;
}

interface SubmissionIdentity {
  readonly proposalId: string;
  readonly batchId: string;
  readonly uploadCommandId: string;
  readonly sendCommandId: string;
  readonly batchCommands?: readonly {
    readonly uploadCommandId: string;
    readonly sendCommandId: string;
  }[];
  readonly uploadedDocument?: QuoteProposalDocument;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }

  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }

  return phone;
}

function summaryValue(value: string | number | null): string {
  if (value === null || value === '') return 'Não informado';
  return String(value);
}

function booleanValue(value: boolean | null): string {
  if (value === null) return 'Não informado';
  return value ? 'Sim' : 'Não';
}

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

function SummaryField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function EmptyQueue() {
  return (
    <Card className="border-dashed py-12 text-center">
      <CardContent className="flex flex-col items-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success-emphasis">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Nenhuma proposta aguardando envio</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Novos orçamentos com resumo confirmado aparecerão automaticamente nesta fila.
        </p>
      </CardContent>
    </Card>
  );
}

function QueueSummary({
  total,
  isRefreshing,
  onRefresh,
}: {
  readonly total: number;
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
}) {
  return (
    <div className="max-w-sm">
      <Card className="gap-0 py-0 shadow-sm">
        <CardHeader className="flex grid-cols-none flex-row items-center justify-between gap-3 px-5 pt-5">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning-emphasis">
              <FileClock className="size-4" aria-hidden="true" />
            </span>
            <CardTitle className="truncate text-sm font-semibold text-muted-foreground">
              Aguardando proposta
            </CardTitle>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Atualizar fila de propostas"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw
              className={isRefreshing ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden="true"
            />
          </Button>
        </CardHeader>
        <CardContent className="px-5 pt-3 pb-5">
          <strong className="text-3xl font-bold tracking-tight">{total}</strong>
        </CardContent>
      </Card>
    </div>
  );
}

export function QuoteProposalWorkspace(props: QuoteProposalWorkspaceProps) {
  const initialPendingProposals = props.initialPendingProposals ?? props.initialProposals ?? [];
  const initialSentProposals = props.initialSentProposals ?? [];
  const initialPendingTotal = props.initialPendingTotal ?? initialPendingProposals.length;
  const initialSentTotal = props.initialSentTotal ?? initialSentProposals.length;
  const initialError = props.initialError ?? null;
  const showHistory = props.showHistory ?? true;
  const canManage = props.canManage ?? true;
  const [proposals, setProposals] =
    React.useState<readonly PendingQuoteProposal[]>(initialPendingProposals);
  const [total, setTotal] = React.useState(initialPendingTotal);
  const [sentProposals, setSentProposals] =
    React.useState<readonly PendingQuoteProposal[]>(initialSentProposals);
  const [sentTotal, setSentTotal] = React.useState(initialSentTotal);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialPendingProposals[0]?.quoteRequestId ?? null,
  );
  const [selectedFiles, setSelectedFiles] = React.useState<readonly File[]>([]);
  const [fileValidations, setFileValidations] = React.useState<
    readonly QuoteProposalPdfValidationResult[]
  >([]);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<{
    readonly tone: 'success' | 'error';
    readonly message: string;
  } | null>(initialError ? { tone: 'error', message: initialError } : null);
  const [submissionIdentity, setSubmissionIdentity] = React.useState<SubmissionIdentity | null>(
    null,
  );
  const [search, setSearch] = React.useState('');
  const [route, setRoute] = React.useState('all');
  const validationSequence = React.useRef(0);
  const refreshInFlight = React.useRef(false);

  React.useEffect(() => {
    if (feedback?.tone !== 'error') return;
    toast.add({
      title: 'Operação não concluída',
      description: userFacingMessage(feedback.message, 'Não foi possível atualizar os orçamentos.'),
      type: 'error',
    });
  }, [feedback]);

  const refreshQueue = React.useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);

    try {
      const result = await refreshQuoteProposalQueueAction();
      if (!result.success) return;

      setProposals(result.pendingProposals);
      setTotal(result.pendingTotal);
      setSentProposals(result.sentProposals);
      setSentTotal(result.sentTotal);
      window.dispatchEvent(
        new CustomEvent<number>('quote-proposals:count', {
          detail: result.pendingTotal,
        }),
      );
      setSelectedId((current) =>
        current && result.pendingProposals.some((proposal) => proposal.quoteRequestId === current)
          ? current
          : (result.pendingProposals[0]?.quoteRequestId ?? null),
      );
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshQueue();
    }, 5_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshQueue();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshQueue]);

  const routes = React.useMemo(
    () =>
      [...new Set(proposals.map(proposalRoute))].sort((left, right) =>
        left.localeCompare(right, 'pt-BR'),
      ),
    [proposals],
  );
  const filteredProposals = React.useMemo(() => {
    const query = normalizeSearch(search);
    return proposals.filter((proposal) => {
      if (route !== 'all' && proposalRoute(proposal) !== route) return false;
      if (!query) return true;
      return normalizeSearch(
        [
          proposal.contact.name,
          proposal.contact.phone,
          proposal.summary.sequence,
          proposal.summary.origin,
          proposal.summary.destination,
          proposal.summary.serviceType,
        ]
          .filter(Boolean)
          .join(' '),
      ).includes(query);
    });
  }, [proposals, route, search]);
  const selected =
    filteredProposals.find((proposal) => proposal.quoteRequestId === selectedId) ??
    filteredProposals[0] ??
    null;
  const reusableDocument =
    selectedFiles.length === 0
      ? submissionIdentity !== null && submissionIdentity.proposalId === selected?.quoteRequestId
        ? submissionIdentity.uploadedDocument
        : selected?.proposalDocument?.status === 'uploaded'
          ? selected.proposalDocument
          : undefined
      : undefined;
  const isAlreadyQueued = selected?.proposalDocument?.status === 'queued';
  const selectedFilesAreValid =
    selectedFiles.length > 0 &&
    fileValidations.length === selectedFiles.length &&
    fileValidations.every((validation) => validation.valid);
  const selectedFile = selectedFiles[0] ?? null;
  const fileValidation = fileValidations[0] ?? null;
  const canReviewAndSend =
    canManage && !isAlreadyQueued && (selectedFilesAreValid || reusableDocument !== undefined);

  function selectProposal(proposalId: string) {
    setSelectedId(proposalId);
    setSelectedFiles([]);
    setFileValidations([]);
    setFeedback(null);
    setSubmissionIdentity(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const sequence = validationSequence.current + 1;
    validationSequence.current = sequence;
    setSelectedFiles(files);
    setFileValidations([]);
    setSubmissionIdentity(null);
    setFeedback(null);

    if (files.length === 0) return;
    if (files.length > 5) {
      setFileValidations(
        files.map(() => ({
          valid: false,
          message: 'Selecione no máximo 5 PDFs por envio.',
        })),
      );
      return;
    }

    setIsValidating(true);
    const validations = await Promise.all(files.map(validateQuoteProposalPdf));

    if (validationSequence.current === sequence) {
      setFileValidations(validations);
      setIsValidating(false);
    }
  }

  function submitProposal() {
    if (selected === null || (!reusableDocument && !selectedFilesAreValid)) {
      return;
    }

    const identity =
      submissionIdentity?.proposalId === selected.quoteRequestId
        ? submissionIdentity
        : {
            proposalId: selected.quoteRequestId,
            batchId: crypto.randomUUID(),
            uploadCommandId: crypto.randomUUID(),
            sendCommandId: crypto.randomUUID(),
            ...(selectedFiles.length > 0
              ? {
                  batchCommands: selectedFiles.map(() => ({
                    uploadCommandId: crypto.randomUUID(),
                    sendCommandId: crypto.randomUUID(),
                  })),
                }
              : {}),
            ...(reusableDocument ? { uploadedDocument: reusableDocument } : {}),
          };

    setSubmissionIdentity(identity);
    const formData = new FormData();
    formData.set('quoteRequestId', selected.quoteRequestId);
    formData.set('batchId', identity.batchId);
    formData.set('uploadCommandId', identity.uploadCommandId);
    formData.set('sendCommandId', identity.sendCommandId);
    formData.set('expectedVersion', String(selected.conversationVersion));
    formData.set('confirmed', 'true');
    if (selectedFiles.length > 0) {
      formData.set('batchCommands', JSON.stringify(identity.batchCommands ?? []));
      selectedFiles.forEach((file) => formData.append('files', file));
    } else if (selectedFile) {
      formData.set('file', selectedFile);
    }

    if (identity.uploadedDocument) {
      formData.set('proposalDocumentId', identity.uploadedDocument.id);
      formData.set('uploadedFileName', identity.uploadedDocument.fileName);
      formData.set('uploadedSizeBytes', String(identity.uploadedDocument.sizeBytes));
      formData.set('uploadedSha256', identity.uploadedDocument.sha256);
    }

    startTransition(async () => {
      const result = await sendQuoteProposalAction(formData);
      setIsConfirmationOpen(false);

      if (!result.success) {
        if (result.uploadedDocument) {
          setSubmissionIdentity({
            ...identity,
            uploadedDocument: result.uploadedDocument,
          });
        }

        if (result.uploadedDocument || result.currentVersion) {
          setProposals((current) =>
            current.map((proposal) =>
              proposal.quoteRequestId === selected.quoteRequestId
                ? {
                    ...proposal,
                    ...(result.uploadedDocument
                      ? { proposalDocument: result.uploadedDocument }
                      : {}),
                    ...(result.currentVersion
                      ? { conversationVersion: result.currentVersion }
                      : {}),
                  }
                : proposal,
            ),
          );
        }

        setFeedback({ tone: 'error', message: result.message });
        return;
      }

      setProposals((current) =>
        current.map((proposal) =>
          proposal.quoteRequestId === selected.quoteRequestId
            ? {
                ...proposal,
                conversationVersion: result.proposal.conversationVersion,
                proposalDocument: result.proposal.proposalDocument,
              }
            : proposal,
        ),
      );
      setSelectedFiles([]);
      setFileValidations([]);
      setSubmissionIdentity(null);
      setFeedback({
        tone: 'success',
        message:
          selectedFiles.length > 1
            ? `${selectedFiles.length} PDFs registrados para envio. O atendimento será vinculado ao atendente responsável pelo envio.`
            : 'Proposta registrada para envio. O atendimento será vinculado ao atendente responsável pelo envio.',
      });

      // A entrega é concluída de forma assíncrona pela API. Atualizações
      // rápidas mantêm contadores, abas e listas sincronizados sem exigir F5.
      void refreshQueue();
      for (const delay of [400, 1_200, 2_500]) {
        window.setTimeout(() => void refreshQueue(), delay);
      }
    });
  }

  function registerCreatedProposal(proposal: PendingQuoteProposal) {
    if (proposal.stage !== 'pending') {
      setProposals((current) =>
        current.filter((candidate) => candidate.quoteRequestId !== proposal.quoteRequestId),
      );
      setSentProposals((current) => [
        proposal,
        ...current.filter((candidate) => candidate.quoteRequestId !== proposal.quoteRequestId),
      ]);
      setSentTotal((current) => current + 1);
      setFeedback({
        tone: 'success',
        message: 'Orçamento cadastrado e proposta enviada ao cliente.',
      });
      return;
    }

    const isNewProposal = !proposals.some(
      (candidate) => candidate.quoteRequestId === proposal.quoteRequestId,
    );
    setProposals((current) => [
      proposal,
      ...current.filter((candidate) => candidate.quoteRequestId !== proposal.quoteRequestId),
    ]);
    if (isNewProposal) setTotal((current) => current + 1);
    setSentProposals((current) =>
      current.map((candidate) =>
        candidate.conversationId === proposal.conversationId
          ? {
              ...candidate,
              conversationVersion: proposal.conversationVersion,
            }
          : candidate,
      ),
    );
    setSelectedId(proposal.quoteRequestId);
    setFeedback({
      tone: 'success',
      message: 'Nova solicitação cadastrada. Anexe o PDF e envie a proposta pela fila pendente.',
    });
  }

  function registerProposalDecision(proposal: PendingQuoteProposal) {
    setSentProposals((current) =>
      current.map((candidate) =>
        candidate.quoteRequestId === proposal.quoteRequestId
          ? proposal
          : candidate.conversationId === proposal.conversationId
            ? {
                ...candidate,
                conversationVersion: proposal.conversationVersion,
              }
            : candidate,
      ),
    );
    setFeedback({
      tone: 'success',
      message:
        proposal.decision.status === 'approved'
          ? 'Proposta marcada como aprovada.'
          : 'Proposta marcada como recusada e motivo registrado.',
    });
  }

  function registerProposalError(message: string) {
    setFeedback({ tone: 'error', message });
  }

  if (proposals.length === 0) {
    return (
      <div className="mt-8 space-y-4">
        <QueueSummary
          total={total}
          isRefreshing={isRefreshing}
          onRefresh={() => void refreshQueue()}
        />
        {feedback?.tone === 'success' ? (
          <div
            role="status"
            className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-emphasis"
          >
            {feedback.message}
          </div>
        ) : null}
        {!canManage ? (
          <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Seu acesso é somente para consulta. O envio de PDFs exige permissão de gestão comercial.
          </div>
        ) : null}
        <EmptyQueue />
        {showHistory ? (
          <ProposalHistory
            proposals={sentProposals}
            total={sentTotal}
            onCreated={registerCreatedProposal}
            onDecided={registerProposalDecision}
            onError={registerProposalError}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <QueueSummary
        total={total}
        isRefreshing={isRefreshing}
        onRefresh={() => void refreshQueue()}
      />
      {feedback?.tone === 'success' ? (
        <div
          role="status"
          className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-emphasis"
        >
          {feedback.message}
        </div>
      ) : null}
      {!canManage ? (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Seu acesso é somente para consulta. O envio de PDFs exige permissão de gestão comercial.
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid min-w-0 items-center gap-3 md:grid-cols-[minmax(15rem,1.5fr)_minmax(12rem,1fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Pesquisar orçamentos pendentes</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, telefone, rota ou serviço"
              className="h-9 pl-9"
            />
          </label>
          <Select value={route} onValueChange={(value) => setRoute(value ?? 'all')}>
            <SelectTrigger
              className="h-9 w-full min-w-0"
              aria-label="Filtrar orçamentos pendentes por rota"
            >
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
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-9 w-full md:w-auto"
            disabled={!search.trim() && route === 'all'}
            onClick={() => {
              setSearch('');
              setRoute('all');
            }}
          >
            <X aria-hidden="true" />
            Limpar
          </Button>
        </div>
        {search.trim() || route !== 'all' ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {filteredProposals.length} de {proposals.length} orçamentos correspondem aos filtros.
          </p>
        ) : null}
      </div>

      <div className="grid min-h-[36rem] overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b bg-muted/20 lg:border-r lg:border-b-0">
          <div className="border-b px-5 py-4">
            <p className="text-xs font-semibold tracking-wide text-success-emphasis uppercase">
              Aguardando proposta
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredProposals.length} {filteredProposals.length === 1 ? 'cliente' : 'clientes'}{' '}
              na fila
            </p>
          </div>

          <ScrollArea
            className="h-80 lg:h-[calc(100dvh-18rem)] lg:min-h-80 lg:max-h-[48rem]"
            contentClassName="divide-y"
          >
            {filteredProposals.map((proposal) => {
              const isSelected = proposal.quoteRequestId === selected?.quoteRequestId;

              return (
                <button
                  key={proposal.quoteRequestId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectProposal(proposal.quoteRequestId)}
                  className={`w-full px-5 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected ? 'bg-primary/10' : ''
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {proposal.contact.name}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="size-3" aria-hidden="true" />
                        {formatPhone(proposal.contact.phone)}
                      </span>
                    </span>
                    <span className="rounded-full bg-warning/15 px-2 py-1 text-[0.7rem] font-semibold text-warning-emphasis">
                      #{proposal.summary.sequence}
                    </span>
                  </span>
                  <span className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden="true" />
                    <span className="truncate">
                      {summaryValue(proposal.summary.origin)} →{' '}
                      {summaryValue(proposal.summary.destination)}
                    </span>
                  </span>
                </button>
              );
            })}
            {filteredProposals.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhum orçamento corresponde aos filtros.
              </p>
            ) : null}
          </ScrollArea>
        </aside>

        {selected ? (
          <section className="min-w-0">
            <header className="flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Orçamento #{selected.summary.sequence}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{selected.contact.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatPhone(selected.contact.phone)}
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success-emphasis">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Resumo confirmado
              </span>
            </header>

            <div className="space-y-6 p-5 sm:p-6">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-4 text-success-emphasis" />
                    Resumo do orçamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                    <SummaryField
                      label="Contato"
                      value={summaryValue(selected.summary.contactName)}
                    />
                    <SummaryField
                      label="Documento"
                      value={summaryValue(selected.summary.document)}
                    />
                    <SummaryField label="E-mail" value={summaryValue(selected.summary.email)} />
                    <SummaryField
                      label="Tipo de serviço"
                      value={summaryValue(
                        formatQuoteProposalServiceType(selected.summary.serviceType),
                      )}
                    />
                    <SummaryField label="Origem" value={summaryValue(selected.summary.origin)} />
                    <SummaryField
                      label="Destino"
                      value={summaryValue(selected.summary.destination)}
                    />
                    <SummaryField
                      label="Saída"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-3.5 text-muted-foreground" />
                          {formatCivilDateTime(
                            selected.summary.departureDate,
                            selected.summary.departureAt,
                          )}
                        </span>
                      }
                    />
                    <SummaryField
                      label="Retorno"
                      value={formatCivilDateTime(
                        selected.summary.returnDate,
                        selected.summary.returnAt,
                      )}
                    />
                    <SummaryField
                      label="Passageiros"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-3.5 text-muted-foreground" />
                          {summaryValue(selected.summary.passengerCount)}
                        </span>
                      }
                    />
                    <SummaryField
                      label="Veículo"
                      value={summaryValue(selected.summary.vehicleType)}
                    />
                    <SummaryField
                      label="Veículo à disposição"
                      value={booleanValue(selected.summary.vehicleAtDisposal)}
                    />
                    <SummaryField
                      label="Traslados locais"
                      value={booleanValue(selected.summary.localTransfers)}
                    />
                    <div className="sm:col-span-2 xl:col-span-3">
                      <SummaryField
                        label="Observações"
                        value={summaryValue(selected.summary.notes)}
                      />
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="size-4 text-primary-emphasis" />
                    PDF da proposta
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Selecione um ou mais orçamentos em PDF. O limite é 10 MB por arquivo.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label
                    htmlFor={`proposal-file-${selected.quoteRequestId}`}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors hover:bg-muted/40"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary-emphasis">
                      <FileClock className="size-5" aria-hidden="true" />
                    </span>
                    <span className="mt-3 text-sm font-semibold">
                      Clique para selecionar um ou mais PDFs
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      O arquivo será validado antes do envio.
                    </span>
                    <input
                      id={`proposal-file-${selected.quoteRequestId}`}
                      className="sr-only"
                      type="file"
                      multiple
                      aria-label="Clique para selecionar o PDF ou PDFs"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                      disabled={isPending || !canManage}
                    />
                  </label>

                  {isValidating ? (
                    <div
                      role="status"
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      Validando PDF...
                    </div>
                  ) : null}

                  {selectedFile && fileValidation ? (
                    <div
                      className={`rounded-xl border p-4 ${
                        fileValidation.valid
                          ? 'border-success/30 bg-success/5'
                          : 'border-destructive/30 bg-destructive/5'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileCheck2
                          className={
                            fileValidation.valid
                              ? 'mt-0.5 size-5 text-success-emphasis'
                              : 'mt-0.5 size-5 text-destructive-emphasis'
                          }
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{selectedFile.name}</p>
                          {fileValidation.valid ? (
                            <>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatQuoteProposalPdfSize(fileValidation.metadata.sizeBytes)} ·
                                PDF validado
                              </p>
                              <p className="mt-2 text-xs text-success-emphasis">
                                Pronto para revisar e enviar.
                              </p>
                            </>
                          ) : (
                            <p role="alert" className="mt-1 text-xs text-destructive-emphasis">
                              {fileValidation.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedFiles.length > 1 ? (
                    <ul className="space-y-2" aria-label="PDFs selecionados">
                      {selectedFiles.slice(1).map((file, index) => {
                        const validation = fileValidations[index + 1];
                        return (
                          <li
                            key={`${file.name}-${file.size}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 truncate font-medium">{file.name}</span>
                            <span
                              className={
                                validation?.valid
                                  ? 'shrink-0 text-xs text-success-emphasis'
                                  : 'shrink-0 text-xs text-destructive-emphasis'
                              }
                            >
                              {validation?.valid
                                ? `${formatQuoteProposalPdfSize(validation.metadata.sizeBytes)} · PDF validado`
                                : (validation?.message ?? 'Validando...')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {selectedFiles.length === 0 && selected.proposalDocument ? (
                    <div
                      className={`rounded-xl border p-4 ${
                        selected.proposalDocument.status === 'failed'
                          ? 'border-destructive/30 bg-destructive/5'
                          : selected.proposalDocument.status === 'queued'
                            ? 'border-info/30 bg-info/5'
                            : 'border-success/30 bg-success/5'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileCheck2
                          className="mt-0.5 size-5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {selected.proposalDocument.fileName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatQuoteProposalPdfSize(selected.proposalDocument.sizeBytes)}
                          </p>
                          <p className="mt-2 text-xs">
                            {selected.proposalDocument.status === 'uploaded'
                              ? 'PDF já registrado e pronto para confirmação.'
                              : selected.proposalDocument.status === 'queued'
                                ? 'Envio em processamento pelo WhatsApp.'
                                : selected.proposalDocument.status === 'sent'
                                  ? 'Envio confirmado pelo WhatsApp; aguardando atualização da fila.'
                                  : 'O último envio falhou. Selecione um novo PDF para tentar novamente.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button
                      size="lg"
                      disabled={!canReviewAndSend || isPending}
                      onClick={() => setIsConfirmationOpen(true)}
                    >
                      <Send aria-hidden="true" />
                      Enviar proposta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        ) : (
          <section className="flex min-h-80 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Ajuste os filtros para selecionar um orçamento pendente.
          </section>
        )}
      </div>

      {showHistory ? (
        <ProposalHistory
          proposals={sentProposals}
          total={sentTotal}
          onCreated={registerCreatedProposal}
          onDecided={registerProposalDecision}
          onError={registerProposalError}
        />
      ) : null}

      <Dialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar envio da proposta?</DialogTitle>
            <DialogDescription>
              Confira o cliente e o arquivo. Após confirmar, o PDF será registrado e solicitará o
              envio automático pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {selected && (selectedFilesAreValid || reusableDocument) ? (
            <div className="grid gap-3 rounded-xl bg-muted/60 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Cliente</span>
                <strong className="text-right">{selected.contact.name}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">WhatsApp</span>
                <strong className="text-right">{formatPhone(selected.contact.phone)}</strong>
              </div>
              <div className="grid gap-2">
                <span className="text-muted-foreground">
                  {selectedFiles.length > 1 ? 'Arquivos' : 'Arquivo'}
                </span>
                <ul className="space-y-1">
                  {selectedFilesAreValid ? (
                    fileValidations.map((validation) =>
                      validation.valid ? (
                        <li
                          key={`${validation.metadata.fileName}-${validation.metadata.sizeBytes}`}
                          className="flex justify-between gap-4"
                        >
                          <strong className="min-w-0 truncate">
                            {validation.metadata.fileName}
                          </strong>
                          <span className="shrink-0 text-muted-foreground">
                            {formatQuoteProposalPdfSize(validation.metadata.sizeBytes)}
                          </span>
                        </li>
                      ) : null,
                    )
                  ) : reusableDocument ? (
                    <li className="flex justify-between gap-4">
                      <strong className="min-w-0 truncate">{reusableDocument.fileName}</strong>
                      <span className="shrink-0 text-muted-foreground">
                        {formatQuoteProposalPdfSize(reusableDocument.sizeBytes)}
                      </span>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}

          <p className="text-xs leading-5 text-muted-foreground">
            O atendimento mudará para “Aguardando cliente” somente quando o envio for confirmado,
            evitando indicar sucesso antes da entrega.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsConfirmationOpen(false)}
            >
              Voltar
            </Button>
            <Button type="button" disabled={isPending} onClick={submitProposal}>
              {isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {isPending ? 'Enviando...' : 'Confirmar envio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
