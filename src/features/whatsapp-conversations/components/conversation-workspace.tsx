'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bot,
  Building2,
  CircleStop,
  Clock3,
  FileText,
  FileUp,
  Forward,
  Headset,
  History,
  Inbox,
  MessageCircle,
  MessageSquarePlus,
  PanelRightOpen,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';

import { findClientByPhoneAction } from '@/features/clients/actions/client-actions';
import { updateQuoteProposalStatusAction } from '@/features/quote-proposals/actions';
import { cn } from '@/shared/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button, buttonVariants } from '@/shared/ui/button';
import { userFacingMessage } from '@/shared/lib/user-facing-message';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/toast';
import {
  archiveWhatsAppConversationAction,
  changeWhatsAppConversationPriorityAction,
  changeWhatsAppConversationDepartmentAction,
  closeWhatsAppConversationAction,
  markWhatsAppConversationAsReadAction,
  returnWhatsAppConversationToBotAction,
  returnWhatsAppConversationToQueueAction,
  sendHumanWhatsAppMessageAction,
  startWhatsAppConversationAction,
  takeOverWhatsAppConversationAction,
  transferWhatsAppServiceSessionAction,
  unarchiveWhatsAppConversationAction,
  type SendHumanWhatsAppMessageActionResult,
  type WhatsAppConversationActionResult,
} from '../actions';
import { HUMAN_WHATSAPP_MESSAGE_MAX_LENGTH } from '../application';
import {
  canSendHumanWhatsAppMessage,
  getWhatsAppConversationMetrics,
  getCurrentWhatsAppServiceSession,
  isWhatsAppBotBlocked,
  isWhatsAppConversationDepartment,
  isWhatsAppHumanActive,
  WHATSAPP_ROUTABLE_DEPARTMENTS,
  WHATSAPP_REQUEST_STATUSES,
  type WhatsAppConversation,
  type WhatsAppConversationMetrics,
  type WhatsAppConversationDepartment,
  type WhatsAppRequestStatus,
  type WhatsAppServiceSessionPriority,
  type WhatsAppServiceAssignmentTarget,
} from '../domain';
import {
  CONVERSATION_STATE_LABELS,
  DEPARTMENT_LABELS,
  FLOW_STEP_LABELS,
  getConversationControl,
  REQUEST_STATUS_LABELS,
  type ConversationControl,
} from './conversation-labels';
import { ConversationMessageSheet } from './conversation-message-sheet';
import { ConversationInboxList } from './conversation-inbox-list';
import { ConversationQuoteActions } from './conversation-quote-actions';
import { ConversationServiceContextPanel } from './conversation-service-context-panel';
import { conversationWorkspaceStyles as styles } from './conversation-workspace.styles';

export interface ConversationWorkspaceProps {
  readonly initialConversations: readonly WhatsAppConversation[];
  readonly initialPagination?: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
  readonly initialMetrics?: WhatsAppConversationMetrics;
  readonly initialError?: string | null;
  readonly currentUserId?: string | null;
  readonly initialAssignmentTargets?: readonly WhatsAppServiceAssignmentTarget[];
  readonly canViewCustomerContext?: boolean;
  readonly canRespondCustomerContext?: boolean;
  readonly permissions?: Partial<ConversationWorkspacePermissions>;
}

export interface ConversationWorkspacePermissions {
  readonly respond: boolean;
  readonly assume: boolean;
  readonly transfer: boolean;
  readonly priority: boolean;
  readonly close: boolean;
  readonly legacyManagement: boolean;
}

const NO_WORKSPACE_PERMISSIONS: ConversationWorkspacePermissions = {
  respond: false,
  assume: false,
  transfer: false,
  priority: false,
  close: false,
  legacyManagement: false,
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

const POLLING_BASE_DELAY_MS = 4_000;
const POLLING_MAX_DELAY_MS = 30_000;

interface HumanMessageSubmission {
  readonly conversationId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly text: string;
}

interface HumanMediaSubmission {
  readonly conversationId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly caption: string;
  readonly file: File;
  readonly mediaKind: 'auto' | 'sticker';
}

const MANUAL_COMMERCIAL_STATUSES = [
  'under-review',
  'waiting-for-customer',
  'approved',
  'rejected',
  'cancelled',
] as const;

type ManualCommercialStatus = (typeof MANUAL_COMMERCIAL_STATUSES)[number];

function isManualCommercialStatus(value: unknown): value is ManualCommercialStatus {
  return (
    typeof value === 'string' && (MANUAL_COMMERCIAL_STATUSES as readonly string[]).includes(value)
  );
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function conversationMatchesSearch(
  conversation: WhatsAppConversation,
  normalizedQuery: string,
): boolean {
  const searchableContent = [
    conversation.contact.name,
    conversation.contact.phone,
    conversation.lastMessagePreview,
    DEPARTMENT_LABELS[conversation.department],
    CONVERSATION_STATE_LABELS[conversation.conversationState],
    FLOW_STEP_LABELS[conversation.flowStep],
    REQUEST_STATUS_LABELS[conversation.requestStatus],
    conversation.assignedTo?.name ?? '',
  ].join(' ');

  return normalizeSearchValue(searchableContent).includes(normalizedQuery);
}

function formatDateTime(value: string | null): string {
  return value ? DATE_TIME_FORMATTER.format(new Date(value)) : 'Não registrado';
}

function getContactInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?';
}

function getFlowStepLabel(conversation: WhatsAppConversation): string {
  if (
    conversation.flowStep === 'quote-send-pending' &&
    conversation.requestStatus === 'waiting-for-customer'
  ) {
    return 'Proposta enviada';
  }

  return FLOW_STEP_LABELS[conversation.flowStep];
}

function getDefaultTargetDepartment(
  currentDepartment: WhatsAppConversationDepartment,
): WhatsAppConversationDepartment {
  return (
    WHATSAPP_ROUTABLE_DEPARTMENTS.find((department) => department !== currentDepartment) ??
    currentDepartment
  );
}

export function preserveLoadedConversationHistory(
  current: readonly WhatsAppConversation[],
  incoming: readonly WhatsAppConversation[],
): WhatsAppConversation[] {
  return incoming.map((conversation) => {
    const existing = current.find((candidate) => candidate.id === conversation.id);
    return {
      ...conversation,
      messages: existing?.messages ?? conversation.messages,
      messageHistory: existing?.messageHistory ?? conversation.messageHistory,
      transitions: existing?.transitions ?? conversation.transitions,
    };
  });
}

function hasPendingOutboundMessage(conversation: WhatsAppConversation): boolean {
  return conversation.messages.some(
    (message) => message.direction === 'outbound' && message.deliveryStatus === 'pending',
  );
}

function getClosureReason(transition: WhatsAppConversation['transitions'][number]): string | null {
  const reason = transition.metadata.reason;
  return typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : null;
}

function getClosureActor(transition: WhatsAppConversation['transitions'][number]): string {
  if (transition.actor?.user?.name) return transition.actor.user.name;
  if (transition.actorType === 'user') return 'Atendente não identificado';
  return 'Automação';
}

const TRANSITION_LABELS: Readonly<Record<string, string>> = {
  'present-main-menu': 'Menu principal apresentado',
  'select-commercial': 'Atendimento comercial selecionado',
  'start-department-contact': 'Contato com departamento iniciado',
  'start-quote': 'Coleta de orçamento iniciada',
  'new-quote-request': 'Novo orçamento solicitado',
  'present-quote-summary': 'Resumo do orçamento apresentado',
  'correct-quote': 'Orçamento corrigido',
  'confirm-quote': 'Resumo do orçamento confirmado',
  'proposal-delivery-confirmed': 'Entrega da proposta confirmada',
  'proposal-response-received': 'Resposta da proposta registrada',
  'return-to-main-menu': 'Retorno ao menu principal',
  'take-over': 'Atendimento assumido',
  'return-to-bot': 'Atendimento devolvido ao bot',
  forward: 'Atendimento encaminhado',
  'mark-read': 'Conversa marcada como lida',
  close: 'Atendimento encerrado',
  'close-after-rejection': 'Atendimento encerrado após recusa',
  'resume-awaited-reply': 'Resposta aguardada retomada',
  'resume-contextual-contact': 'Contato contextual retomado',
};

function getTransitionLabel(name: string): string {
  return TRANSITION_LABELS[name] ?? 'Ação registrada';
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const value = (await response.json()) as { readonly message?: unknown };
    return typeof value.message === 'string'
      ? value.message
      : 'Não foi possível atualizar as conversas.';
  } catch {
    return 'Não foi possível atualizar as conversas.';
  }
}

