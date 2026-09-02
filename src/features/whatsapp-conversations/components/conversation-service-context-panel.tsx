'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Bot,
  BrainCircuit,
  CircleGauge,
  Clock3,
  ExternalLink,
  Headset,
  ListRestart,
  Radio,
  SendHorizontal,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/ui/select';
import { CustomerContextPanel } from '@/features/customer-context/components';

import {
  getCurrentWhatsAppServiceSession,
  getWhatsAppConversationEvidence,
  type WhatsAppConversation,
  type WhatsAppEvidenceItem,
  type WhatsAppServiceSessionAction,
  type WhatsAppServiceSessionPriority,
} from '../domain';
import { DEPARTMENT_LABELS, FLOW_STEP_LABELS, REQUEST_STATUS_LABELS } from './conversation-labels';

const STATUS_LABELS = {
  OPEN: 'Aberta',
  WAITING_CUSTOMER: 'Aguardando cliente',
  WAITING_HUMAN: 'Aguardando atendimento',
  PAUSED_BY_HIGHER_PRIORITY: 'Pausada por prioridade',
  CLOSING: 'Em encerramento',
  CLOSED: 'Encerrada',
} as const;

const CONTROL_LABELS = { AI: 'IA', HUMAN: 'Humano' } as const;

const PRIORITY_LABELS = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
} as const;

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

function compactReference(value: string): string {
  return value.length > 24 ? `${value.slice(0, 8)}…` : value;
}

