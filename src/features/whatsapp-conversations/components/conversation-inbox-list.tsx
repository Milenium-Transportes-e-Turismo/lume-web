'use client';

import { ChevronLeft, ChevronRight, Inbox, LoaderCircle } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';

import type { WhatsAppConversation } from '../domain';
import {
  DEPARTMENT_LABELS,
  getConversationControl,
  getConversationControlLabel,
  getRequestStatusTone,
  REQUEST_STATUS_LABELS,
} from './conversation-labels';
import { conversationWorkspaceStyles as styles } from './conversation-workspace.styles';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function formatDateTime(value: string): string {
  return DATE_TIME_FORMATTER.format(new Date(value));
}

function getContactInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?';
}

export interface ConversationInboxListProps {
  readonly conversations: readonly WhatsAppConversation[];
  readonly selectedConversationId: string | null;
  readonly isRefreshing: boolean;
  readonly hasError: boolean;
  readonly pagination: {
    readonly page: number;
    readonly totalPages: number;
  };
  readonly paginationNumbers: readonly number[];
  readonly onSelect: (conversation: WhatsAppConversation) => void;
  readonly onPageChange: (page: number) => void;
}

export function ConversationInboxList({
  conversations,
  selectedConversationId,
  isRefreshing,
  hasError,
  pagination,
  paginationNumbers,
  onSelect,
  onPageChange,
}: ConversationInboxListProps) {
  return (
    <>
      <div
        className={styles.conversationList()}
        aria-label="Conversas encontradas"
        aria-busy={isRefreshing}
      >
        {isRefreshing && conversations.length === 0 ? (
          <div className={styles.emptyList()} role="status">
            <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-primary" />
            <p className={styles.emptyTitle()}>Carregando conversas</p>
            <p className={styles.emptyDescription()}>A lista será atualizada em instantes.</p>
          </div>
        ) : conversations.length > 0 ? (
          conversations.map((conversation) => {
            const isSelected = conversation.id === selectedConversationId;
            const control = getConversationControl(conversation.conversationState);

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation)}
                className={styles.conversationButton({ selected: isSelected })}
                aria-pressed={isSelected}
                aria-label={`${conversation.contact.name}, ${getConversationControlLabel(conversation.conversationState)}, ${conversation.unreadCount} não lidas`}
              >
                <Avatar className={styles.avatar()}>
                  {conversation.contact.profilePictureUrl ? (
                    <AvatarImage
                      src={conversation.contact.profilePictureUrl}
                      alt={`Foto de ${conversation.contact.name}`}
                    />
                  ) : null}
                  <AvatarFallback>{getContactInitial(conversation.contact.name)}</AvatarFallback>
                </Avatar>
                <span className={styles.conversationSummary()}>
                  <span className={styles.conversationHeading()}>
                    <strong className={styles.contactName()}>{conversation.contact.name}</strong>
                    <time className={styles.conversationTime()}>
                      {formatDateTime(conversation.lastMessageAt)}
                    </time>
                  </span>
                  <span className={styles.phonePreview()}>{conversation.contact.phone}</span>
                  <span className={styles.previewRow()}>
                    <span className={styles.preview()}>
                      {conversation.lastMessagePreview || 'Sem prévia de mensagem'}
                    </span>
                    {conversation.unreadCount > 0 ? (
                      <span
                        className={styles.unreadBadge()}
                        aria-label={
                          conversation.unreadCount === 1
                            ? '1 mensagem não lida'
                            : `${conversation.unreadCount} mensagens não lidas`
                        }
                      >
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.listMetadata()}>
                    <span className={styles.departmentBadge()}>
                      {DEPARTMENT_LABELS[conversation.department]}
                    </span>
                    <span className={styles.controlBadge({ control })}>
                      {getConversationControlLabel(conversation.conversationState)}
                    </span>
                    {conversation.department === 'commercial' ? (
                      <span
                        className={styles.requestBadge({
                          tone: getRequestStatusTone(conversation.requestStatus),
                        })}
                      >
                        {REQUEST_STATUS_LABELS[conversation.requestStatus]}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <div className={styles.emptyList()}>
            <Inbox aria-hidden="true" className={styles.emptyIcon()} />
            <p className={styles.emptyTitle()}>Nenhuma conversa encontrada</p>
            <p className={styles.emptyDescription()}>
              {hasError
                ? 'A lista será restaurada quando a conexão for retomada.'
                : 'Altere a busca ou os filtros selecionados.'}
            </p>
          </div>
        )}
      </div>
      {pagination.totalPages > 1 ? (
        <nav className={styles.pagination()} aria-label="Paginação das conversas">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            disabled={isRefreshing || pagination.page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="sr-only">
            Página atual {pagination.page} de {pagination.totalPages}
          </span>
          {paginationNumbers.map((pageNumber) => (
            <Button
              key={pageNumber}
              type="button"
              size="icon-sm"
              variant={pageNumber === pagination.page ? 'default' : 'outline'}
              onClick={() => onPageChange(pageNumber)}
              disabled={isRefreshing}
              aria-current={pageNumber === pagination.page ? 'page' : undefined}
              aria-label={`Ir para a página ${pageNumber}`}
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
            disabled={isRefreshing || pagination.page >= pagination.totalPages}
            aria-label="Próxima página"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </>
  );
}