export function ConversationWorkspace({
  initialConversations,
  initialPagination = {
    page: 1,
    pageSize: 25,
    total: initialConversations.length,
    totalPages: initialConversations.length > 0 ? 1 : 0,
  },
  initialMetrics,
  initialError = null,
  currentUserId = null,
  initialAssignmentTargets = [],
  canViewCustomerContext = false,
  canRespondCustomerContext = false,
  permissions: suppliedPermissions,
}: ConversationWorkspaceProps) {
  const permissions = { ...NO_WORKSPACE_PERMISSIONS, ...suppliedPermissions };
  const { push: pushRoute, replace: replaceRoute } = useRouter();
  const routeSearchParams = useSearchParams();
  const requestedConversationId = routeSearchParams.get('conversationId');
  const [conversations, setConversations] = useState(initialConversations);
  const [pagination, setPagination] = useState(initialPagination);
  const [metrics, setMetrics] = useState(
    initialMetrics ?? getWhatsAppConversationMetrics(initialConversations),
  );
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    requestedConversationId ?? initialConversations[0]?.id ?? null,
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(requestedConversationId));
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inboxView, setInboxView] = useState<'all' | 'unread'>('all');
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [listPage, setListPage] = useState(initialPagination.page);
  const [departmentFilter, setDepartmentFilter] = useState<WhatsAppConversationDepartment | 'all'>(
    'all',
  );
  const [controlFilter, setControlFilter] = useState<ConversationControl | 'all'>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<WhatsAppRequestStatus | 'all'>(
    'all',
  );
  const [targetDepartment, setTargetDepartment] = useState<WhatsAppConversationDepartment>(
    getDefaultTargetDepartment(initialConversations[0]?.department ?? 'commercial'),
  );
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [messageDraft, setMessageDraft] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [selectedAttachmentKind, setSelectedAttachmentKind] = useState<'auto' | 'sticker'>('auto');
  const [listError, setListError] = useState(initialError ?? '');
  const [detailError, setDetailError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isStartConversationDialogOpen, setIsStartConversationDialogOpen] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState('');
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [isReturnQueueDialogOpen, setIsReturnQueueDialogOpen] = useState(false);
  const [transferDepartmentId, setTransferDepartmentId] = useState('');
  const [transferQueueId, setTransferQueueId] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [returnQueueId, setReturnQueueId] = useState('');
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [isClientMissingDialogOpen, setIsClientMissingDialogOpen] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [isResolvingClient, startClientLookup] = useTransition();
  const [closeReason, setCloseReason] = useState('');
  const [manualCommercialStatus, setManualCommercialStatus] =
    useState<ManualCommercialStatus>('under-review');
  const [manualCommercialStatusReason, setManualCommercialStatusReason] = useState('');
  const [loadedConversationIds, setLoadedConversationIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [isUpdatingConversation, startConversationTransition] = useTransition();
  const [isSendingMessage, startMessageTransition] = useTransition();
  const [, startReadTransition] = useTransition();
  const conversationsRef = useRef(conversations);
  const selectedConversationIdRef = useRef(selectedConversationId);
  const pollingFailureCountRef = useRef(0);
  const listAbortControllerRef = useRef<AbortController | null>(null);
  const skipImmediateListRefreshRef = useRef(true);
  const humanMessageSubmissionRef = useRef<HumanMessageSubmission | null>(null);
  const humanMediaSubmissionRef = useRef<HumanMediaSubmission | null>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    if (!listError) return;
    toast.add({
      title: 'Conversas não atualizadas',
      description: 'Não foi possível atualizar a lista de conversas.',
      type: 'error',
    });
  }, [listError]);

  useEffect(() => {
    if (feedbackTone !== 'error' || !feedbackMessage) return;
    toast.add({
      title: 'Operação não concluída',
      description: userFacingMessage(feedbackMessage, 'Não foi possível concluir a operação.'),
      type: 'error',
    });
  }, [feedbackMessage, feedbackTone]);

  const replaceConversation = useCallback(
    (updatedConversation: WhatsAppConversation, preserveExistingMessages = true) => {
      setConversations((currentConversations) => {
        const exists = currentConversations.some(
          (conversation) => conversation.id === updatedConversation.id,
        );
        const updated = currentConversations.map((conversation) =>
          conversation.id === updatedConversation.id
            ? {
                ...updatedConversation,
                messages:
                  !preserveExistingMessages || updatedConversation.messages.length > 0
                    ? updatedConversation.messages
                    : conversation.messages,
                messageHistory:
                  !preserveExistingMessages || updatedConversation.messageHistory
                    ? updatedConversation.messageHistory
                    : conversation.messageHistory,
                transitions:
                  !preserveExistingMessages || updatedConversation.transitions.length > 0
                    ? updatedConversation.transitions
                    : conversation.transitions,
              }
            : conversation,
        );
        return exists ? updated : [updatedConversation, ...updated];
      });
    },
    [],
  );

  const loadConversationDetail = useCallback(
    async (conversationId: string, messagePage = 1): Promise<void> => {
      if (messagePage === 1) setIsLoadingDetail(true);
      else setIsLoadingOlderMessages(true);
      setDetailError('');

      try {
        const response = await fetch(
          `/api/whatsapp-conversations?conversationId=${encodeURIComponent(conversationId)}&messagePage=${messagePage}`,
          { cache: 'no-store' },
        );

        if (response.status === 401) {
          pushRoute('/auth/session-expired');
          return;
        }
        if (!response.ok) throw new Error(await responseMessage(response));

        const body = (await response.json()) as {
          readonly conversation?: WhatsAppConversation;
        };
        if (!body.conversation) throw new Error('A conversa retornada é inválida.');

        if (messagePage === 1) {
          replaceConversation(body.conversation, false);
        } else {
          setConversations((currentConversations) =>
            currentConversations.map((currentConversation) => {
              if (currentConversation.id !== body.conversation!.id) {
                return currentConversation;
              }

              const messagesById = new Map(
                currentConversation.messages.map((message) => [message.id, message]),
              );
              body.conversation!.messages.forEach((message) => {
                messagesById.set(message.id, message);
              });
              const messages = [...messagesById.values()].sort((first, second) => {
                const difference = Date.parse(first.occurredAt) - Date.parse(second.occurredAt);
                return difference === 0 ? first.id.localeCompare(second.id) : difference;
              });

              return {
                ...body.conversation!,
                messages,
              };
            }),
          );
        }
        setLoadedConversationIds((current) => new Set([...current, body.conversation!.id]));
      } catch (error) {
        setDetailError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o histórico completo.',
        );
      } finally {
        if (messagePage === 1) setIsLoadingDetail(false);
        else setIsLoadingOlderMessages(false);
      }
    },
    [pushRoute, replaceConversation],
  );

  const refreshList = useCallback(
    async (showProgress = false): Promise<boolean> => {
      if (showProgress) setIsRefreshing(true);
      listAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      listAbortControllerRef.current = abortController;

      try {
        const searchParams = new URLSearchParams({
          page: String(listPage),
          pageSize: String(pagination.pageSize),
          archive: archiveView,
        });
        if (debouncedSearchTerm.trim()) searchParams.set('search', debouncedSearchTerm.trim());
        if (departmentFilter !== 'all') searchParams.set('department', departmentFilter);
        if (controlFilter !== 'all') searchParams.set('control', controlFilter);
        if (requestStatusFilter !== 'all') {
          searchParams.set('requestStatus', requestStatusFilter);
        }

        const response = await fetch(`/api/whatsapp-conversations?${searchParams.toString()}`, {
          cache: 'no-store',
          signal: abortController.signal,
        });

        if (response.status === 401) {
          pushRoute('/auth/session-expired');
          return false;
        }
        if (!response.ok) throw new Error(await responseMessage(response));

        const body = (await response.json()) as {
          readonly conversations?: readonly WhatsAppConversation[];
          readonly pagination?: {
            readonly page: number;
            readonly pageSize: number;
            readonly total: number;
            readonly totalPages: number;
          };
          readonly metrics?: WhatsAppConversationMetrics;
        };
        if (!Array.isArray(body.conversations)) {
          throw new Error('A lista de conversas retornada é inválida.');
        }
        const nextPagination = body.pagination ?? {
          page: listPage,
          pageSize: pagination.pageSize,
          total: body.conversations.length,
          totalPages: body.conversations.length > 0 ? 1 : 0,
        };
        const nextMetrics = body.metrics ?? getWhatsAppConversationMetrics(body.conversations);

        const previous = conversationsRef.current;
        const selectedId = selectedConversationIdRef.current;
        const previousSelected = previous.find((conversation) => conversation.id === selectedId);
        const incomingSelected = body.conversations.find(
          (conversation) => conversation.id === selectedId,
        );

        setConversations((current) =>
          preserveLoadedConversationHistory(current, body.conversations ?? []),
        );
        setPagination(nextPagination);
        setMetrics(nextMetrics);
        setListError('');

        if (selectedId && !incomingSelected && selectedId !== requestedConversationId) {
          setSelectedConversationId(body.conversations[0]?.id ?? null);
          setMobileDetailOpen(false);
        }

        if (
          selectedId &&
          incomingSelected &&
          (!previousSelected ||
            incomingSelected.version !== previousSelected.version ||
            incomingSelected.updatedAt !== previousSelected.updatedAt ||
            hasPendingOutboundMessage(previousSelected))
        ) {
          await loadConversationDetail(selectedId);
        }
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return false;
        const message =
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar a lista de conversas.';
        setListError(message);
        return false;
      } finally {
        if (listAbortControllerRef.current === abortController) {
          listAbortControllerRef.current = null;
        }
        if (showProgress) setIsRefreshing(false);
      }
    },
    [
      controlFilter,
      archiveView,
      debouncedSearchTerm,
      departmentFilter,
      listPage,
      loadConversationDetail,
      pagination.pageSize,
      requestStatusFilter,
      requestedConversationId,
      pushRoute,
    ],
  );

  useEffect(() => {
    if (!requestedConversationId) return;
    const timeout = window.setTimeout(() => {
      setSelectedConversationId(requestedConversationId);
      setMobileDetailOpen(true);
      void loadConversationDetail(requestedConversationId);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadConversationDetail, requestedConversationId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setListPage(1);
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (skipImmediateListRefreshRef.current) {
      skipImmediateListRefreshRef.current = false;
      return;
    }
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const schedule = (delay: number) => {
      timeout = setTimeout(runPolling, delay);
    };

    const runPolling = async () => {
      if (stopped) return;

      if (document.visibilityState === 'hidden') {
        schedule(POLLING_MAX_DELAY_MS);
        return;
      }

      const succeeded = await refreshList();
      if (succeeded) {
        pollingFailureCountRef.current = 0;
      } else {
        pollingFailureCountRef.current += 1;
      }

      const delay = Math.min(
        POLLING_BASE_DELAY_MS * 2 ** pollingFailureCountRef.current,
        POLLING_MAX_DELAY_MS,
      );
      schedule(delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (timeout) clearTimeout(timeout);
      void runPolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    schedule(POLLING_BASE_DELAY_MS);

    return () => {
      stopped = true;
      if (timeout) clearTimeout(timeout);
      listAbortControllerRef.current?.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshList]);

  useEffect(() => {
    if (selectedConversationId && !loadedConversationIds.has(selectedConversationId)) {
      const timeout = setTimeout(() => {
        void loadConversationDetail(selectedConversationId);
      }, 0);

      return () => clearTimeout(timeout);
    }
  }, [loadConversationDetail, loadedConversationIds, selectedConversationId]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchTerm);

    return conversations.filter((conversation) => {
      const matchesDepartment =
        departmentFilter === 'all' || conversation.department === departmentFilter;
      const matchesControl =
        controlFilter === 'all' ||
        getConversationControl(conversation.conversationState) === controlFilter;
      const matchesRequestStatus =
        requestStatusFilter === 'all' ||
        (conversation.department === 'commercial' &&
          conversation.requestStatus === requestStatusFilter);
      const matchesSearch =
        normalizedQuery.length === 0 || conversationMatchesSearch(conversation, normalizedQuery);
      const matchesInboxView = inboxView === 'all' || conversation.unreadCount > 0;

      return (
        matchesDepartment &&
        matchesControl &&
        matchesRequestStatus &&
        matchesSearch &&
        matchesInboxView
      );
    });
  }, [conversations, controlFilter, departmentFilter, inboxView, requestStatusFilter, searchTerm]);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const paginationNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
    const end = Math.min(pagination.totalPages, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }, [pagination.page, pagination.totalPages]);
  const effectiveTargetDepartment =
    selectedConversation !== null && targetDepartment === selectedConversation.department
      ? getDefaultTargetDepartment(selectedConversation.department)
      : targetDepartment;
  const selectedTransferTarget =
    initialAssignmentTargets.find((target) => target.id === transferDepartmentId) ?? null;
  const availableReturnQueues = initialAssignmentTargets.flatMap((target) =>
    target.queues.map((queue) => ({ ...queue, departmentName: target.name })),
  );
  const canCurrentUserSendMessage =
    permissions.respond &&
    selectedConversation !== null &&
    canSendHumanWhatsAppMessage(selectedConversation) &&
    selectedConversation.assignedTo?.id === currentUserId;
  const actionHistory = selectedConversation?.transitions ?? [];

  function handleClientHeaderClick() {
    if (!selectedConversation || isResolvingClient) return;
    startClientLookup(async () => {
      const result = await findClientByPhoneAction(selectedConversation.contact.phone);
      if (result.status === 'found') {
        pushRoute(`/clients/${result.clientId}`);
        return;
      }
      if (result.status === 'not-found') {
        setIsClientMissingDialogOpen(true);
        return;
      }
      toast.add({ title: 'Cliente não localizado', description: result.message, type: 'error' });
    });
  }

  function applyActionResult(result: WhatsAppConversationActionResult, successMessage: string) {
    if (result.conversation) {
      replaceConversation(result.conversation, result.success);
      setTargetDepartment(getDefaultTargetDepartment(result.conversation.department));
    }
    setFeedbackMessage(result.success ? successMessage : result.message);
    setFeedbackTone(result.success ? 'success' : 'error');

    if (result.conversation) {
      void loadConversationDetail(result.conversation.id);
    }
  }

  function handleConversationSelection(conversation: WhatsAppConversation) {
    setSelectedConversationId(conversation.id);
    setMobileDetailOpen(true);
    setMobileContextOpen(false);
    setTargetDepartment(getDefaultTargetDepartment(conversation.department));
    setFeedbackMessage('');
    setFeedbackTone('neutral');
    setDetailError('');
    setMessageDraft('');
    setIsCloseDialogOpen(false);
    setIsForwardDialogOpen(false);
    setIsDepartmentDialogOpen(false);
    setIsStatusDialogOpen(false);
    setIsHistoryDialogOpen(false);
    setIsQuoteDialogOpen(false);
    setIsMessageSearchOpen(false);
    setCloseReason('');
    setManualCommercialStatus(
      isManualCommercialStatus(conversation.requestStatus)
        ? conversation.requestStatus
        : 'under-review',
    );
    setManualCommercialStatusReason('');
    humanMessageSubmissionRef.current = null;
    replaceRoute(
      `/whatsapp-conversations?conversationId=${encodeURIComponent(conversation.id)}`,
      {
        scroll: false,
      },
    );

    if (conversation.unreadCount === 0 || !permissions.respond) return;

    startReadTransition(async () => {
      const result = await markWhatsAppConversationAsReadAction({
        conversationId: conversation.id,
        expectedVersion: conversation.version,
      });
      applyActionResult(result, 'Conversa marcada como lida.');
    });
  }

  function handleVersionedAction(
    action: (input: {
      readonly conversationId: unknown;
      readonly serviceSessionId: unknown;
      readonly expectedVersion: unknown;
      readonly commandId: unknown;
    }) => Promise<WhatsAppConversationActionResult>,
    successMessage: string,
  ) {
    if (!selectedConversation) return;
    setFeedbackMessage('');
    setFeedbackTone('neutral');

    startConversationTransition(async () => {
      const result = await action({
        conversationId: selectedConversation.id,
        serviceSessionId: getCurrentWhatsAppServiceSession(selectedConversation).id,
        expectedVersion: getCurrentWhatsAppServiceSession(selectedConversation).version,
        commandId: globalThis.crypto.randomUUID(),
      });
      applyActionResult(result, successMessage);
    });
  }

  function handleStartConversation() {
    setFeedbackMessage('');
    setFeedbackTone('neutral');

    startConversationTransition(async () => {
      const result = await startWhatsAppConversationAction({ phone: newConversationPhone });
      if (!result.success) {
        setFeedbackMessage(result.message);
        setFeedbackTone('error');
        return;
      }

      const conversation = result.conversation;
      setConversations((current) => [
        conversation,
        ...current.filter((candidate) => candidate.id !== conversation.id),
      ]);
      setLoadedConversationIds((current) => {
        const next = new Set(current);
        next.delete(conversation.id);
        return next;
      });
      setSelectedConversationId(conversation.id);
      setMobileDetailOpen(true);
      setTargetDepartment(getDefaultTargetDepartment(conversation.department));
      setNewConversationPhone('');
      setIsStartConversationDialogOpen(false);
      setFeedbackMessage('Atendimento iniciado com sucesso.');
      setFeedbackTone('success');
    });
  }

  function handleForward() {
    if (!selectedConversation) return;
    setFeedbackMessage('');
    setFeedbackTone('neutral');

    startConversationTransition(async () => {
      const serviceSession = getCurrentWhatsAppServiceSession(selectedConversation);
      const result = await transferWhatsAppServiceSessionAction({
        conversationId: selectedConversation.id,
        serviceSessionId: serviceSession.id,
        expectedVersion: serviceSession.version,
        commandId: globalThis.crypto.randomUUID(),
        departmentId: transferDepartmentId,
        queueId: transferQueueId || undefined,
        userId: transferUserId || undefined,
        reason: transferReason.trim() || undefined,
      });
      applyActionResult(result, 'Atendimento encaminhado com sucesso.');
      if (result.success) {
        setIsForwardDialogOpen(false);
        setTransferReason('');
      }
    });
  }

  function openTransferDialog() {
    if (!selectedConversation) return;
    const serviceSession = getCurrentWhatsAppServiceSession(selectedConversation);
    const target =
      initialAssignmentTargets.find(
        (candidate) =>
          candidate.id !== serviceSession.currentDepartmentId &&
          candidate.code !== selectedConversation.department,
      ) ?? initialAssignmentTargets[0];
    setTransferDepartmentId(target?.id ?? '');
    setTransferQueueId(target?.queues[0]?.id ?? '');
    setTransferUserId('');
    setTransferReason('');
    setIsForwardDialogOpen(true);
  }

  function openReturnQueueDialog() {
    if (!selectedConversation) return;
    const serviceSession = getCurrentWhatsAppServiceSession(selectedConversation);
    const queue =
      availableReturnQueues.find((candidate) => candidate.id === serviceSession.queueId) ??
      availableReturnQueues[0];
    setReturnQueueId(queue?.id ?? '');
    setIsReturnQueueDialogOpen(true);
  }

  function handleReturnToQueue() {
    if (!selectedConversation || !returnQueueId) return;
    const serviceSession = getCurrentWhatsAppServiceSession(selectedConversation);
    startConversationTransition(async () => {
      const result = await returnWhatsAppConversationToQueueAction({
        conversationId: selectedConversation.id,
        serviceSessionId: serviceSession.id,
        commandId: globalThis.crypto.randomUUID(),
        expectedVersion: serviceSession.version,
        queueId: returnQueueId,
      });
      applyActionResult(result, 'Atendimento retornado à fila.');
      if (result.success) setIsReturnQueueDialogOpen(false);
    });
  }

  function handlePriorityChange(priority: WhatsAppServiceSessionPriority, reason: string) {
    if (!selectedConversation) return;
    startConversationTransition(async () => {
      const result = await changeWhatsAppConversationPriorityAction({
        conversationId: selectedConversation.id,
        serviceSessionId: getCurrentWhatsAppServiceSession(selectedConversation).id,
        commandId: globalThis.crypto.randomUUID(),
        expectedVersion: getCurrentWhatsAppServiceSession(selectedConversation).version,
        priority,
        reason,
      });
      applyActionResult(result, 'Prioridade do atendimento atualizada.');
    });
  }

  function handleDepartmentChange() {
    if (!selectedConversation) return;
    startConversationTransition(async () => {
      const result = await changeWhatsAppConversationDepartmentAction({
        conversationId: selectedConversation.id,
        expectedVersion: selectedConversation.version,
        targetDepartment: effectiveTargetDepartment,
      });
      applyActionResult(result, 'Departamento da conversa atualizado.');
      if (result.success) setIsDepartmentDialogOpen(false);
    });
  }

  function handleArchiveToggle() {
    if (!selectedConversation) return;
    const isArchived = Boolean(selectedConversation.archivedAt);
    startConversationTransition(async () => {
      const action = isArchived
        ? unarchiveWhatsAppConversationAction
        : archiveWhatsAppConversationAction;
      const result = await action({
        conversationId: selectedConversation.id,
        expectedVersion: selectedConversation.version,
      });
      applyActionResult(result, isArchived ? 'Conversa desarquivada.' : 'Conversa arquivada.');
      if (result.success) await refreshList(true);
    });
  }

  function handleClose() {
    if (!selectedConversation) return;
    setFeedbackMessage('');
    setFeedbackTone('neutral');

    startConversationTransition(async () => {
      const result = await closeWhatsAppConversationAction({
        conversationId: selectedConversation.id,
        serviceSessionId: getCurrentWhatsAppServiceSession(selectedConversation).id,
        commandId: globalThis.crypto.randomUUID(),
        expectedVersion: getCurrentWhatsAppServiceSession(selectedConversation).version,
        reason: closeReason.trim(),
      });
      const successMessage =
        'Atendimento encerrado. O próximo contato será iniciado pelo bot no menu principal.';
      applyActionResult(result, successMessage);

      toast.add({
        title: result.success ? 'Atendimento encerrado' : 'Não foi possível encerrar',
        description: result.success
          ? successMessage
          : userFacingMessage(
              result.message,
              'Não foi possível encerrar o atendimento. Tente novamente.',
            ),
        type: result.success ? 'success' : 'error',
      });

      if (result.success) {
        setIsCloseDialogOpen(false);
        setCloseReason('');
      }
    });
  }

  function handleManualCommercialStatus() {
    if (!selectedConversation?.currentQuoteRequest) return;
    setFeedbackMessage('');
    setFeedbackTone('neutral');

    startConversationTransition(async () => {
      const result = await updateQuoteProposalStatusAction({
        quoteRequestId: selectedConversation.currentQuoteRequest!.id,
        commandId: crypto.randomUUID(),
        expectedVersion: selectedConversation.version,
        status: manualCommercialStatus,
        reason: manualCommercialStatusReason.trim() || undefined,
      });
      if (!result.success) {
        setFeedbackMessage(result.message);
        setFeedbackTone('error');
        if (result.code === 'conflict') await refreshList(true);
        return;
      }

      setFeedbackMessage('Status comercial atualizado com sucesso.');
      setFeedbackTone('success');
      setManualCommercialStatusReason('');
      await refreshList(true);
      await loadConversationDetail(selectedConversation.id);
      setIsStatusDialogOpen(false);
    });
  }

  function applyHumanMessageResult(result: SendHumanWhatsAppMessageActionResult): void {
    if (!result.success) {
      if (result.conversation) {
        replaceConversation(result.conversation, false);
        setTargetDepartment(getDefaultTargetDepartment(result.conversation.department));

        if (
          result.code === 'conflict' &&
          humanMessageSubmissionRef.current?.conversationId === result.conversation.id
        ) {
          humanMessageSubmissionRef.current = {
            ...humanMessageSubmissionRef.current,
            expectedVersion: result.conversation.version,
          };
        }
      }
      setFeedbackMessage(result.message);
      setFeedbackTone('error');
      return;
    }

    setConversations((currentConversations) =>
      currentConversations.map((conversation) => {
        if (conversation.id !== result.conversation.id) return conversation;

        const existingMessages =
          result.conversation.messages.length > 0
            ? [...result.conversation.messages]
            : [...conversation.messages];
        const existingIndex = existingMessages.findIndex(
          (message) => message.id === result.message.id,
        );

        if (existingIndex >= 0) {
          existingMessages[existingIndex] = result.message;
        } else {
          existingMessages.push(result.message);
        }

        existingMessages.sort((first, second) => {
          const difference = Date.parse(first.occurredAt) - Date.parse(second.occurredAt);
          return difference === 0 ? first.id.localeCompare(second.id) : difference;
        });

        return {
          ...result.conversation,
          messages: existingMessages,
          transitions:
            result.conversation.transitions.length > 0
              ? result.conversation.transitions
              : conversation.transitions,
        };
      }),
    );
    setTargetDepartment(getDefaultTargetDepartment(result.conversation.department));
    setMessageDraft('');
    setSelectedAttachment(null);
    setSelectedAttachmentKind('auto');
    humanMessageSubmissionRef.current = null;
    humanMediaSubmissionRef.current = null;
    setFeedbackMessage('Mensagem salva. Aguardando confirmação de envio.');
    setFeedbackTone('success');
    setLoadedConversationIds((current) => new Set([...current, result.conversation.id]));
    void loadConversationDetail(result.conversation.id);
  }

  function handleSendHumanMessage(): void {
    if (!selectedConversation || !canCurrentUserSendMessage || isSendingMessage) return;

    const text = messageDraft.trim();
    if (
      (text.length === 0 && selectedAttachment === null) ||
      text.length > HUMAN_WHATSAPP_MESSAGE_MAX_LENGTH
    ) {
      setFeedbackMessage(
        text.length === 0
          ? 'Digite uma mensagem antes de enviar.'
          : `A mensagem deve ter no máximo ${HUMAN_WHATSAPP_MESSAGE_MAX_LENGTH.toLocaleString(
              'pt-BR',
            )} caracteres.`,
      );
      setFeedbackTone('error');
      return;
    }

    if (selectedAttachment !== null) {
      let mediaSubmission = humanMediaSubmissionRef.current;
      if (
        mediaSubmission === null ||
        mediaSubmission.conversationId !== selectedConversation.id ||
        mediaSubmission.caption !== text ||
        mediaSubmission.file !== selectedAttachment ||
        mediaSubmission.mediaKind !== selectedAttachmentKind
      ) {
        mediaSubmission = {
          conversationId: selectedConversation.id,
          commandId: globalThis.crypto.randomUUID(),
          idempotencyKey: globalThis.crypto.randomUUID(),
          expectedVersion: selectedConversation.version,
          caption: text,
          file: selectedAttachment,
          mediaKind: selectedAttachmentKind,
        };
        humanMediaSubmissionRef.current = mediaSubmission;
      }

      setFeedbackMessage('');
      setFeedbackTone('neutral');
      startMessageTransition(async () => {
        const formData = new FormData();
        formData.set('file', mediaSubmission!.file);
        formData.set('commandId', mediaSubmission!.commandId);
        formData.set('idempotencyKey', mediaSubmission!.idempotencyKey);
        formData.set('expectedVersion', String(mediaSubmission!.expectedVersion));
        formData.set('mediaKind', mediaSubmission!.mediaKind);
        if (mediaSubmission!.caption) formData.set('caption', mediaSubmission!.caption);

        try {
          const response = await fetch(
            `/api/whatsapp-conversations/${encodeURIComponent(mediaSubmission!.conversationId)}/media`,
            { method: 'POST', body: formData },
          );
          const payload = (await response.json().catch(() => null)) as { message?: unknown } | null;
          if (!response.ok) {
            const message = typeof payload?.message === 'string' ? payload.message : '';
            setFeedbackMessage(
              userFacingMessage(message, 'Não foi possível enviar o anexo. Tente novamente.'),
            );
            setFeedbackTone('error');
            if (response.status === 409) await refreshList(true);
            return;
          }

          setMessageDraft('');
          setSelectedAttachment(null);
          setSelectedAttachmentKind('auto');
          humanMediaSubmissionRef.current = null;
          humanMessageSubmissionRef.current = null;
          setFeedbackMessage('Anexo salvo. Aguardando confirmação de envio.');
          setFeedbackTone('success');
          await refreshList(true);
          await loadConversationDetail(mediaSubmission!.conversationId);
        } catch {
          setFeedbackMessage(
            'Não foi possível enviar o anexo. Verifique sua conexão e tente novamente.',
          );
          setFeedbackTone('error');
        }
      });
      return;
    }

    let submission = humanMessageSubmissionRef.current;
    if (
      submission === null ||
      submission.conversationId !== selectedConversation.id ||
      submission.text !== text
    ) {
      submission = {
        conversationId: selectedConversation.id,
        commandId: globalThis.crypto.randomUUID(),
        idempotencyKey: globalThis.crypto.randomUUID(),
        expectedVersion: selectedConversation.version,
        text,
      };
      humanMessageSubmissionRef.current = submission;
    }

    setFeedbackMessage('');
    setFeedbackTone('neutral');

    startMessageTransition(async () => {
      const result = await sendHumanWhatsAppMessageAction({
        conversationId: submission!.conversationId,
        commandId: submission!.commandId,
        idempotencyKey: submission!.idempotencyKey,
        expectedVersion: submission!.expectedVersion,
        text: submission!.text,
      });
      applyHumanMessageResult(result);
    });
  }

  return (
    <>
      <Dialog open={isStartConversationDialogOpen} onOpenChange={setIsStartConversationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar nova conversa</DialogTitle>
            <DialogDescription>
              Informe o número com DDD. O canal e o atendimento serão preparados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="new-whatsapp-conversation-phone" className="text-sm font-medium">
              Número do WhatsApp
            </label>
            <Input
              id="new-whatsapp-conversation-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={newConversationPhone}
              onChange={(event) => setNewConversationPhone(event.target.value)}
              placeholder="(34) 99999-9999"
              disabled={isUpdatingConversation}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button
              type="button"
              onClick={handleStartConversation}
              disabled={
                isUpdatingConversation || newConversationPhone.replace(/\D/g, '').length < 10
              }
            >
              {isUpdatingConversation ? 'Iniciando...' : 'Iniciar atendimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <section aria-labelledby="conversation-workspace-title" className={styles.section()}>
        <h2 id="conversation-workspace-title" className={styles.visuallyHidden()}>
          Caixa de entrada de conversas
        </h2>

        <aside className={cn(styles.sidebar(), mobileDetailOpen ? 'hidden lg:flex' : 'flex')}>
          <div className={styles.sidebarHeader()}>
            <div className={styles.sidebarHeading()}>
              <div>
                <p className={styles.sidebarEyebrow()}>Conversas</p>
                <p className={styles.sidebarTitle()}>
                  {pagination.total === 1 ? '1 conversa' : `${pagination.total} conversas`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshList(true)}
                  disabled={isRefreshing}
                  className={styles.refreshButton()}
                  aria-label={isRefreshing ? 'Atualizando conversas' : 'Atualizar conversas'}
                  title={isRefreshing ? 'Atualizando conversas' : 'Atualizar conversas'}
                >
                  <RefreshCw aria-hidden="true" />
                </button>
                {permissions.respond ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Nova conversa"
                    title="Nova conversa"
                    onClick={() => setIsStartConversationDialogOpen(true)}
                  >
                    <MessageSquarePlus aria-hidden="true" />
                  </Button>
                ) : null}
                {permissions.legacyManagement ? (
                  <Link
                    href="/whatsapp-conversations/import"
                    className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
                    aria-label="Importar históricos"
                    title="Importar históricos"
                  >
                    <FileUp aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </div>

            {listError ? (
              <div className={styles.errorBanner()}>
                <AlertCircle aria-hidden="true" />
                <span>A lista não pôde ser atualizada.</span>
                <button type="button" onClick={() => void refreshList(true)}>
                  Tentar novamente
                </button>
              </div>
            ) : null}

            <div className={styles.searchContainer()}>
              <Search aria-hidden="true" className={styles.searchIcon()} />
              <label htmlFor="conversation-search" className={styles.visuallyHidden()}>
                Buscar conversas
              </label>
              <input
                id="conversation-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar ou começar nova conversa"
                className={styles.searchInput()}
              />
            </div>

            <div className={styles.quickFilters()} aria-label="Filtros rápidos das conversas">
              <button
                type="button"
                className={styles.quickFilter({ active: inboxView === 'all' })}
                onClick={() => setInboxView('all')}
              >
                Tudo
              </button>
              <button
                type="button"
                className={styles.quickFilter()}
                disabled
                title="Favoritos estarão disponíveis em uma próxima atualização"
              >
                Favoritas
              </button>
              <button
                type="button"
                className={styles.quickFilter()}
                disabled
                title="Grupos não fazem parte do atendimento individual"
              >
                Grupos
              </button>
              {metrics.unreadConversations > 0 ? (
                <button
                  type="button"
                  className={styles.quickFilter({ active: inboxView === 'unread' })}
                  onClick={() => setInboxView('unread')}
                >
                  Não lidas {metrics.unreadConversations}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.quickFilter({ active: archiveView === 'archived' })}
                onClick={() => {
                  setArchiveView((current) => (current === 'active' ? 'archived' : 'active'));
                  setListPage(1);
                  setSelectedConversationId(null);
                }}
              >
                {archiveView === 'archived' ? 'Voltar às ativas' : 'Arquivadas'}
              </button>
            </div>

            <details className={styles.advancedFilters()}>
              <summary>Mais filtros</summary>
              <div className={styles.filters()}>
                <div>
                  <label htmlFor="department-filter" className={styles.filterLabel()}>
                    Departamento
                  </label>
                  <select
                    id="department-filter"
                    className={styles.filterSelect()}
                    value={departmentFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setListPage(1);
                      setDepartmentFilter(isWhatsAppConversationDepartment(value) ? value : 'all');
                    }}
                  >
                    <option value="all">Todos</option>
                    {WHATSAPP_ROUTABLE_DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>
                        {DEPARTMENT_LABELS[department]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="control-filter" className={styles.filterLabel()}>
                    Condução
                  </label>
                  <Select
                    value={controlFilter}
                    onValueChange={(value) => {
                      setListPage(1);
                      setControlFilter(
                        value === 'bot' ||
                          value === 'human' ||
                          value === 'paused' ||
                          value === 'closed'
                          ? value
                          : 'all',
                      );
                    }}
                  >
                    <SelectTrigger id="control-filter" className={styles.filterSelect()}>
                      <span>
                        {controlFilter === 'all'
                          ? 'Todas'
                          : controlFilter === 'bot'
                            ? 'Bot ativo'
                            : controlFilter === 'human'
                              ? 'Atendente ativo'
                              : controlFilter === 'paused'
                                ? 'Bot bloqueado'
                                : 'Encerrada'}
                      </span>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="bot">Bot ativo</SelectItem>
                      <SelectItem value="human">Atendente ativo</SelectItem>
                      <SelectItem value="paused">Bot bloqueado</SelectItem>
                      <SelectItem value="closed">Encerrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className={styles.wideFilter()}>
                  <label htmlFor="request-status-filter" className={styles.filterLabel()}>
                    Status comercial
                  </label>
                  <Select
                    value={requestStatusFilter}
                    onValueChange={(value) => {
                      setListPage(1);
                      setRequestStatusFilter(
                        typeof value === 'string' &&
                          (WHATSAPP_REQUEST_STATUSES as readonly string[]).includes(value)
                          ? (value as WhatsAppRequestStatus)
                          : 'all',
                      );
                    }}
                  >
                    <SelectTrigger id="request-status-filter" className={styles.filterSelect()}>
                      <span>
                        {requestStatusFilter === 'all'
                          ? 'Todos os status'
                          : REQUEST_STATUS_LABELS[requestStatusFilter]}
                      </span>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {WHATSAPP_REQUEST_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {REQUEST_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </details>
          </div>

          <ConversationInboxList
            conversations={filteredConversations}
            selectedConversationId={selectedConversation?.id ?? null}
            isRefreshing={isRefreshing}
            hasError={Boolean(listError)}
            pagination={pagination}
            paginationNumbers={paginationNumbers}
            onSelect={handleConversationSelection}
            onPageChange={setListPage}
          />
        </aside>

        <div
          className={cn(
            styles.detail(),
            mobileContextOpen ? 'hidden xl:flex' : mobileDetailOpen ? 'flex' : 'hidden lg:flex',
          )}
        >
          {selectedConversation !== null ? (
            <>
              <header className={styles.detailHeader()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="lg:hidden"
                  onClick={() => setMobileDetailOpen(false)}
                  aria-label="Voltar para a caixa de entrada"
                >
                  <ArrowLeft aria-hidden="true" />
                </Button>
                <button
                  type="button"
                  className={styles.contactBlock()}
                  onClick={handleClientHeaderClick}
                  disabled={isResolvingClient}
                  aria-label={`Abrir cadastro de ${selectedConversation.contact.name}`}
                >
                  <Avatar className={styles.detailAvatar()}>
                    {selectedConversation.contact.profilePictureUrl ? (
                      <AvatarImage
                        src={selectedConversation.contact.profilePictureUrl}
                        alt={`Foto de ${selectedConversation.contact.name}`}
                      />
                    ) : null}
                    <AvatarFallback>
                      {getContactInitial(selectedConversation.contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={styles.contactIdentity()}>
                    <h3 className={styles.detailTitle()}>{selectedConversation.contact.name}</h3>
                    <p className={styles.phone()}>
                      <Phone aria-hidden="true" />
                      {selectedConversation.contact.phone}
                    </p>
                    <p className={styles.lastInteraction()}>
                      Última interação: {formatDateTime(selectedConversation.lastMessageAt)}
                    </p>
                  </div>
                </button>
                <div className={styles.headerAssignment()} aria-label="Ferramentas da conversa">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="xl:hidden"
                    onClick={() => setMobileContextOpen(true)}
                    aria-label="Abrir contexto do atendimento"
                    title="Contexto do atendimento"
                  >
                    <PanelRightOpen aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsQuoteDialogOpen(true)}
                    aria-label="Abrir orçamentos"
                    title="Orçamentos"
                  >
                    <FileText aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant={isMessageSearchOpen ? 'secondary' : 'ghost'}
                    size="icon-sm"
                    onClick={() => setIsMessageSearchOpen((current) => !current)}
                    aria-label="Pesquisar mensagens"
                    title="Pesquisar mensagens"
                  >
                    <Search aria-hidden="true" />
                  </Button>
                </div>
              </header>

              <div className={cn(styles.dimensionGrid(), 'xl:hidden')}>
                <button
                  type="button"
                  className={styles.dimensionItem()}
                  onClick={() => setIsDepartmentDialogOpen(true)}
                  disabled={!permissions.transfer}
                  aria-label="Alterar departamento"
                  title="Alterar departamento"
                >
                  <Building2 aria-hidden="true" />
                  <span>
                    <small>Departamento</small>
                    <strong>{DEPARTMENT_LABELS[selectedConversation.department]}</strong>
                  </span>
                </button>
                <div className={styles.dimensionItem()}>
                  <Bot aria-hidden="true" />
                  <span>
                    <small>Estado da conversa</small>
                    <strong>
                      {CONVERSATION_STATE_LABELS[selectedConversation.conversationState]}
                    </strong>
                  </span>
                </div>
                <div className={styles.dimensionItem()}>
                  <RotateCcw aria-hidden="true" />
                  <span>
                    <small>Etapa do fluxo</small>
                    <strong>{getFlowStepLabel(selectedConversation)}</strong>
                  </span>
                </div>
                <div className={styles.dimensionItem()}>
                  <MessageCircle aria-hidden="true" />
                  <span>
                    <small>Canal</small>
                    <strong>{selectedConversation.channel.name}</strong>
                  </span>
                </div>
                {selectedConversation.department === 'commercial' ? (
                  <div className={styles.dimensionItem()}>
                    <Clock3 aria-hidden="true" />
                    <span>
                      <small>Status comercial</small>
                      <strong>{REQUEST_STATUS_LABELS[selectedConversation.requestStatus]}</strong>
                    </span>
                  </div>
                ) : null}
              </div>

              <section
                className={cn(styles.actionsPanel(), 'xl:hidden')}
                aria-label="Ações compactas do atendimento"
              >
                <p className={styles.actionsTitle()}>Ações do atendimento</p>
                <div className={styles.actionColumns()}>
                  <div className={styles.actions()}>
                    <button
                      type="button"
                      onClick={handleArchiveToggle}
                      disabled={isUpdatingConversation || !permissions.legacyManagement}
                      className={styles.actionButton({ action: 'read' })}
                    >
                      {selectedConversation.archivedAt ? (
                        <ArchiveRestore aria-hidden="true" />
                      ) : (
                        <Archive aria-hidden="true" />
                      )}
                      {selectedConversation.archivedAt ? 'Desarquivar' : 'Arquivar'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleVersionedAction(
                          takeOverWhatsAppConversationAction,
                          'Atendimento assumido com sucesso.',
                        )
                      }
                      disabled={
                        isUpdatingConversation ||
                        !permissions.assume ||
                        selectedConversation.conversationState === 'closed' ||
                        !getCurrentWhatsAppServiceSession(
                          selectedConversation,
                        ).availableActions.includes('ASSUME')
                      }
                      className={styles.actionButton({ action: 'human' })}
                    >
                      <Headset aria-hidden="true" />
                      Atendente {isWhatsAppHumanActive(selectedConversation) ? 'ativo' : 'inativo'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleVersionedAction(
                          returnWhatsAppConversationToBotAction,
                          'Conversa devolvida ao bot na etapa permitida.',
                        )
                      }
                      disabled={
                        isUpdatingConversation ||
                        !permissions.transfer ||
                        !getCurrentWhatsAppServiceSession(
                          selectedConversation,
                        ).availableActions.includes('RETURN_TO_AI')
                      }
                      className={styles.actionButton({ action: 'bot' })}
                    >
                      <Bot aria-hidden="true" />
                      BOT {isWhatsAppBotBlocked(selectedConversation) ? 'inativo' : 'ativo'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        selectedConversation.conversationState === 'closed'
                          ? handleVersionedAction(
                              takeOverWhatsAppConversationAction,
                              'Atendimento iniciado com sucesso.',
                            )
                          : setIsCloseDialogOpen(true)
                      }
                      disabled={
                        isUpdatingConversation ||
                        (selectedConversation.conversationState === 'closed'
                          ? !permissions.assume
                          : !permissions.close) ||
                        (selectedConversation.conversationState !== 'closed' &&
                          !getCurrentWhatsAppServiceSession(
                            selectedConversation,
                          ).availableActions.includes('CLOSE'))
                      }
                      className={styles.actionButton({ action: 'close' })}
                    >
                      {selectedConversation.conversationState === 'closed' ? (
                        <Headset aria-hidden="true" />
                      ) : (
                        <CircleStop aria-hidden="true" />
                      )}
                      {selectedConversation.conversationState === 'closed' ? 'Iniciar' : 'Encerrar'}
                    </button>
                  </div>
                  <div className={styles.actions()}>
                    <button
                      type="button"
                      onClick={openTransferDialog}
                      disabled={
                        isUpdatingConversation ||
                        !permissions.transfer ||
                        !getCurrentWhatsAppServiceSession(
                          selectedConversation,
                        ).availableActions.includes('TRANSFER_DEPARTMENT')
                      }
                      className={styles.actionButton({ action: 'forward' })}
                    >
                      <Forward aria-hidden="true" />
                      Encaminhar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsStatusDialogOpen(true)}
                      disabled={
                        isUpdatingConversation ||
                        !permissions.respond ||
                        selectedConversation.department !== 'commercial' ||
                        selectedConversation.currentQuoteRequest === null ||
                        selectedConversation.conversationState === 'closed' ||
                        selectedConversation.assignedTo?.id !== currentUserId
                      }
                      className={styles.actionButton({ action: 'read' })}
                    >
                      <Clock3 aria-hidden="true" />
                      Alterar status
                    </button>
                  </div>
                </div>

                <Dialog open={isForwardDialogOpen} onOpenChange={setIsForwardDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Transferir atendimento</DialogTitle>
                      <DialogDescription>
                        Escolha um destino publicado pela Tenant API. Fila e responsável são
                        opcionais na transferência.
                      </DialogDescription>
                    </DialogHeader>
                    {initialAssignmentTargets.length ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label htmlFor="transfer-department" className="text-sm font-medium">
                            Departamento
                          </label>
                          <select
                            id="transfer-department"
                            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm"
                            aria-label="Departamento de destino"
                            value={transferDepartmentId}
                            onChange={(event) => {
                              const value = event.target.value;
                              const target = initialAssignmentTargets.find(
                                (candidate) => candidate.id === value,
                              );
                              setTransferDepartmentId(value);
                              setTransferQueueId(target?.queues[0]?.id ?? '');
                              setTransferUserId('');
                            }}
                            disabled={isUpdatingConversation}
                          >
                            <option value="">Selecione</option>
                            {initialAssignmentTargets
                              .filter(
                                (target) =>
                                  target.id !==
                                    getCurrentWhatsAppServiceSession(selectedConversation)
                                      .currentDepartmentId &&
                                  target.code !== selectedConversation.department,
                              )
                              .map((target) => (
                                <option key={target.id} value={target.id}>
                                  {target.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label htmlFor="transfer-queue" className="text-sm font-medium">
                              Fila
                            </label>
                            <Select
                              value={transferQueueId || 'none'}
                              onValueChange={(value) =>
                                setTransferQueueId(value === 'none' ? '' : (value ?? ''))
                              }
                              disabled={isUpdatingConversation || !selectedTransferTarget}
                            >
                              <SelectTrigger id="transfer-queue" className="w-full">
                                <span>
                                  {selectedTransferTarget?.queues.find(
                                    (queue) => queue.id === transferQueueId,
                                  )?.name ?? 'Sem fila específica'}
                                </span>
                              </SelectTrigger>
                              <SelectContent alignItemWithTrigger={false}>
                                <SelectItem value="none">Sem fila específica</SelectItem>
                                {selectedTransferTarget?.queues.map((queue) => (
                                  <SelectItem key={queue.id} value={queue.id}>
                                    {queue.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="transfer-user" className="text-sm font-medium">
                              Responsável
                            </label>
                            <Select
                              value={transferUserId || 'none'}
                              onValueChange={(value) =>
                                setTransferUserId(value === 'none' ? '' : (value ?? ''))
                              }
                              disabled={isUpdatingConversation || !selectedTransferTarget}
                            >
                              <SelectTrigger id="transfer-user" className="w-full">
                                <span>
                                  {selectedTransferTarget?.users.find(
                                    (user) => user.id === transferUserId,
                                  )?.name ?? 'Sem responsável específico'}
                                </span>
                              </SelectTrigger>
                              <SelectContent alignItemWithTrigger={false}>
                                <SelectItem value="none">Sem responsável específico</SelectItem>
                                {selectedTransferTarget?.users.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="transfer-reason" className="text-sm font-medium">
                            Motivo (opcional)
                          </label>
                          <Textarea
                            id="transfer-reason"
                            value={transferReason}
                            onChange={(event) => setTransferReason(event.target.value)}
                            minLength={3}
                            maxLength={500}
                            rows={2}
                            disabled={isUpdatingConversation}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning-emphasis">
                        Nenhum destino elegível foi publicado para este usuário. Atualize as
                        permissões ou tente novamente mais tarde.
                      </p>
                    )}
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
                      <Button
                        type="button"
                        onClick={handleForward}
                        disabled={
                          isUpdatingConversation ||
                          !transferDepartmentId ||
                          (transferReason.trim().length > 0 && transferReason.trim().length < 3)
                        }
                      >
                        <Forward aria-hidden="true" />
                        Confirmar transferência
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isReturnQueueDialogOpen} onOpenChange={setIsReturnQueueDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Retornar atendimento à fila</DialogTitle>
                      <DialogDescription>
                        O responsável atual será removido e o atendimento seguirá a estratégia da
                        fila selecionada.
                      </DialogDescription>
                    </DialogHeader>
                    {availableReturnQueues.length ? (
                      <Select
                        value={returnQueueId}
                        onValueChange={(value) => setReturnQueueId(value ?? '')}
                        disabled={isUpdatingConversation}
                      >
                        <SelectTrigger className="w-full" aria-label="Fila de retorno">
                          <span>
                            {availableReturnQueues.find((queue) => queue.id === returnQueueId)
                              ?.name ?? 'Selecione uma fila'}
                          </span>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          {availableReturnQueues.map((queue) => (
                            <SelectItem key={queue.id} value={queue.id}>
                              {queue.departmentName} · {queue.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning-emphasis">
                        Nenhuma fila elegível foi publicada para este usuário.
                      </p>
                    )}
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
                      <Button
                        type="button"
                        onClick={handleReturnToQueue}
                        disabled={isUpdatingConversation || !returnQueueId}
                      >
                        Retornar à fila
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Alterar departamento da conversa</DialogTitle>
                      <DialogDescription>
                        Corrija a classificação sem encaminhar nem alterar o responsável atual.
                      </DialogDescription>
                    </DialogHeader>
                    <select
                      className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm"
                      aria-label="Novo departamento"
                      value={effectiveTargetDepartment}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (isWhatsAppConversationDepartment(value)) setTargetDepartment(value);
                      }}
                      disabled={isUpdatingConversation}
                    >
                      {WHATSAPP_ROUTABLE_DEPARTMENTS.filter(
                        (department) => department !== selectedConversation.department,
                      ).map((department) => (
                        <option key={department} value={department}>
                          {DEPARTMENT_LABELS[department]}
                        </option>
                      ))}
                    </select>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
                      <Button
                        type="button"
                        onClick={handleDepartmentChange}
                        disabled={isUpdatingConversation}
                      >
                        <Building2 aria-hidden="true" />
                        Salvar departamento
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Alterar status comercial</DialogTitle>
                      <DialogDescription>
                        A alteração será registrada no histórico do atendimento.
                      </DialogDescription>
                    </DialogHeader>
                    <Select
                      value={manualCommercialStatus}
                      onValueChange={(value) => {
                        if (isManualCommercialStatus(value)) {
                          setManualCommercialStatus(value);
                          if (value !== 'rejected' && value !== 'cancelled') {
                            setManualCommercialStatusReason('');
                          }
                        }
                      }}
                      disabled={isUpdatingConversation}
                    >
                      <SelectTrigger className="w-full">
                        <span>{REQUEST_STATUS_LABELS[manualCommercialStatus]}</span>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {MANUAL_COMMERCIAL_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {REQUEST_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {manualCommercialStatus === 'rejected' ||
                    manualCommercialStatus === 'cancelled' ? (
                      <Textarea
                        aria-label="Motivo da alteração do status comercial"
                        value={manualCommercialStatusReason}
                        onChange={(event) => setManualCommercialStatusReason(event.target.value)}
                        minLength={3}
                        maxLength={500}
                        rows={3}
                        placeholder="Informe o motivo para manter a auditoria completa."
                      />
                    ) : null}
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
                      <Button
                        type="button"
                        onClick={handleManualCommercialStatus}
                        disabled={
                          isUpdatingConversation ||
                          manualCommercialStatus === selectedConversation.requestStatus ||
                          ((manualCommercialStatus === 'rejected' ||
                            manualCommercialStatus === 'cancelled') &&
                            manualCommercialStatusReason.trim().length < 3)
                        }
                      >
                        Atualizar status
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Encerrar este atendimento?</DialogTitle>
                      <DialogDescription>
                        A conversa atual será encerrada e preservada no histórico. Quando o cliente
                        enviar uma nova mensagem, o bot iniciará outro atendimento pelo menu
                        principal. O encerramento não é permitido enquanto houver uma proposta em
                        andamento.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <label htmlFor="close-reason" className="text-sm font-medium">
                        Motivo do encerramento (obrigatório)
                      </label>
                      <Textarea
                        id="close-reason"
                        value={closeReason}
                        onChange={(event) => setCloseReason(event.target.value)}
                        minLength={3}
                        maxLength={500}
                        required
                        placeholder={
                          selectedConversation.requestStatus === 'rejected'
                            ? 'Informe por que a proposta foi recusada.'
                            : 'Registre o motivo para manter a auditoria completa.'
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {closeReason.length}/500 caracteres
                      </p>
                    </div>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>Voltar</DialogClose>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleClose}
                        disabled={isUpdatingConversation || closeReason.trim().length < 3}
                      >
                        {isUpdatingConversation ? 'Encerrando...' : 'Confirmar encerramento'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </section>

              <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Orçamentos da conversa</DialogTitle>
                    <DialogDescription>
                      Consulte, crie ou atualize propostas ligadas a este atendimento.
                    </DialogDescription>
                  </DialogHeader>
                  <div className={styles.quoteActions()}>
                    <ConversationQuoteActions
                      conversation={selectedConversation}
                      currentUserId={currentUserId}
                      onChanged={() => {
                        void refreshList(true);
                        void loadConversationDetail(selectedConversation.id);
                      }}
                      onError={(message) => {
                        setFeedbackMessage(message);
                        setFeedbackTone('error');
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsHistoryDialogOpen(true)}
                    >
                      <History aria-hidden="true" />
                      Histórico
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <AlertDialog
                open={isClientMissingDialogOpen}
                onOpenChange={setIsClientMissingDialogOpen}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cliente ainda não cadastrado</AlertDialogTitle>
                    <AlertDialogDescription>
                      Este contato não possui cadastro de cliente. Você pode fechar este aviso ou
                      iniciar o cadastro com nome e telefone já preenchidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="outline" />}>
                      Fechar
                    </AlertDialogClose>
                    <Link
                      href={`/clients/new?name=${encodeURIComponent(selectedConversation.contact.name)}&phone=${encodeURIComponent(selectedConversation.contact.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants()}
                    >
                      Cadastrar
                    </Link>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <ConversationMessageSheet
                conversation={selectedConversation}
                isLoading={isLoadingDetail}
                isLoaded={loadedConversationIds.has(selectedConversation.id)}
                detailError={detailError}
                onRetry={() => void loadConversationDetail(selectedConversation.id)}
                onLoadOlder={() => {
                  const nextPage = (selectedConversation.messageHistory?.page ?? 1) + 1;
                  void loadConversationDetail(selectedConversation.id, nextPage);
                }}
                isLoadingOlder={isLoadingOlderMessages}
                searchOpen={isMessageSearchOpen}
                onSearchOpenChange={setIsMessageSearchOpen}
                messageDraft={messageDraft}
                onMessageDraftChange={setMessageDraft}
                selectedAttachment={selectedAttachment}
                onSelectedAttachmentChange={(file, kind = 'auto') => {
                  setSelectedAttachment(file);
                  setSelectedAttachmentKind(file ? kind : 'auto');
                  humanMediaSubmissionRef.current = null;
                }}
                canSendMessage={canCurrentUserSendMessage}
                isSendingMessage={isSendingMessage}
                onSendMessage={handleSendHumanMessage}
                feedbackMessage=""
                feedbackTone={feedbackTone}
                canManageMedia={permissions.respond}
              />

              <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Histórico de ações da conversa</DialogTitle>
                    <DialogDescription>
                      Alterações de condução, departamento, etapa e status em ordem cronológica.
                    </DialogDescription>
                  </DialogHeader>
                  {actionHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma ação foi registrada nesta conversa.
                    </p>
                  ) : (
                    <div className={styles.closureHistoryList()}>
                      {actionHistory.map((transition) => (
                        <article key={transition.id} className={styles.closureHistoryItem()}>
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <strong>{getTransitionLabel(transition.name)}</strong>
                            <time className="text-xs text-muted-foreground">
                              {formatDateTime(transition.createdAt)}
                            </time>
                          </div>
                          <dl>
                            <div>
                              <dt>Responsável</dt>
                              <dd>{getClosureActor(transition)}</dd>
                            </div>
                            <div>
                              <dt>Departamento</dt>
                              <dd>
                                {DEPARTMENT_LABELS[transition.from.department]} →{' '}
                                {DEPARTMENT_LABELS[transition.to.department]}
                              </dd>
                            </div>
                            <div>
                              <dt>Estado</dt>
                              <dd>
                                {CONVERSATION_STATE_LABELS[transition.from.conversationState]} →{' '}
                                {CONVERSATION_STATE_LABELS[transition.to.conversationState]}
                              </dd>
                            </div>
                            <div>
                              <dt>Motivo</dt>
                              <dd>{getClosureReason(transition) ?? 'Não informado'}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {isUpdatingConversation || (feedbackMessage && feedbackTone !== 'error') ? (
                <footer className={styles.detailFooter()}>
                  <p
                    aria-live="polite"
                    className={styles.feedback({
                      tone: feedbackTone,
                    })}
                  >
                    {isUpdatingConversation ? 'Atualizando atendimento...' : feedbackMessage}
                  </p>
                </footer>
              ) : null}
            </>
          ) : (
            <div className={styles.emptyDetail()}>
              <Inbox aria-hidden="true" className={styles.emptyDetailIcon()} />
              <p className={styles.emptyDetailTitle()}>Selecione uma conversa</p>
              <p className={styles.emptyDetailDescription()}>
                Os detalhes, o histórico e as ações do atendimento aparecerão aqui.
              </p>
            </div>
          )}
        </div>
        {selectedConversation ? (
          <div
            className={cn('h-full min-h-0 min-w-0', mobileContextOpen ? 'flex' : 'hidden xl:flex')}
          >
            <ConversationServiceContextPanel
              key={`${selectedConversation.id}:${getCurrentWhatsAppServiceSession(selectedConversation).version}`}
              conversation={selectedConversation}
              isBusy={isUpdatingConversation}
              onBack={() => setMobileContextOpen(false)}
              onAssume={() =>
                handleVersionedAction(
                  takeOverWhatsAppConversationAction,
                  'Atendimento assumido com sucesso.',
                )
              }
              onTransfer={openTransferDialog}
              onReturnToQueue={openReturnQueueDialog}
              onChangePriority={handlePriorityChange}
              onReturnToAi={() =>
                handleVersionedAction(
                  returnWhatsAppConversationToBotAction,
                  'Controle retornado explicitamente à IA.',
                )
              }
              onClose={() => setIsCloseDialogOpen(true)}
              onArchiveToggle={handleArchiveToggle}
              onCommercialStatus={() => setIsStatusDialogOpen(true)}
              canChangeCommercialStatus={
                permissions.respond &&
                selectedConversation.department === 'commercial' &&
                selectedConversation.currentQuoteRequest !== null &&
                selectedConversation.conversationState !== 'closed' &&
                selectedConversation.assignedTo?.id === currentUserId
              }
              canViewCustomerContext={canViewCustomerContext}
              canRespondCustomerContext={canRespondCustomerContext}
              canAssume={permissions.assume}
              canTransfer={permissions.transfer}
              canChangePriority={permissions.priority}
              canReturnToAi={permissions.transfer}
              canClose={permissions.close}
              canArchive={permissions.legacyManagement}
            />
          </div>
        ) : (
          <aside className="hidden h-full items-center justify-center border-l border-border bg-card px-5 text-center text-xs text-muted-foreground xl:flex">
            Selecione uma conversa para consultar o contexto do atendimento.
          </aside>
        )}
      </section>
    </>
  );
}
