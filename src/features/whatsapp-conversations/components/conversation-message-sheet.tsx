'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';

import {
  AlertCircle,
  Contact,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  ImagePlay,
  LoaderCircle,
  MessageCircleMore,
  Music,
  Paperclip,
  Search,
  Send,
  Smile,
  Sticker,
  X,
} from 'lucide-react';

import { CurrentUserAvatar } from '@/shared/current-user-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Bubble, BubbleContent } from '@/shared/ui/bubble';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { Message, MessageAvatar, MessageContent } from '@/shared/ui/message';
import { Skeleton } from '@/shared/ui/skeleton';
import { Textarea } from '@/shared/ui/textarea';
import { toast } from '@/shared/ui/toast';

import { HUMAN_WHATSAPP_MESSAGE_MAX_LENGTH } from '../application';
import type {
  WhatsAppConversation,
  WhatsAppMessageAttachment,
  WhatsAppMessageKind,
} from '../domain';
import { resolveConversationHistoryScrollTop } from './conversation-history-scroll';
import { MESSAGE_KIND_LABELS } from './conversation-labels';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/vcard': '.vcf',
  'text/x-vcard': '.vcf',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const EMOJI_OPTIONS = [
  ['😀', 'sorriso feliz'],
  ['😂', 'rindo lágrimas'],
  ['🥰', 'apaixonado carinho'],
  ['😍', 'amor olhos'],
  ['😊', 'feliz tímido'],
  ['😉', 'piscando'],
  ['😎', 'óculos legal'],
  ['🥳', 'festa'],
  ['😢', 'triste choro'],
  ['😭', 'chorando'],
  ['😡', 'bravo'],
  ['🤔', 'pensando'],
  ['👍', 'positivo gostei'],
  ['👎', 'negativo'],
  ['👏', 'palmas'],
  ['🙏', 'obrigado por favor'],
  ['🤝', 'acordo'],
  ['💪', 'força'],
  ['❤️', 'coração amor'],
  ['💚', 'coração verde'],
  ['✨', 'brilho'],
  ['✅', 'confirmado certo'],
  ['❌', 'errado cancelar'],
  ['⚠️', 'atenção'],
  ['🎉', 'comemoração'],
  ['🚐', 'van transporte'],
  ['🚌', 'ônibus transporte'],
  ['📍', 'localização'],
  ['📎', 'anexo'],
  ['📄', 'documento'],
] as const;

type AttachmentPickerKind = 'auto' | 'sticker';

function formatDateTime(value: string): string {
  return DATE_TIME_FORMATTER.format(new Date(value));
}

