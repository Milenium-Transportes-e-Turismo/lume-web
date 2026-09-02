'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

import { decideRegistrationDataReviewAction, loadRegistrationDataReviewsAction } from '../actions';
import type { RegistrationDataReview, RegistrationDataReviewStatus } from '../domain';
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
import { Textarea } from '@/shared/ui/textarea';

interface RegistrationDataReviewWorkspaceProps {
  readonly initialReviews: readonly RegistrationDataReview[];
  readonly initialError: string;
}

const STATUS_LABELS: Record<RegistrationDataReviewStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};
const SOURCE_LABELS: Record<RegistrationDataReview['source'], string> = {
  whatsapp: 'WhatsApp',
  internal: 'Interno',
  automation: 'Automação',
};

function readable(value: unknown): string {
  if (value === null) return 'Nulo';
  if (value === undefined) return 'Não informado';
  if (typeof value === 'string') return value || 'Vazio';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Valor não serializável';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function statusVariant(status: RegistrationDataReviewStatus) {
  return status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary';
}

export function RegistrationDataReviewWorkspace({
  initialReviews,
  initialError,
}: RegistrationDataReviewWorkspaceProps) {
  const [reviews, setReviews] = useState<readonly RegistrationDataReview[]>(initialReviews);
  const [selectedId, setSelectedId] = useState<string | null>(initialReviews[0]?.id ?? null);
  const [status, setStatus] = useState<'all' | RegistrationDataReviewStatus>('pending');
  const [query, setQuery] = useState('');
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return reviews.filter(
      (review) =>
        (status === 'all' || review.status === status) &&
        (!normalized ||
          `${review.field} ${review.registrationId} ${review.whatsappContactId ?? ''}`
            .toLocaleLowerCase('pt-BR')
            .includes(normalized)),
    );
  }, [query, reviews, status]);
  const selected = reviews.find((review) => review.id === selectedId) ?? filtered[0] ?? null;

  function load() {
    setError('');
    setMessage('');
    startTransition(async () => {
      const result = await loadRegistrationDataReviewsAction();
      if (result.success) {
        setReviews(result.reviews);
        setMessage(result.message);
      } else {
        setError(`${result.message} Código: ${result.publicCode}.`);
      }
    });
  }

  function decide(decision: 'approved' | 'rejected', rejectionReason?: string) {
    if (!selected) return;
    setError('');
    setMessage('');
    startTransition(async () => {
      const result = await decideRegistrationDataReviewAction({
        reviewId: selected.id,
        commandId: crypto.randomUUID(),
        decision,
        reason: rejectionReason,
      });
      if (result.success) {
        setReviews(result.reviews);
        setMessage(result.message);
        setRejectOpen(false);
        setReason('');
      } else {
        setError(`${result.message} Código: ${result.publicCode}.`);
      }
    });
  }

  function submitRejection(event: FormEvent) {
    event.preventDefault();
    decide('rejected', reason.trim());
  }

  return (
    <section className="grid gap-3" aria-labelledby="review-title">
      <header className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
            Governança cadastral
          </p>
          <h1 id="review-title" className="text-xl font-semibold tracking-tight">
            Revisões de dados
          </h1>
          <p className="text-sm text-muted-foreground">
            Compare propostas com o cadastro atual e preserve a proveniência da decisão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {reviews.filter((item) => item.status === 'pending').length} pendentes
          </Badge>
          <Badge variant="outline">{reviews.length} no histórico</Badge>
          <Button size="sm" variant="outline" onClick={load} disabled={isPending}>
            <RefreshCw className={isPending ? 'animate-spin' : ''} aria-hidden="true" /> Atualizar
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível continuar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="min-h-6 text-sm" aria-live="polite">
        {isPending ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Consultando estado autoritativo…
          </span>
        ) : (
          message
        )}
      </div>

      <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(28rem,1.2fr)]">
        <section className="rounded-xl border bg-card p-2" aria-label="Fila de revisões">
          <div className="grid gap-2 border-b pb-2 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="pl-8"
                aria-label="Buscar revisões"
                placeholder="Campo, cadastro ou contato…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Label className="sr-only" htmlFor="review-status">
              Status
            </Label>
            <select
              id="review-status"
              className="h-8 rounded-lg border bg-background px-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovadas</option>
              <option value="rejected">Rejeitadas</option>
            </select>
          </div>
          <div className="mt-2 grid gap-1">
            {filtered.map((review) => (
              <button
                key={review.id}
                type="button"
                onClick={() => setSelectedId(review.id)}
                className={`rounded-lg border p-2 text-left transition-colors ${selected?.id === review.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{review.field}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Cadastro {review.registrationId}
                    </span>
                  </span>
                  <Badge variant={statusVariant(review.status)}>
                    {STATUS_LABELS[review.status]}
                  </Badge>
                </span>
                <span className="mt-1 block text-[0.7rem] text-muted-foreground">
                  {SOURCE_LABELS[review.source]} · {formatDate(review.createdAt)}
                </span>
              </button>
            ))}
          </div>
          {!filtered.length ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
              <ClipboardCheck className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">Fila vazia</p>
              <p className="text-xs text-muted-foreground">
                Não há revisões para os filtros atuais.
              </p>
            </div>
          ) : null}
        </section>

        <section className="min-w-0 rounded-xl border bg-card p-3" aria-label="Detalhe da revisão">
          {!selected ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-2 text-center">
              <ShieldCheck className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">Selecione uma revisão</p>
              <p className="text-xs text-muted-foreground">
                A comparação e a proveniência aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Campo: {selected.field}</h2>
                  <p className="text-xs text-muted-foreground">
                    Criada em {formatDate(selected.createdAt)} · origem{' '}
                    {SOURCE_LABELS[selected.source]}
                  </p>
                </div>
                <Badge variant={statusVariant(selected.status)}>
                  {STATUS_LABELS[selected.status]}
                </Badge>
              </header>

              <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <article className="min-w-0 rounded-lg border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Valor atual
                  </p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">
                    {readable(selected.currentValue)}
                  </pre>
                </article>
                <ArrowRight
                  className="m-auto size-5 rotate-90 text-muted-foreground sm:rotate-0"
                  aria-hidden="true"
                />
                <article className="min-w-0 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    Valor proposto
                  </p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">
                    {readable(selected.proposedValue)}
                  </pre>
                </article>
              </div>

              <section className="rounded-lg border p-3" aria-labelledby="provenance-title">
                <h3 id="provenance-title" className="text-sm font-semibold">
                  Proveniência
                </h3>
                <dl className="mt-2 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Cadastro</dt>
                    <dd className="break-all font-mono">{selected.registrationId}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Contato WhatsApp</dt>
                    <dd className="break-all font-mono">{selected.whatsappContactId ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sessão de atendimento</dt>
                    <dd className="break-all font-mono">{selected.serviceSessionId ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Execução do agente</dt>
                    <dd className="break-all font-mono">{selected.agentExecutionId ?? '—'}</dd>
                  </div>
                </dl>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  render={<Link href={`/registrations/${selected.registrationId}`} />}
                >
                  Abrir cadastro
                </Button>
              </section>

              {selected.status === 'pending' ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                  <Button
                    variant="destructive"
                    onClick={() => setRejectOpen(true)}
                    disabled={isPending}
                  >
                    <X /> Rejeitar
                  </Button>
                  <Button onClick={() => decide('approved')} disabled={isPending}>
                    <Check /> Aprovar e aplicar
                  </Button>
                </div>
              ) : (
                <section className="rounded-lg bg-muted/60 p-3 text-sm">
                  <p>
                    <strong>Decidida em:</strong> {formatDate(selected.reviewedAt)}
                  </p>
                  <p>
                    <strong>Responsável:</strong>{' '}
                    <span className="break-all font-mono text-xs">
                      {selected.reviewedByUserId ?? '—'}
                    </span>
                  </p>
                  {selected.reviewReason ? (
                    <p>
                      <strong>Motivo:</strong> {selected.reviewReason}
                    </p>
                  ) : null}
                </section>
              )}
            </div>
          )}
        </section>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <form onSubmit={submitRejection} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Rejeitar alteração</DialogTitle>
              <DialogDescription>
                O motivo é obrigatório e ficará registrado na trilha de auditoria.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="rejection-reason">Motivo</Label>
              <Textarea
                id="rejection-reason"
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                Confirmar rejeição
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
