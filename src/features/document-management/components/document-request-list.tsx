'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import type { DocumentRequestSummary } from '../domain';
import { DOCUMENT_CONTEXT_LABELS, DOCUMENT_STATUS_LABELS } from '../domain';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Progress } from '@/shared/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/form-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const statusPriority: Readonly<Record<string, number>> = {
  'pending-upload': 0,
  'pending-human-review': 1,
  approved: 2,
};

function approvedProgressOf(request: DocumentRequestSummary): number {
  return request.progress.total
    ? Math.round((request.progress.approved / request.progress.total) * 100)
    : 0;
}

function uploadedProgressOf(request: DocumentRequestSummary): number {
  return request.progress.total
    ? Math.round((request.progress.uploaded / request.progress.total) * 100)
    : 0;
}

function RequestCard({
  request,
  management,
  onOpen,
}: {
  readonly request: DocumentRequestSummary;
  readonly management: boolean;
  readonly onOpen?: (request: DocumentRequestSummary) => void;
}) {
  const uploadedProgress = uploadedProgressOf(request);
  const approvedProgress = approvedProgressOf(request);
  const content = (
    <Card className="h-full transition-colors hover:bg-muted/30">
      <CardHeader>
        <CardTitle>{management ? request.subject.name : 'Meu dossiê documental'}</CardTitle>
        <CardDescription>{DOCUMENT_CONTEXT_LABELS[request.context]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Arquivos enviados</span>
            <strong>{uploadedProgress}%</strong>
          </div>
          <Progress
            value={uploadedProgress}
            aria-label={`${uploadedProgress}% dos arquivos enviados`}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Arquivos aprovados</span>
            <strong>{approvedProgress}%</strong>
          </div>
          <Progress
            value={approvedProgress}
            aria-label={`${approvedProgress}% dos arquivos aprovados`}
          />
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {DOCUMENT_STATUS_LABELS[request.status]}
        </p>
        <p className="text-xs text-muted-foreground">
          {request.deadline
            ? `Prazo: ${new Date(request.deadline).toLocaleDateString('pt-BR')}`
            : 'Sem prazo definido'}
        </p>
      </CardContent>
    </Card>
  );

  if (management) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => onOpen?.(request)}
        className="block h-auto w-full items-stretch justify-start rounded-xl p-0 text-left whitespace-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        aria-label={`Revisar documentos de ${request.subject.name}`}
      >
        {content}
      </Button>
    );
  }

  return (
    <Link
      href={`/documents/${request.id}`}
      className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      {content}
    </Link>
  );
}

function RequestGrid({
  requests,
  management,
  onOpen,
}: {
  readonly requests: readonly DocumentRequestSummary[];
  readonly management: boolean;
  readonly onOpen?: (request: DocumentRequestSummary) => void;
}) {
  if (!requests.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum funcionário encontrado neste grupo.
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} management={management} onOpen={onOpen} />
      ))}
    </div>
  );
}

function representativeRequests(
  requests: readonly DocumentRequestSummary[],
): readonly DocumentRequestSummary[] {
  const byUser = new Map<string, DocumentRequestSummary>();
  for (const request of requests) {
    const current = byUser.get(request.subject.id);
    if (!current) {
      byUser.set(request.subject.id, request);
      continue;
    }
    const requestPending = request.status !== 'approved' && request.status !== 'cancelled';
    const currentPending = current.status !== 'approved' && current.status !== 'cancelled';
    if (
      (requestPending && !currentPending) ||
      (requestPending === currentPending && request.updatedAt > current.updatedAt)
    ) {
      byUser.set(request.subject.id, request);
    }
  }
  return [...byUser.values()];
}

