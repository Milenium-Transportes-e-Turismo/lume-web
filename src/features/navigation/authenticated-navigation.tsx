'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BellDot, ChevronRight } from 'lucide-react';

import type { User } from '@/features/auth/domain';
import { getPendingQuoteProposalCountAction } from '@/features/quote-proposals/actions';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from '@/shared/ui/sidebar';

import { getAuthorizedNavigationItems } from './navigation-items';
import { getNavigationTree, type NavigationNode } from './navigation-tree';
import { useSidebar } from '@/shared/ui/sidebar';

export interface AuthenticatedNavigationProps {
  readonly user: User;
}

function isCurrentRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AuthenticatedNavigation({ user }: AuthenticatedNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const items = getAuthorizedNavigationItems(user);
  const canSeeProposals = items.some((item) => item.href === '/quote-proposals');
  const [awaitingProposalCount, setAwaitingProposalCount] = useState<number | null>(null);

  useEffect(() => {
    if (!canSeeProposals) return;

    let active = true;
    const refresh = async () => {
      const result = await getPendingQuoteProposalCountAction();
      if (active && result.success) setAwaitingProposalCount(result.pendingTotal);
    };
    const receiveCount = (event: Event) => {
      const count = (event as CustomEvent<number>).detail;
      if (Number.isInteger(count) && count >= 0) {
        setAwaitingProposalCount(count);
        return;
      }

      void refresh();
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

  function renderNode(node: NavigationNode, depth = 0): React.ReactNode {
    const Icon = node.icon;
    const [targetPath, targetQuery] = (node.href ?? '').split('?');
    const active =
      Boolean(node.href) &&
      isCurrentRoute(pathname, targetPath) &&
      (node.href !== '/registrations' ||
        (!searchParams.has('roleCodes') && pathname !== '/registrations/new')) &&
      (!targetQuery ||
        [...new URLSearchParams(targetQuery)].every(
          ([key, value]) => (searchParams.get(key) ?? (key === 'tab' ? 'issues' : '')) === value,
        ));
    if (node.children)
      return (
        <li key={node.label}>
          <details
            open={
              depth === 0 || node.children.some((child) => child.href?.split('?')[0] === pathname)
            }
            className="[&[open]>summary>svg:last-child]:rotate-90"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-sidebar-accent [&::-webkit-details-marker]:hidden">
              {Icon && (
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">{node.label}</span>
              <ChevronRight className="size-3.5 shrink-0 transition-transform" aria-hidden="true" />
            </summary>
            <ul className="ml-3 space-y-0.5 border-l border-sidebar-border pl-2">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </ul>
          </details>
        </li>
      );
    return (
      <SidebarMenuItem key={node.href}>
        <Link
          href={node.href!}
          aria-label={node.label}
          aria-describedby={
            node.href === '/quote-proposals' &&
            awaitingProposalCount !== null &&
            awaitingProposalCount > 0
              ? 'navigation-pending-proposals'
              : undefined
          }
          aria-current={active ? 'page' : undefined}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
          className={
            'flex min-h-9 min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
            (active
              ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent')
          }
        >
          {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="min-w-0 break-words">{node.label}</span>
          {node.href === '/quote-proposals' &&
            awaitingProposalCount !== null &&
            awaitingProposalCount > 0 && (
              <span
                id="navigation-pending-proposals"
                aria-label={awaitingProposalCount + ' orçamentos pendentes'}
                className="ml-auto inline-flex shrink-0 items-center gap-1 pl-2 text-xs font-medium tabular-nums"
              >
                <BellDot className="size-3.5" aria-hidden="true" />
                {awaitingProposalCount > 99 ? '99+' : awaitingProposalCount}
              </span>
            )}
        </Link>
      </SidebarMenuItem>
    );
  }
  return (
    <>
      {getNavigationTree(user).map((group) => (
        <SidebarGroup
          key={group.label || 'shortcuts'}
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
