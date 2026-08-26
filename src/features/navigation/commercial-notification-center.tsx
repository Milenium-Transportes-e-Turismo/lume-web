'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, BotOff, FileClock, RefreshCw } from 'lucide-react';

import { hasCommercialScope, hasPermission, type User } from '@/features/auth/domain';
import type { TenantNotificationItem } from '@/features/tenant-administration/domain';
import { DEPARTMENT_LABELS } from '@/features/whatsapp-conversations/components/conversation-labels';
import {
  isWhatsAppConversationDepartment,
  type WhatsAppConversation,
} from '@/features/whatsapp-conversations/domain';
import { userFacingMessage } from '@/shared/lib/user-facing-message';
import { Button } from '@/shared/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/ui/drawer';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { toast } from '@/shared/ui/toast';

import {
  getDepartmentNotificationsAction,
  markDepartmentNotificationReadAction,
} from './department-notification-action';

interface CommercialNotificationSnapshot {
  readonly departmentNotifications: readonly TenantNotificationItem[];
  readonly pausedAutomations: readonly WhatsAppConversation[];
}

interface SeenNotificationState {
  readonly departmentCounts: Readonly<Record<string, number>>;
  readonly pausedAutomationIds: readonly string[];
}

const EMPTY_SNAPSHOT: CommercialNotificationSnapshot = {
  departmentNotifications: [],
  pausedAutomations: [],
};

const EMPTY_SEEN_STATE: SeenNotificationState = {
  departmentCounts: {},
  pausedAutomationIds: [],
};

const SEEN_NOTIFICATIONS_STORAGE_PREFIX = 'lume:notification-read-fallback:v1:';

function isPausedCommercialAutomation(conversation: WhatsAppConversation): boolean {
  return (
    conversation.department === 'commercial' &&
    !['bot-active', 'human-active', 'closed'].includes(conversation.conversationState)
  );
}

function departmentLabel(department: string): string {
  if (isWhatsAppConversationDepartment(department)) return DEPARTMENT_LABELS[department];

  const readable = department.trim().replaceAll(/[-_]+/g, ' ').toLocaleLowerCase('pt-BR');
  return readable
    ? readable.charAt(0).toLocaleUpperCase('pt-BR') + readable.slice(1)
    : 'Departamento';
}

function seenNotificationsStorageKey(userId: string): string {
  return `${SEEN_NOTIFICATIONS_STORAGE_PREFIX}${userId}`;
}

function readSeenNotifications(userId: string): SeenNotificationState {
  try {
    const stored = window.localStorage.getItem(seenNotificationsStorageKey(userId));
    if (!stored) return EMPTY_SEEN_STATE;

    const candidate = JSON.parse(stored) as Partial<SeenNotificationState>;
    const departmentCounts = Object.fromEntries(
      Object.entries(candidate.departmentCounts ?? {}).filter(
        ([id, count]) => id.length > 0 && Number.isInteger(count) && count >= 0,
      ),
    );
    const pausedAutomationIds = Array.isArray(candidate.pausedAutomationIds)
      ? candidate.pausedAutomationIds.filter((id): id is string => typeof id === 'string')
      : [];

    return { departmentCounts, pausedAutomationIds };
  } catch {
    return EMPTY_SEEN_STATE;
  }
}

function persistSeenNotifications(userId: string, state: SeenNotificationState): void {
  try {
    window.localStorage.setItem(seenNotificationsStorageKey(userId), JSON.stringify(state));
  } catch {
    // O contador ainda funciona durante a sessão quando o armazenamento não está disponível.
  }
}

function reconcileSeenNotifications(
  snapshot: CommercialNotificationSnapshot,
  seen: SeenNotificationState,
): SeenNotificationState {
  const departmentCounts = Object.fromEntries(
    snapshot.departmentNotifications.map((notification) => [
      notification.id,
      Math.min(seen.departmentCounts[notification.id] ?? 0, notification.unreadCount),
    ]),
  );
  const currentPausedIds = new Set(
    snapshot.pausedAutomations.map((conversation) => conversation.id),
  );
  const pausedAutomationIds = seen.pausedAutomationIds.filter((id) => currentPausedIds.has(id));

  return { departmentCounts, pausedAutomationIds };
}