export function DocumentRequestList({
  requests,
  management = false,
}: {
  readonly requests: readonly DocumentRequestSummary[];
  readonly management?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [context, setContext] = useState('all');
  const [selected, setSelected] = useState<DocumentRequestSummary | null>(null);

  const normalized = useMemo(() => {
    const source = [...representativeRequests(requests)];
    return source.sort((left, right) => {
      const priority = (statusPriority[left.status] ?? 10) - (statusPriority[right.status] ?? 10);
      return priority || right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [requests]);

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhuma solicitação documental encontrada.
      </div>
    );
  }

  if (!management) {
    const approved = normalized.filter((request) => request.status === 'approved');
    const active = normalized.filter((request) => request.status !== 'approved');
    return (
      <div className="space-y-4">
        <RequestGrid requests={active} management={false} />
        {approved.length ? (
          <Card>
            <CardContent>
              <Accordion>
                <AccordionItem value="approved">
                  <AccordionTrigger>Documentos aprovados ({approved.length})</AccordionTrigger>
                  <AccordionContent>
                    <RequestGrid requests={approved} management={false} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const filtered = normalized.filter((request) => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return (
      (!needle ||
        `${request.subject.name} ${request.subject.email}`
          .toLocaleLowerCase('pt-BR')
          .includes(needle)) &&
      (status === 'all' || request.status === status) &&
      (context === 'all' || request.context === context)
    );
  });
  const pending = filtered.filter(
    (request) => request.status !== 'approved' && request.status !== 'cancelled',
  );
  const approved = filtered.filter((request) => request.status === 'approved');

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_15rem_15rem]">
        <label className="space-y-1 text-sm font-medium">
          <span>Pesquisar funcionário</span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome ou e-mail"
          />
        </label>
        <label className="space-y-1 text-sm font-medium" htmlFor="document-status-filter">
          <span>Status</span>
          <Select value={status} onValueChange={(value) => setStatus(value ?? 'all')}>
            <SelectTrigger id="document-status-filter" className="h-9 w-full">
              <SelectValue>
                {(value: string | null) =>
                  value === 'all' ? 'Todos' : DOCUMENT_STATUS_LABELS[value ?? ''] || 'Todos'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium" htmlFor="document-context-filter">
          <span>Contexto</span>
          <Select value={context} onValueChange={(value) => setContext(value ?? 'all')}>
            <SelectTrigger id="document-context-filter" className="h-9 w-full">
              <SelectValue>
                {(value: string | null) =>
                  value === 'all'
                    ? 'Todos'
                    : DOCUMENT_CONTEXT_LABELS[value as keyof typeof DOCUMENT_CONTEXT_LABELS] ||
                      'Todos'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(DOCUMENT_CONTEXT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger
            value="pending"
            className="min-w-0 px-1 sm:px-3"
            aria-label={`Com pendências, ${pending.length}`}
            title={`Com pendências (${pending.length})`}
          >
            <span className="w-full min-w-0 truncate">
              <span className="hidden sm:inline">Com </span>Pendências ({pending.length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="approved"
            className="min-w-0 px-1 sm:px-3"
            aria-label={`Completos, ${approved.length}`}
            title={`Completos (${approved.length})`}
          >
            <span className="w-full min-w-0 truncate">Completos ({approved.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="min-w-0 px-1 sm:px-3"
            aria-label={`Todos, ${filtered.length}`}
            title={`Todos (${filtered.length})`}
          >
            <span className="w-full min-w-0 truncate">Todos ({filtered.length})</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <RequestGrid requests={pending} management onOpen={setSelected} />
        </TabsContent>
        <TabsContent value="approved">
          <RequestGrid requests={approved} management onOpen={setSelected} />
        </TabsContent>
        <TabsContent value="all">
          <RequestGrid requests={filtered} management onOpen={setSelected} />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="h-dvh w-screen max-w-none grid-rows-[auto_1fr] overflow-hidden rounded-none p-0 sm:h-[92dvh] sm:w-[96vw] sm:max-w-[1500px] sm:rounded-xl">
          <DialogHeader className="border-b p-3 pr-12 sm:p-4 sm:pr-12">
            <DialogTitle>Revisão documental — {selected?.subject.name}</DialogTitle>
            <DialogDescription>
              Revise, confirme dados, substitua arquivos e registre a decisão sem sair desta tela.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <iframe
              title={`Revisão documental de ${selected.subject.name}`}
              src={`/document-management/${selected.id}?embedded=1`}
              className="h-full min-h-0 w-full rounded-b-xl bg-background"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
