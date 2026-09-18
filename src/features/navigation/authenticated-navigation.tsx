'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BellDot, ChevronRight, LayoutDashboard, Star } from 'lucide-react';
import type { User } from '@/features/auth/domain';
import { getPendingQuoteProposalCountAction } from '@/features/quote-proposals/actions';
import {
  addNavigationFavoriteAction,
  listNavigationFavoritesAction,
  removeNavigationFavoriteAction,
  type NavigationFavorite,
} from './navigation-favorite-actions';
import { getAuthorizedNavigationItems } from './navigation-items';
import { getNavigationTree, type NavigationNode } from './navigation-tree';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/shared/ui/sidebar';

export interface AuthenticatedNavigationProps {
  readonly user: User;
}
function isCurrentRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
function collectLeaves(nodes: NavigationNode[], result: NavigationNode[] = []): NavigationNode[] {
  for (const node of nodes) {
    if (node.children) collectLeaves(node.children, result);
    else if (node.navigationKey && node.href) result.push(node);
  }
  return result;
}

function hasActiveDescendant(pathname: string, node: NavigationNode): boolean {
  if (node.href && isCurrentRoute(pathname, node.href.split('?')[0])) return true;
  return node.children?.some((child) => hasActiveDescendant(pathname, child)) === true;
}

export function AuthenticatedNavigation({ user }: AuthenticatedNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const items = getAuthorizedNavigationItems(user);
  const tree = getNavigationTree(user);
  const leaves = useMemo(() => collectLeaves(tree.flatMap((group) => group.items)), [tree]);
  const dashboardNode = items.some((item) => item.href === '/dashboard')
    ? {
        label: 'Dashboard',
        href: '/dashboard',
        navigationKey: 'dashboard',
        icon: LayoutDashboard,
      }
    : undefined;
  const favoriteCandidates = useMemo(
    () => [...(dashboardNode ? [dashboardNode] : []), ...leaves],
    [dashboardNode, leaves],
  );
  const [favorites, setFavorites] = useState<NavigationFavorite[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [awaitingProposalCount, setAwaitingProposalCount] = useState<number | null>(null);
  const canSeeProposals = items.some((item) => item.href === '/quote-proposals');

  useEffect(() => {
    let active = true;
    void listNavigationFavoritesAction().then((result) => {
      if (active && result.success && result.favorites.length > 0) setFavorites(result.favorites);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!canSeeProposals) return;
    let active = true;
    const refresh = async () => {
      const result = await getPendingQuoteProposalCountAction();
      if (active && result.success) setAwaitingProposalCount(result.pendingTotal);
    };
    const receiveCount = (event: Event) => {
      const count = (event as CustomEvent<number>).detail;
      if (Number.isInteger(count) && count >= 0) setAwaitingProposalCount(count);
      else void refresh();
    };
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), 15_000);
    window.addEventListener('quote-proposals:count', receiveCount);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('quote-proposals:count', receiveCount);
    };
  }, [canSeeProposals]);
  if (items.length === 0) return null;

  function renderNode(node: NavigationNode, depth = 0, parentId = ''): React.ReactNode {
    const Icon = node.icon;
    const nodeId = `${parentId}/${node.href ?? node.label}`;
    const [targetPath, targetQuery] = (node.href ?? '').split('?');
    const active =
      Boolean(node.href) &&
      (node.children ? pathname === targetPath : isCurrentRoute(pathname, targetPath)) &&
      (node.href !== '/registrations' ||
        (!searchParams.has('roleCodes') && pathname !== '/registrations/new')) &&
      (!targetQuery ||
        [...new URLSearchParams(targetQuery)].every(
          ([key, value]) => (searchParams.get(key) ?? (key === 'tab' ? 'issues' : '')) === value,
        ));
    if (node.children) {
      const expanded = expandedNodes[nodeId] ?? (depth === 0 || hasActiveDescendant(pathname, node));
      return (
        <SidebarMenuItem key={nodeId}>
          <div
            className={`group flex min-h-9 min-w-0 items-center rounded-md px-2 py-1.5 text-sm ${active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
          >
            {node.href ? (
              <Link
                href={node.href}
                aria-label={node.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => isMobile && setOpenMobile(false)}
                className="flex min-w-0 flex-1 items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Icon && (
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 break-words">{node.label}</span>
              </Link>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {Icon && (
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 break-words">{node.label}</span>
              </span>
            )}
            <button
              type="button"
              aria-label={`${expanded ? 'Recolher' : 'Expandir'} ${node.label}`}
              aria-expanded={expanded}
              onClick={() =>
                setExpandedNodes((current) => ({ ...current, [nodeId]: !expanded }))
              }
              className="rounded p-1 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight
                className={`size-3.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
          {expanded && (
            <ul className="ml-3 space-y-0.5 border-l border-sidebar-border pl-2">
              {node.children.map((child) => renderNode(child, depth + 1, nodeId))}
            </ul>
          )}
        </SidebarMenuItem>
      );
    }
    const favorite = Boolean(
      node.navigationKey && favorites.some((item) => item.navigationKey === node.navigationKey),
    );
    return (
      <SidebarMenuItem key={node.href}>
        <div
          className={`group flex min-h-9 min-w-0 items-center rounded-md px-2 py-1.5 text-sm ${active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
        >
          <Link
            href={node.href!}
            aria-label={node.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => isMobile && setOpenMobile(false)}
            className="flex min-w-0 flex-1 items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="min-w-0 break-words">{node.label}</span>
            {node.href === '/quote-proposals' &&
              awaitingProposalCount !== null &&
              awaitingProposalCount > 0 && (
                <span
                  aria-label={`${awaitingProposalCount} orçamentos pendentes`}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 pl-2 text-xs tabular-nums"
                >
                  <BellDot className="size-3.5" aria-hidden="true" />
                  {awaitingProposalCount > 99 ? '99+' : awaitingProposalCount}
                </span>
              )}
          </Link>
          {node.navigationKey && (
            <button
              type="button"
              aria-label={
                favorite
                  ? `Remover ${node.label} dos favoritos`
                  : `Adicionar ${node.label} aos favoritos`
              }
              title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              onClick={async (event) => {
                event.preventDefault();
                const result = favorite
                  ? await removeNavigationFavoriteAction(node.navigationKey!)
                  : await addNavigationFavoriteAction(node.navigationKey!);
                if (result.success) setFavorites(result.favorites);
              }}
              className="ml-1 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Star
                className={`size-3.5 ${favorite ? 'fill-current text-amber-500' : 'text-muted-foreground'}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </SidebarMenuItem>
    );
  }
  const favoriteNodes = favorites
    .map((favorite) =>
      favoriteCandidates.find((node) => node.navigationKey === favorite.navigationKey),
    )
    .filter((node): node is NavigationNode => Boolean(node));
  const groups = [
    ...(dashboardNode
      ? [
          {
            label: '',
            items: [dashboardNode],
          },
        ]
      : []),
    ...(favoriteNodes.length ? [{ label: 'Favoritos', items: favoriteNodes }] : []),
    ...tree,
  ];
  return (
    <>
      {groups.map((group, index) => (
        <SidebarGroup
          key={`${group.label || 'dashboard'}-${index}`}
          className="border-b border-sidebar-border/70 py-3 last:border-0"
        >
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{group.items.map((node) => renderNode(node))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