function markPausedAutomationsAsSeen(
  snapshot: CommercialNotificationSnapshot,
  seen: SeenNotificationState,
): SeenNotificationState {
  const reconciled = reconcileSeenNotifications(snapshot, seen);
  return {
    departmentCounts: reconciled.departmentCounts,
    pausedAutomationIds: Array.from(
      new Set([
        ...reconciled.pausedAutomationIds,
        ...snapshot.pausedAutomations.map((conversation) => conversation.id),
      ]),
    ),
  };
}

function persistDepartmentFallback(
  notifications: readonly TenantNotificationItem[],
  seen: SeenNotificationState,
): SeenNotificationState {
  return {
    ...seen,
    departmentCounts: {
      ...seen.departmentCounts,
      ...Object.fromEntries(
        notifications.map((notification) => [notification.id, notification.unreadCount]),
      ),
    },
  };
}

function clearDepartmentFallback(
  notificationIds: readonly string[],
  seen: SeenNotificationState,
): SeenNotificationState {
  const departmentCounts = { ...seen.departmentCounts };
  notificationIds.forEach((notificationId) => delete departmentCounts[notificationId]);
  return { ...seen, departmentCounts };
}

function optimisticallyMarkDepartmentNotificationsRead(
  snapshot: CommercialNotificationSnapshot,
): CommercialNotificationSnapshot {
  return {
    ...snapshot,
    departmentNotifications: snapshot.departmentNotifications.map((notification) => ({
      ...notification,
      unreadCount: 0,
      read: true,
    })),
  };
}

function countUnseenNotifications(
  snapshot: CommercialNotificationSnapshot,
  seen: SeenNotificationState,
): number {
  const unseenDepartmentNotifications = snapshot.departmentNotifications.reduce(
    (total, notification) =>
      total + Math.max(0, notification.unreadCount - (seen.departmentCounts[notification.id] ?? 0)),
    0,
  );
  const seenPausedIds = new Set(seen.pausedAutomationIds);
  return (
    unseenDepartmentNotifications +
    snapshot.pausedAutomations.filter((conversation) => !seenPausedIds.has(conversation.id)).length
  );
}

