'use client';

import { useCallback, useState } from 'react';
import { LoaderCircle, MessageCircle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { ConversationMessageSheet } from '@/features/whatsapp-conversations/components/conversation-message-sheet';
import type { WhatsAppConversation } from '@/features/whatsapp-conversations/domain';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { toast } from '@/shared/ui/toast';
import { formatPhone } from '@/shared/utils/brazilian-data';

async function responseMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return typeof payload?.message === 'string'
    ? payload.message
    : 'Não foi possível carregar a conversa.';
}

export function ReadonlyConversationDialog({
  conversationId,
}: {
  readonly conversationId: string;
}) {
  const { push: pushRoute } = useRouter();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<WhatsAppConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const loadPage = useCallback(
    async (page = 1) => {
      if (page === 1) setLoading(true);
      else setLoadingOlder(true);
      if (page === 1) setError('');

      try {
        const query = new URLSearchParams({
          conversationId,
          messagePage: String(page),
        });
        const response = await fetch(`/api/whatsapp-conversations?${query.toString()}`, {
          cache: 'no-store',
        });
        if (response.status === 401) {
          pushRoute('/auth/session-expired');
          return;
        }
        if (!response.ok) throw new Error(await responseMessage(response));
        const body = (await response.json()) as { conversation?: WhatsAppConversation };
        if (!body.conversation) throw new Error('A conversa retornada é inválida.');

        setConversation((current) => {
          if (page === 1 || !current) return body.conversation!;
          const messages = new Map(current.messages.map((message) => [message.id, message]));
          body.conversation!.messages.forEach((message) => messages.set(message.id, message));
          return {
            ...body.conversation!,
            messages: [...messages.values()].sort((left, right) => {
              const difference = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
              return difference === 0 ? left.id.localeCompare(right.id) : difference;
            }),
          };
        });
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : 'Não foi possível carregar a conversa.';
        if (page === 1) setError(message);
        else {
          toast.add({
            title: 'Mensagens anteriores não carregadas',
            description: message,
            type: 'error',
          });
        }
      } finally {
        if (page === 1) setLoading(false);
        else setLoadingOlder(false);
      }
    },
    [conversationId, pushRoute],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen && !conversation && !loading) void loadPage();
        if (!nextOpen) setSearchOpen(false);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <MessageCircle aria-hidden="true" /> Abrir conversa
      </DialogTrigger>
      <DialogContent className="flex h-[min(88vh,54rem)] max-h-[54rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-4 py-3 pr-14">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>{conversation?.contact.name ?? 'Conversa do WhatsApp'}</DialogTitle>
              <DialogDescription>
                {conversation
                  ? `${formatPhone(conversation.contact.phone)} · histórico para consulta`
                  : 'Histórico para consulta, sem envio de mensagens.'}
              </DialogDescription>
            </div>
            {conversation ? (
              <Button
                type="button"
                variant={searchOpen ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSearchOpen((current) => !current)}
              >
                <Search aria-hidden="true" /> Pesquisar
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        {conversation ? (
          <ConversationMessageSheet
            conversation={conversation}
            isLoading={loading}
            isLoaded
            detailError={error}
            onRetry={() => void loadPage()}
            onLoadOlder={() => void loadPage((conversation.messageHistory?.page ?? 1) + 1)}
            isLoadingOlder={loadingOlder}
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            messageDraft=""
            onMessageDraftChange={() => undefined}
            selectedAttachment={null}
            onSelectedAttachmentChange={() => undefined}
            canSendMessage={false}
            isSendingMessage={false}
            onSendMessage={() => undefined}
            feedbackMessage=""
            feedbackTone="neutral"
            readOnly
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            {loading ? (
              <>
                <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Carregando histórico...</p>
              </>
            ) : (
              <>
                <p className="text-sm text-destructive-emphasis">{error}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadPage()}>
                  Tentar novamente
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