function formatFileSize(size: number | null): string {
  if (size === null) return 'Tamanho não informado';
  if (size < 1_024) return `${size} bytes`;
  if (size < 1_048_576) return `${(size / 1_024).toFixed(1)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?';
}

function normalizeAttachmentLabel(
  kind: WhatsAppMessageKind,
  attachment: WhatsAppMessageAttachment,
): string {
  const raw = attachment.fileName?.split(/[\\/]/).pop()?.trim() ?? '';
  const withoutEncryptedSuffix = raw.replace(/\.enc$/i, '');
  const mimeType = attachment.mimeType?.toLowerCase().split(';')[0] ?? '';
  const expectedExtension = MIME_EXTENSIONS[mimeType] ?? '';
  let label = withoutEncryptedSuffix || MESSAGE_KIND_LABELS[kind];
  const currentExtension = /\.[a-z0-9]{1,10}$/i.exec(label)?.[0]?.toLowerCase();

  if (expectedExtension && !currentExtension) {
    label += expectedExtension;
  } else if (expectedExtension && kind !== 'document' && currentExtension !== expectedExtension) {
    label = `${label.slice(0, -(currentExtension?.length ?? 0))}${expectedExtension}`;
  }

  return label;
}

function AttachmentActions({
  contentUrl,
  showOpen = true,
}: {
  readonly contentUrl: string;
  readonly showOpen?: boolean;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {showOpen ? (
        <a
          href={contentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink aria-hidden="true" className="size-3.5" />
          Abrir
        </a>
      ) : null}
      <a
        href={`${contentUrl}?download=1`}
        download
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download aria-hidden="true" className="size-3.5" />
        Baixar
      </a>
    </span>
  );
}

function MessageAttachmentPreview({
  kind,
  attachment,
}: {
  readonly kind: WhatsAppMessageKind;
  readonly attachment: WhatsAppMessageAttachment;
}) {
  const [contentUnavailable, setContentUnavailable] = useState(false);
  const [contentRequested, setContentRequested] = useState(false);
  const label = normalizeAttachmentLabel(kind, attachment);
  const formatLabel =
    attachment.mimeType === 'application/pdf' ? 'Documento PDF' : MESSAGE_KIND_LABELS[kind];
  const details = `${formatLabel} · ${formatFileSize(attachment.size)}`;

  if (!attachment.url || contentUnavailable) {
    const unavailableReason =
      attachment.retentionStatus === 'too-large'
        ? 'arquivo acima do limite permitido'
        : 'arquivo não está mais disponível';
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background/70 p-2 text-foreground">
        <Paperclip aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs">{label}</strong>
          <small className="block text-muted-foreground">
            {details} · {unavailableReason}
          </small>
        </span>
      </div>
    );
  }

  const contentUrl = attachment.url;
  const isPdf = attachment.mimeType?.toLowerCase().split(';')[0] === 'application/pdf';
  const requiresExplicitLoad =
    kind === 'image' || kind === 'sticker' || kind === 'video' || kind === 'audio' || isPdf;

  if (requiresExplicitLoad && !contentRequested) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background/70 p-2 text-foreground">
        <Paperclip aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs">{label}</strong>
          <small className="block text-muted-foreground">{details}</small>
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => setContentRequested(true)}>
          {isPdf ? 'Visualizar PDF' : 'Carregar mídia'}
        </Button>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="overflow-hidden rounded-xl border bg-background/70">
        <iframe
          src={`${contentUrl}#toolbar=1&navpanes=0`}
          title={`Visualização de ${label}`}
          className="h-[min(65vh,44rem)] min-h-80 w-full bg-background"
        />
        <div className="flex min-w-0 items-center justify-between gap-2 border-t px-2 py-1 text-[11px] text-muted-foreground">
          <span className="min-w-0">
            <strong className="block truncate text-foreground">{label}</strong>
            <small className="block truncate">{details}</small>
          </span>
          <AttachmentActions contentUrl={contentUrl} />
        </div>
      </div>
    );
  }

  if (kind === 'image' || kind === 'sticker') {
    return (
      <div className="overflow-hidden rounded-xl border bg-background/70">
        <a
          href={contentUrl}
          target="_blank"
          rel="noreferrer"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Abrir ${label}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contentUrl}
            alt={kind === 'sticker' ? 'Figurinha recebida' : label}
            loading="lazy"
            onError={() => setContentUnavailable(true)}
            className={
              kind === 'sticker'
                ? 'mx-auto max-h-48 w-auto max-w-full object-contain p-2'
                : 'max-h-[28rem] w-full max-w-full object-contain'
            }
          />
        </a>
        <div className="flex min-w-0 items-center justify-between gap-2 border-t px-2 py-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 truncate">{details}</span>
          <AttachmentActions contentUrl={contentUrl} showOpen={false} />
        </div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="overflow-hidden rounded-xl border bg-background/70">
        <video
          src={contentUrl}
          controls
          preload="metadata"
          onError={() => setContentUnavailable(true)}
          className="max-h-[28rem] w-full max-w-full bg-black"
          aria-label={label}
        />
        <div className="flex min-w-0 items-center justify-between gap-2 px-2 py-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 truncate">{details}</span>
          <AttachmentActions contentUrl={contentUrl} showOpen={false} />
        </div>
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="min-w-0 rounded-xl border bg-background/70 p-2">
        <audio
          src={contentUrl}
          controls
          preload="metadata"
          onError={() => setContentUnavailable(true)}
          className="h-10 w-full min-w-0"
          aria-label={label}
        />
        <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="min-w-0 truncate">{details}</span>
          <AttachmentActions contentUrl={contentUrl} showOpen={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background/70 p-2 text-foreground">
      <Paperclip aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-xs">{label}</strong>
        <small className="block truncate text-muted-foreground">{details}</small>
      </span>
      <AttachmentActions contentUrl={contentUrl} />
    </div>
  );
}