export function CommercialNotificationCenter({ user }: { readonly user: User }) {
  const pathname = usePathname();
  const visible = user.isActive && pathname !== '/whatsapp-conversations/import';
  const commercialEnabled = hasCommercialScope(user);
  const canInspectPausedAutomations =
    commercialEnabled && hasPermission(user, 'whatsapp-conversations:manage');
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [seenNotifications, setSeenNotifications] = useState(EMPTY_SEEN_STATE);
  const [seenNotificationsReady, setSeenNotificationsReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const drawerOpenRef = useRef(false);
  const seenNotificationsReadyRef = useRef(false);
  const snapshotRef = useRef(EMPTY_SNAPSHOT);

  const persistUnreadDepartmentNotifications = useCallback(
    async (notifications: readonly TenantNotificationItem[]) => {
      const unreadNotifications = notifications.filter(
        (notification) => notification.unreadCount > 0 && !notification.read,
      );
      if (unreadNotifications.length === 0) return;

      const outcomes = await Promise.all(
        unreadNotifications.map(async (notification) => {
          try {
            return {
              notification,
              result: await markDepartmentNotificationReadAction(notification.id),
            };
          } catch {
            return {
              notification,
              result: {
                success: false as const,
                message:
                  'A notificação foi marcada neste dispositivo, mas não foi possível sincronizar a leitura.',
              },
            };
          }
        }),
      );
      const failed = outcomes.filter((outcome) => !outcome.result.success);
      const succeededIds = outcomes
        .filter((outcome) => outcome.result.success)
        .map((outcome) => outcome.notification.id);

      setSeenNotifications((current) => {
        const withoutSuccessfulFallback = clearDepartmentFallback(succeededIds, current);
        const next =
          failed.length === 0
            ? withoutSuccessfulFallback
            : persistDepartmentFallback(
                failed.map((outcome) => outcome.notification),
                withoutSuccessfulFallback,
              );
        if (seenNotificationsReadyRef.current) persistSeenNotifications(user.id, next);
        return next;
      });

      if (failed.length > 0) {
        setError(failed[0].result.success ? '' : failed[0].result.message);
      }
    },
    [user.id],
  );

  const refresh = useCallback(async () => {
    if (!visible) return;
    setIsRefreshing(true);

    try {
      const [notificationResult, conversationResponse] = await Promise.all([
        getDepartmentNotificationsAction(),
        canInspectPausedAutomations
          ? fetch('/api/whatsapp-conversations', { cache: 'no-store' })
          : Promise.resolve(null),
      ]);

      if (conversationResponse !== null && !conversationResponse.ok) {
        throw new Error('Não foi possível consultar as automações pausadas.');
      }

      let pausedAutomations: readonly WhatsAppConversation[] = [];
      if (conversationResponse !== null) {
        const conversationPayload = (await conversationResponse.json()) as {
          readonly conversations?: readonly WhatsAppConversation[];
        };
        if (!Array.isArray(conversationPayload.conversations)) {
          throw new Error('A Tenant API retornou notificações incompatíveis.');
        }
        pausedAutomations = conversationPayload.conversations.filter(isPausedCommercialAutomation);
      }

      const apiSnapshot = {
        departmentNotifications: notificationResult.success ? notificationResult.summary.items : [],
        pausedAutomations,
      };
      const nextSnapshot = drawerOpenRef.current
        ? optimisticallyMarkDepartmentNotificationsRead(apiSnapshot)
        : apiSnapshot;
      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setSeenNotifications((current) => {
        const next = drawerOpenRef.current
          ? markPausedAutomationsAsSeen(nextSnapshot, current)
          : reconcileSeenNotifications(nextSnapshot, current);
        if (seenNotificationsReadyRef.current) persistSeenNotifications(user.id, next);
        return next;
      });
      if (drawerOpenRef.current) {
        void persistUnreadDepartmentNotifications(apiSnapshot.departmentNotifications);
      }
      setError(notificationResult.success ? '' : notificationResult.message);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível atualizar as notificações comerciais.',
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [canInspectPausedAutomations, persistUnreadDepartmentNotifications, user.id, visible]);

  useEffect(() => {
    if (!visible) return;

    const hydrateId = window.setTimeout(() => {
      const stored = readSeenNotifications(user.id);
      const next = drawerOpenRef.current
        ? markPausedAutomationsAsSeen(snapshotRef.current, stored)
        : reconcileSeenNotifications(snapshotRef.current, stored);
      seenNotificationsReadyRef.current = true;
      setSeenNotifications(next);
      setSeenNotificationsReady(true);
      persistSeenNotifications(user.id, next);
    }, 0);

    return () => window.clearTimeout(hydrateId);
  }, [user.id, visible]);

  useEffect(() => {
    if (!visible) return;

    const initialRefreshId = window.setTimeout(() => void refresh(), 0);
    const intervalId = window.setInterval(() => void refresh(), 30_000);
    const receiveProposalCount = () => void refresh();
    window.addEventListener('quote-proposals:count', receiveProposalCount);
    return () => {
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
      window.removeEventListener('quote-proposals:count', receiveProposalCount);
    };
  }, [refresh, visible]);

  const changeDrawerOpen = useCallback(
    (open: boolean) => {
      drawerOpenRef.current = open;
      setDrawerOpen(open);
      if (!open) return;

      const currentSnapshot = snapshotRef.current;
      const optimisticSnapshot = optimisticallyMarkDepartmentNotificationsRead(currentSnapshot);
      snapshotRef.current = optimisticSnapshot;
      setSnapshot(optimisticSnapshot);
      setSeenNotifications((current) => {
        const next = markPausedAutomationsAsSeen(optimisticSnapshot, current);
        if (seenNotificationsReadyRef.current) persistSeenNotifications(user.id, next);
        return next;
      });
      void persistUnreadDepartmentNotifications(currentSnapshot.departmentNotifications);
    },
    [persistUnreadDepartmentNotifications, user.id],
  );

  const notificationCount = useMemo(
    () => (seenNotificationsReady ? countUnseenNotifications(snapshot, seenNotifications) : 0),
    [seenNotifications, seenNotificationsReady, snapshot],
  );
  const pendingCount = useMemo(
    () =>
      snapshot.departmentNotifications.reduce(
        (total, notification) => total + notification.count,
        0,
      ) + snapshot.pausedAutomations.length,
    [snapshot],
  );

  useEffect(() => {
    if (!error) return;
    toast.add({
      title: 'Notificações não atualizadas',
      description: userFacingMessage(
        error,
        'Não foi possível atualizar as notificações. Tente novamente.',
      ),
      type: 'error',
    });
  }, [error]);

  if (!visible) return null;

  return (
    <Drawer swipeDirection="right" open={drawerOpen} onOpenChange={changeDrawerOpen}>
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              notificationCount > 0
                ? `Notificações: ${notificationCount} não visualizadas`
                : 'Notificações'
            }
          />
        }
      >
        <Bell aria-hidden="true" />
        {notificationCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        ) : null}
      </DrawerTrigger>

      <DrawerContent>
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DrawerTitle>Notificações</DrawerTitle>
              <DrawerDescription>
                {commercialEnabled
                  ? 'Pendências relacionadas aos seus departamentos.'
                  : 'Avisos relacionados aos seus departamentos aparecerão aqui.'}
              </DrawerDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              aria-label="Atualizar notificações"
            >
              <RefreshCw className={isRefreshing ? 'animate-spin' : undefined} />
            </Button>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {pendingCount === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>
                  {error ? 'Notificações indisponíveis' : 'Nenhuma pendência nova'}
                </EmptyTitle>
                <EmptyDescription>
                  {error
                    ? 'Use o botão de atualizar para tentar novamente.'
                    : 'Novos avisos relacionados aos seus departamentos aparecerão aqui.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {snapshot.departmentNotifications.map((notification) => (
                <section key={notification.id} aria-labelledby={`${notification.id}-title`}>
                  <h3
                    id={`${notification.id}-title`}
                    className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {departmentLabel(notification.department)}
                  </h3>
                  <Link
                    href={
                      notification.type === 'quote-proposal-pending'
                        ? '/quote-proposals?tab=pending'
                        : notification.href
                    }
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:bg-muted"
                  >
                    <span className="rounded-lg bg-warning/10 p-2 text-warning-emphasis">
                      {notification.type === 'quote-proposal-pending' ? (
                        <FileClock aria-hidden="true" className="size-4" />
                      ) : (
                        <Bell aria-hidden="true" className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">{notification.title}</strong>
                      <small className="text-muted-foreground">{notification.description}</small>
                    </span>
                  </Link>
                </section>
              ))}

              {snapshot.pausedAutomations.length > 0 ? (
                <section aria-labelledby="paused-automations-notification">
                  <h3
                    id="paused-automations-notification"
                    className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Automações pausadas
                  </h3>
                  <div className="space-y-2">
                    {snapshot.pausedAutomations.map((conversation) => (
                      <Link
                        key={conversation.id}
                        href={`/whatsapp-conversations?conversationId=${encodeURIComponent(
                          conversation.id,
                        )}`}
                        className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:bg-muted"
                      >
                        <span className="rounded-lg bg-destructive/10 p-2 text-destructive-emphasis">
                          <BotOff aria-hidden="true" className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">
                            {conversation.contact.name}
                          </strong>
                          <small className="block truncate text-muted-foreground">
                            {conversation.contact.phone} · {conversation.lastMessagePreview}
                          </small>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>

        <DrawerFooter className="border-t pt-4">
          <DrawerClose render={<Button variant="outline" />}>Fechar</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