function EvidenceGroup({
  title,
  emptyLabel,
  items,
  icon,
}: {
  readonly title: string;
  readonly emptyLabel: string;
  readonly items: readonly WhatsAppEvidenceItem[];
  readonly icon: React.ReactNode;
}) {
  return (
    <section className="border-t border-border px-3 py-3" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {icon}
          {title}
        </h4>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-muted/20 px-2.5 py-2">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <strong className="min-w-0 truncate text-xs text-foreground">
                  {item.name ?? item.summary ?? 'Evidência registrada'}
                </strong>
                {item.status ? (
                  <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground ring-1 ring-border">
                    {item.status}
                  </span>
                ) : null}
              </div>
              {item.name && item.summary ? (
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                  {item.summary}
                </p>
              ) : null}
              {item.provider || item.model ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {[item.provider, item.model].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Abrir fonte <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface ConversationServiceContextPanelProps {
  readonly conversation: WhatsAppConversation;
  readonly isBusy: boolean;
  readonly onBack?: () => void;
  readonly onAssume: () => void;
  readonly onTransfer: () => void;
  readonly onReturnToQueue: () => void;
  readonly onChangePriority: (priority: WhatsAppServiceSessionPriority, reason: string) => void;
  readonly onReturnToAi: () => void;
  readonly onClose: () => void;
  readonly onArchiveToggle: () => void;
  readonly onCommercialStatus: () => void;
  readonly canChangeCommercialStatus: boolean;
  readonly canViewCustomerContext?: boolean;
  readonly canRespondCustomerContext?: boolean;
  readonly canAssume?: boolean;
  readonly canTransfer?: boolean;
  readonly canChangePriority?: boolean;
  readonly canReturnToAi?: boolean;
  readonly canClose?: boolean;
  readonly canArchive?: boolean;
}

export function ConversationServiceContextPanel({
  conversation,
  isBusy,
  onBack,
  onAssume,
  onTransfer,
  onReturnToQueue,
  onChangePriority,
  onReturnToAi,
  onClose,
  onArchiveToggle,
  onCommercialStatus,
  canChangeCommercialStatus,
  canViewCustomerContext = false,
  canRespondCustomerContext = false,
  canAssume = false,
  canTransfer = false,
  canChangePriority = false,
  canReturnToAi = false,
  canClose = false,
  canArchive = false,
}: ConversationServiceContextPanelProps) {
  const session = getCurrentWhatsAppServiceSession(conversation);
  const evidence = getWhatsAppConversationEvidence(conversation);
  const [priority, setPriority] = useState<WhatsAppServiceSessionPriority>(session.priority);
  const [priorityReason, setPriorityReason] = useState('');

  const can = (action: WhatsAppServiceSessionAction) => session.availableActions.includes(action);
  const unavailableLabel =
    session.projection === 'LEGACY_CONVERSATION'
      ? 'Aguardando suporte da Tenant API para esta ação.'
      : 'A ação não está disponível no estado atual.';

  return (
    <aside
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-card"
      aria-labelledby="service-context-title"
      aria-busy={isBusy}
    >
      <header className="flex min-h-14 items-center gap-2 border-b border-border px-3 py-2">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="xl:hidden"
            onClick={onBack}
            aria-label="Voltar para a conversa"
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        ) : null}
        <div className="min-w-0">
          <h3 id="service-context-title" className="truncate text-sm font-bold text-foreground">
            Contexto do atendimento
          </h3>
          <p className="truncate text-[10px] text-muted-foreground">
            Sessão {session.id.slice(0, 8)} · v{session.version}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section className="grid grid-cols-2 gap-px bg-border" aria-label="Estado do atendimento">
          <div className="bg-card px-3 py-2">
            <small className="block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Status
            </small>
            <strong className="mt-0.5 block text-xs">{STATUS_LABELS[session.status]}</strong>
          </div>
          <div className="bg-card px-3 py-2">
            <small className="block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Controle
            </small>
            <strong className="mt-0.5 flex items-center gap-1 text-xs">
              {session.controlMode === 'AI' ? (
                <Bot aria-hidden="true" className="size-3.5 text-success-emphasis" />
              ) : (
                <Headset aria-hidden="true" className="size-3.5 text-info" />
              )}
              {CONTROL_LABELS[session.controlMode]}
            </strong>
          </div>
        </section>

        <dl className="grid gap-2 px-3 py-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <UserRound aria-hidden="true" className="size-3.5" /> Responsável
            </dt>
            <dd className="max-w-[60%] text-right font-semibold">
              {session.responsible?.name ??
                conversation.assignedTo?.name ??
                (session.responsibleUserId
                  ? `Usuário ${compactReference(session.responsibleUserId)}`
                  : 'Não atribuído')}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Sparkles aria-hidden="true" className="size-3.5" /> Etapa
            </dt>
            <dd className="max-w-[60%] text-right font-semibold">
              {FLOW_STEP_LABELS[conversation.flowStep]}
            </dd>
          </div>
          {conversation.department === 'commercial' ? (
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Clock3 aria-hidden="true" className="size-3.5" /> Status comercial
              </dt>
              <dd className="max-w-[60%] text-right font-semibold">
                {REQUEST_STATUS_LABELS[conversation.requestStatus]}
              </dd>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <ListRestart aria-hidden="true" className="size-3.5" /> Fila
            </dt>
            <dd className="max-w-[60%] text-right font-semibold">
              {session.queue?.name ??
                (session.queueId
                  ? `Fila ${compactReference(session.queueId)}`
                  : 'Sem fila informada')}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <CircleGauge aria-hidden="true" className="size-3.5" /> Prioridade
            </dt>
            <dd className="max-w-[60%] text-right">
              <strong className="block font-semibold">{PRIORITY_LABELS[session.priority]}</strong>
              {session.priorityReason ? (
                <small className="mt-0.5 block text-[10px] font-normal leading-4 text-muted-foreground">
                  {session.priorityReason}
                </small>
              ) : null}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <SendHorizontal aria-hidden="true" className="size-3.5" /> Departamento
            </dt>
            <dd className="max-w-[60%] text-right font-semibold">
              {DEPARTMENT_LABELS[conversation.department]}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Radio aria-hidden="true" className="size-3.5" /> Canal de origem
            </dt>
            <dd className="max-w-[60%] text-right font-semibold">
              {conversation.sourceChannel?.name ?? conversation.channel.name}
            </dd>
          </div>
        </dl>

        {session.projection === 'LEGACY_CONVERSATION' ? (
          <p className="mx-3 mb-3 rounded-lg bg-warning/10 px-2.5 py-2 text-[10px] leading-4 text-warning-emphasis ring-1 ring-warning/20">
            Compatibilidade legada: fila e prioridade serão editáveis quando a Tenant API publicar
            os comandos de ServiceSession.
          </p>
        ) : null}

        <section className="border-t border-border px-3 py-3" aria-label="Ações do atendimento">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Ações
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onArchiveToggle}
              disabled={isBusy || !canArchive}
            >
              {conversation.archivedAt ? (
                <ArchiveRestore aria-hidden="true" />
              ) : (
                <Archive aria-hidden="true" />
              )}
              {conversation.archivedAt ? 'Desarquivar' : 'Arquivar'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="col-span-2 w-full"
              onClick={onCommercialStatus}
              disabled={isBusy || !canChangeCommercialStatus}
            >
              <Clock3 aria-hidden="true" /> Atualizar status comercial
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onAssume}
              disabled={isBusy || !canAssume || !can('ASSUME')}
            >
              <Headset aria-hidden="true" /> Assumir
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onTransfer}
              disabled={isBusy || !canTransfer || !can('TRANSFER_DEPARTMENT')}
            >
              <SendHorizontal aria-hidden="true" /> Transferir
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReturnToQueue}
              disabled={isBusy || !canTransfer || !can('RETURN_TO_QUEUE')}
              title={can('RETURN_TO_QUEUE') ? 'Retornar atendimento à fila' : unavailableLabel}
            >
              <ListRestart aria-hidden="true" /> Retornar à fila
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReturnToAi}
              disabled={isBusy || !canReturnToAi || !can('RETURN_TO_AI')}
              title={
                can('RETURN_TO_AI') ? 'Retornar explicitamente o controle à IA' : unavailableLabel
              }
            >
              <Bot aria-hidden="true" /> Retornar à IA
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Select
              value={priority}
              onValueChange={(value) => {
                if (
                  typeof value === 'string' &&
                  (PRIORITIES as readonly string[]).includes(value)
                ) {
                  setPriority(value as WhatsAppServiceSessionPriority);
                }
              }}
              disabled={isBusy || !canChangePriority || !can('CHANGE_PRIORITY')}
            >
              <SelectTrigger aria-label="Nova prioridade" className="h-8 w-full text-xs">
                <span>{PRIORITY_LABELS[priority]}</span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChangePriority(priority, priorityReason.trim())}
              disabled={
                isBusy ||
                !canChangePriority ||
                !can('CHANGE_PRIORITY') ||
                priority === session.priority ||
                priorityReason.trim().length < 3
              }
              title={can('CHANGE_PRIORITY') ? 'Aplicar prioridade' : unavailableLabel}
            >
              Aplicar
            </Button>
          </div>
          <Input
            className="mt-2 h-8 text-xs"
            value={priorityReason}
            onChange={(event) => setPriorityReason(event.target.value)}
            minLength={3}
            maxLength={500}
            placeholder="Motivo obrigatório da prioridade"
            aria-label="Motivo da nova prioridade"
            disabled={isBusy || !canChangePriority || !can('CHANGE_PRIORITY')}
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="mt-2 w-full"
            onClick={onClose}
            disabled={isBusy || !canClose || !can('CLOSE')}
          >
            Encerrar atendimento
          </Button>
        </section>

        <EvidenceGroup
          title="Execuções de IA"
          emptyLabel="Nenhuma execução de agente exposta pela API."
          items={evidence.agentExecutions}
          icon={<BrainCircuit aria-hidden="true" className="size-3.5" />}
        />
        <EvidenceGroup
          title="Fontes"
          emptyLabel="Nenhuma fonte de conhecimento registrada."
          items={evidence.knowledgeSources}
          icon={<Sparkles aria-hidden="true" className="size-3.5" />}
        />
        <EvidenceGroup
          title="Tools"
          emptyLabel="Nenhuma tool utilizada neste atendimento."
          items={evidence.toolExecutions}
          icon={<Wrench aria-hidden="true" className="size-3.5" />}
        />
        <EvidenceGroup
          title="Interpretações de mídia"
          emptyLabel="Nenhuma interpretação de mídia registrada."
          items={evidence.mediaInterpretations}
          icon={<Sparkles aria-hidden="true" className="size-3.5" />}
        />
        <EvidenceGroup
          title="Revisões cadastrais"
          emptyLabel="Nenhuma revisão cadastral pendente."
          items={evidence.registrationDataReviews}
          icon={<Sparkles aria-hidden="true" className="size-3.5" />}
        />
        <CustomerContextPanel
          serviceSessionId={session.id}
          nativeSession={session.projection === 'NATIVE'}
          canView={canViewCustomerContext}
          canRespond={canRespondCustomerContext}
        />
      </div>
    </aside>
  );
}