export interface ConversationMessageSheetProps {
  readonly conversation: WhatsAppConversation;
  readonly isLoading: boolean;
  readonly isLoaded: boolean;
  readonly detailError: string;
  readonly onRetry: () => void;
  readonly onLoadOlder: () => void;
  readonly isLoadingOlder: boolean;
  readonly searchOpen: boolean;
  readonly onSearchOpenChange: (open: boolean) => void;
  readonly messageDraft: string;
  readonly onMessageDraftChange: (value: string) => void;
  readonly selectedAttachment: File | null;
  readonly onSelectedAttachmentChange: (file: File | null, kind?: AttachmentPickerKind) => void;
  readonly canSendMessage: boolean;
  readonly isSendingMessage: boolean;
  readonly onSendMessage: () => void;
  readonly feedbackMessage: string;
  readonly feedbackTone: 'neutral' | 'success' | 'error';
}

export function ConversationMessageSheet({
  conversation,
  isLoading,
  isLoaded,
  detailError,
  onRetry,
  onLoadOlder,
  isLoadingOlder,
  searchOpen,
  onSearchOpenChange,
  messageDraft,
  onMessageDraftChange,
  selectedAttachment,
  onSelectedAttachmentChange,
  canSendMessage,
  isSendingMessage,
  onSendMessage,
  feedbackMessage,
  feedbackTone,
}: ConversationMessageSheetProps) {
  const open = true;
  const historyRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const attachmentPickerKindRef = useRef<AttachmentPickerKind>('auto');
  const initialScrollFrameRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMessages, setSearchMessages] = useState<WhatsAppConversation['messages']>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [emojiSearch, setEmojiSearch] = useState('');
  const previousHistoryRef = useRef({
    open: false,
    loaded: false,
    conversationId: '',
    firstId: '',
    lastId: '',
    scrollHeight: 0,
    scrollTop: 0,
    clientHeight: 0,
  });
  const firstMessageId = conversation.messages[0]?.id ?? '';
  const lastMessageId = conversation.messages.at(-1)?.id ?? '';
  const normalizedEmojiSearch = emojiSearch.trim().toLocaleLowerCase('pt-BR');
  const visibleEmojis = EMOJI_OPTIONS.filter(([, keywords]) =>
    normalizedEmojiSearch ? keywords.includes(normalizedEmojiSearch) : true,
  );

  const openAttachmentPicker = useCallback(
    (accept: string, kind: AttachmentPickerKind = 'auto') => {
      const input = attachmentInputRef.current;
      if (!input) return;
      attachmentPickerKindRef.current = kind;
      input.accept = accept;
      input.click();
    },
    [],
  );

  useEffect(() => {
    if (!open || !searchOpen) return;
    const query = searchQuery.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError('');
      try {
        const params = new URLSearchParams({
          conversationId: conversation.id,
          messageSearch: query,
        });
        const response = await fetch(`/api/whatsapp-conversations?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          messages?: WhatsAppConversation['messages'];
          total?: number;
          message?: string;
        } | null;
        if (!response.ok) throw new Error(payload?.message || 'Pesquisa indisponível.');
        setSearchMessages(payload?.messages ?? []);
        setSearchTotal(payload?.total ?? 0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchMessages([]);
        setSearchTotal(0);
        setSearchError(error instanceof Error ? error.message : 'Pesquisa indisponível.');
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [conversation.id, open, searchOpen, searchQuery]);
  const bindHistoryRef = useCallback(
    (history: HTMLDivElement | null) => {
      historyRef.current = history;
      if (initialScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(initialScrollFrameRef.current);
        initialScrollFrameRef.current = null;
      }
      if (!history || !open || !isLoaded) return;

      const scrollToLatestMessage = () => {
        if (historyRef.current !== history) return;
        history.scrollTop = history.scrollHeight;
        previousHistoryRef.current.conversationId = conversation.id;
        previousHistoryRef.current.scrollHeight = history.scrollHeight;
        previousHistoryRef.current.scrollTop = history.scrollTop;
        previousHistoryRef.current.clientHeight = history.clientHeight;
      };

      scrollToLatestMessage();
      initialScrollFrameRef.current = window.requestAnimationFrame(scrollToLatestMessage);
    },
    [conversation.id, isLoaded, open],
  );

  useEffect(() => {
    if (!open || !detailError) return;
    toast.add({
      title: 'Histórico não carregado',
      description: 'Não foi possível carregar as mensagens. Tente novamente.',
      type: 'error',
    });
  }, [detailError, open]);

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!history || !open || !isLoaded) return;
    const previous = previousHistoryRef.current;
    const openingHistory =
      !previous.open || !previous.loaded || previous.conversationId !== conversation.id;
    const prependedMessages =
      previous.firstId !== '' &&
      previous.firstId !== firstMessageId &&
      previous.lastId === lastMessageId;
    const wasNearBottom = previous.scrollHeight - previous.scrollTop - previous.clientHeight < 80;
    const nextScrollTop = resolveConversationHistoryScrollTop({
      openingHistory,
      prependedMessages,
      appendedMessages: previous.lastId !== lastMessageId,
      wasNearBottom,
      currentScrollHeight: history.scrollHeight,
      previousScrollHeight: previous.scrollHeight,
      previousScrollTop: previous.scrollTop,
    });

    if (nextScrollTop !== null) history.scrollTop = nextScrollTop;

    previousHistoryRef.current = {
      open,
      loaded: isLoaded,
      conversationId: conversation.id,
      firstId: firstMessageId,
      lastId: lastMessageId,
      scrollHeight: history.scrollHeight,
      scrollTop: history.scrollTop,
      clientHeight: history.clientHeight,
    };
  }, [conversation.id, firstMessageId, isLoaded, lastMessageId, open]);

  useEffect(() => {
    const history = historyRef.current;
    if (!history || !open || !isLoaded) return;

    history.scrollTop = history.scrollHeight;
    previousHistoryRef.current.scrollHeight = history.scrollHeight;
    previousHistoryRef.current.scrollTop = history.scrollTop;
    previousHistoryRef.current.clientHeight = history.clientHeight;
  }, [conversation.id, isLoaded, open]);

  useEffect(() => {
    if (open) return;
    previousHistoryRef.current.open = false;
    previousHistoryRef.current.loaded = false;
  }, [open]);

  useEffect(
    () => () => {
      if (initialScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(initialScrollFrameRef.current);
      }
    },
    [],
  );

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-x-hidden bg-background"
      aria-label={`Histórico da conversa com ${conversation.contact.name}`}
    >
      {searchOpen ? (
        <section className="border-b bg-muted/10 p-3 sm:p-4" aria-label="Pesquisar mensagens">
          <div className="flex items-center gap-2">
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Pesquisar texto ou nome de arquivo"
              maxLength={160}
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar pesquisa"
              onClick={() => onSearchOpenChange(false)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {searchQuery.trim().length < 2 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Digite ao menos dois caracteres para pesquisar todo o histórico.
            </p>
          ) : isSearching ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              Pesquisando...
            </p>
          ) : searchError ? (
            <p className="mt-2 text-xs text-destructive-emphasis">{searchError}</p>
          ) : (
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto" aria-live="polite">
              <p className="text-xs text-muted-foreground">
                {searchTotal === 1
                  ? '1 mensagem encontrada'
                  : `${searchTotal.toLocaleString('pt-BR')} mensagens encontradas`}
              </p>
              {searchMessages.map((message) => (
                <article key={message.id} className="rounded-lg border bg-background p-2 text-sm">
                  <p className="line-clamp-3 whitespace-pre-wrap break-words">
                    {message.text ||
                      message.attachment?.fileName ||
                      MESSAGE_KIND_LABELS[message.kind]}
                  </p>
                  <small className="text-muted-foreground">
                    {formatDateTime(message.occurredAt)} ·{' '}
                    {message.direction === 'outbound' ? 'Atendimento' : conversation.contact.name}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div
        ref={bindHistoryRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20 p-3 sm:p-4"
        onScroll={(event) => {
          const history = event.currentTarget;
          previousHistoryRef.current.scrollHeight = history.scrollHeight;
          previousHistoryRef.current.scrollTop = history.scrollTop;
          previousHistoryRef.current.clientHeight = history.clientHeight;
          if (
            history.scrollTop <= 64 &&
            !isLoadingOlder &&
            conversation.messageHistory &&
            conversation.messageHistory.page < conversation.messageHistory.totalPages
          ) {
            onLoadOlder();
          }
        }}
      >
        {isLoading && !isLoaded ? (
          <div className="space-y-4" role="status">
            <span className="sr-only">Carregando histórico completo...</span>
            <Skeleton className="h-20 w-3/4 rounded-2xl" />
            <Skeleton className="ml-auto h-24 w-2/3 rounded-2xl" />
            <Skeleton className="h-16 w-1/2 rounded-2xl" />
          </div>
        ) : detailError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">O histórico não pôde ser carregado.</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        ) : conversation.messages.length > 0 ? (
          <div className="space-y-5">
            {conversation.messageHistory &&
            conversation.messageHistory.page < conversation.messageHistory.totalPages ? (
              <div className="flex justify-center">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoadingOlder}
                    onClick={onLoadOlder}
                  >
                    {isLoadingOlder
                      ? 'Carregando mensagens anteriores...'
                      : 'Carregar 100 mensagens anteriores'}
                  </Button>
                  <small className="text-muted-foreground" aria-live="polite">
                    Exibindo {conversation.messages.length.toLocaleString('pt-BR')} de{' '}
                    {conversation.messageHistory.total.toLocaleString('pt-BR')} mensagens
                  </small>
                </div>
              </div>
            ) : null}
            {conversation.messages.map((message) => {
              const isOutbound = message.direction === 'outbound';
              const failedAttempt = [...message.attempts]
                .reverse()
                .find((attempt) => attempt.status === 'failed');
              const messageTime = TIME_FORMATTER.format(new Date(message.occurredAt));
              const messageSender =
                message.sentBy?.name ?? conversation.assignedTo?.name ?? 'Atendente';

              return (
                <Message key={message.id} align={isOutbound ? 'end' : 'start'}>
                  <MessageAvatar>
                    {isOutbound ? (
                      <CurrentUserAvatar
                        name={
                          message.sentBy?.name ?? conversation.assignedTo?.name ?? 'Atendimento'
                        }
                        imageAlt="Foto do atendente"
                      />
                    ) : (
                      <Avatar>
                        {conversation.contact.profilePictureUrl ? (
                          <AvatarImage
                            src={conversation.contact.profilePictureUrl}
                            alt={conversation.contact.name}
                          />
                        ) : null}
                        <AvatarFallback>{getInitial(conversation.contact.name)}</AvatarFallback>
                      </Avatar>
                    )}
                  </MessageAvatar>
                  <MessageContent>
                    <Bubble
                      variant={isOutbound ? 'tinted' : 'secondary'}
                      className="max-w-[88%] sm:max-w-[80%] xl:max-w-[42rem]"
                    >
                      <BubbleContent>
                        <div className="space-y-2">
                          {message.text ? (
                            <p className="whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">
                              {message.text}
                            </p>
                          ) : null}
                          {message.attachment ? (
                            <MessageAttachmentPreview
                              kind={message.kind}
                              attachment={message.attachment}
                            />
                          ) : null}
                          {failedAttempt ? (
                            <p className="flex items-start gap-1 text-xs text-destructive-emphasis">
                              <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5" />
                              <span>Não foi possível enviar esta mensagem. Tente novamente.</span>
                            </p>
                          ) : null}
                          <small
                            className="ml-auto block w-fit text-[10px] leading-none text-muted-foreground/80"
                            data-occurred-at={message.occurredAt}
                          >
                            {isOutbound
                              ? `Enviada por ${messageSender} · ${messageTime}`
                              : messageTime}
                          </small>
                        </div>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-center">
            <MessageCircleMore aria-hidden="true" className="size-9 text-muted-foreground" />
            <strong>Nenhuma mensagem registrada</strong>
            <p className="max-w-sm text-sm text-muted-foreground">
              As próximas mensagens e anexos desta conversa aparecerão aqui.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t bg-background p-2">
        {selectedAttachment ? (
          <div className="flex min-w-0 items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
            <Paperclip aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs">{selectedAttachment.name}</strong>
              <small className="text-[10px] text-muted-foreground">
                {formatFileSize(selectedAttachment.size)}
              </small>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remover anexo"
              disabled={isSendingMessage}
              onClick={() => onSelectedAttachmentChange(null, 'auto')}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ) : null}
        <div className="flex min-h-12 min-w-0 items-end gap-1 rounded-2xl border bg-card p-1 shadow-xs focus-within:ring-2 focus-within:ring-ring/25">
          {canSendMessage ? (
            <div className="flex shrink-0 items-center" aria-label="Opções da mensagem">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Adicionar anexo"
                      disabled={isSendingMessage}
                    />
                  }
                >
                  <Paperclip aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Adicionar</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() =>
                        openAttachmentPicker(
                          'application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed,application/x-7z-compressed',
                        )
                      }
                    >
                      <FileText aria-hidden="true" /> Documento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAttachmentPicker('image/*,video/*')}>
                      <ImageIcon aria-hidden="true" /> Fotos e vídeos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAttachmentPicker('audio/*')}>
                      <Music aria-hidden="true" /> Áudio
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openAttachmentPicker('.vcf,text/vcard,text/x-vcard')}
                    >
                      <Contact aria-hidden="true" /> Contato
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAttachmentPicker('image/gif,.gif')}>
                      <ImagePlay aria-hidden="true" /> GIF do dispositivo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openAttachmentPicker('image/webp,.webp', 'sticker')}
                    >
                      <Sticker aria-hidden="true" /> Figurinha WebP
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Popover.Root>
                <Popover.Trigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Adicionar emoji"
                      disabled={isSendingMessage}
                    />
                  }
                >
                  <Smile aria-hidden="true" />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner side="top" align="start" sideOffset={8} className="z-50">
                    <Popover.Popup className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none">
                      <Popover.Title className="font-semibold">Emojis</Popover.Title>
                      <Input
                        value={emojiSearch}
                        onChange={(event) => setEmojiSearch(event.target.value)}
                        placeholder="Pesquisar emoji"
                        className="mt-2"
                      />
                      <div className="mt-2 grid max-h-52 grid-cols-7 gap-1 overflow-y-auto sm:grid-cols-8">
                        {visibleEmojis.map(([emoji, keywords]) => (
                          <Popover.Close
                            key={emoji}
                            render={
                              <button
                                type="button"
                                className="flex size-9 items-center justify-center rounded-md text-xl hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Inserir ${keywords}`}
                                onClick={() =>
                                  onMessageDraftChange(
                                    `${messageDraft}${emoji}`.slice(
                                      0,
                                      HUMAN_WHATSAPP_MESSAGE_MAX_LENGTH,
                                    ),
                                  )
                                }
                              />
                            }
                          >
                            {emoji}
                          </Popover.Close>
                        ))}
                      </div>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          ) : null}
          <Textarea
            id="human-message"
            value={messageDraft}
            onChange={(event) => onMessageDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                canSendMessage &&
                (messageDraft.trim().length > 0 || selectedAttachment !== null)
              ) {
                event.preventDefault();
                onSendMessage();
              }
            }}
            maxLength={HUMAN_WHATSAPP_MESSAGE_MAX_LENGTH}
            rows={1}
            disabled={!canSendMessage || isSendingMessage}
            placeholder={
              canSendMessage
                ? 'Digite uma mensagem'
                : 'Assuma esta conversa para responder ao cliente.'
            }
            aria-label={`Mensagem para ${conversation.contact.name}`}
            className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={onSendMessage}
            aria-label={selectedAttachment ? 'Enviar anexo' : 'Enviar mensagem'}
            title={selectedAttachment ? 'Enviar anexo' : 'Enviar mensagem'}
            disabled={
              !canSendMessage ||
              isSendingMessage ||
              (messageDraft.trim().length === 0 && selectedAttachment === null)
            }
          >
            {isSendingMessage ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Send aria-hidden="true" />
            )}
          </Button>
        </div>
        <input
          ref={attachmentInputRef}
          type="file"
          className="sr-only"
          disabled={!canSendMessage || isSendingMessage}
          onChange={(event) => {
            onSelectedAttachmentChange(
              event.target.files?.[0] ?? null,
              attachmentPickerKindRef.current,
            );
            event.currentTarget.value = '';
          }}
        />
        {feedbackMessage ? (
          <p
            aria-live="polite"
            className={
              feedbackTone === 'error'
                ? 'text-sm text-destructive-emphasis'
                : feedbackTone === 'success'
                  ? 'text-sm text-success-emphasis'
                  : 'text-sm text-muted-foreground'
            }
          >
            {feedbackMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
