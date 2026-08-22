'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellDot } from 'lucide-react';

import type { User } from '@/features/auth/domain';
import { getPendingQuoteProposalCountAction } from '@/features/quote-proposals/actions';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/sidebar';

import { getAuthorizedNavigationItems } from './navigation-items';

export interface AuthenticatedNavigationProps {
  readonly user: User;
}

function isCurrentRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AuthenticatedNavigation({ user }: AuthenticatedNavigationProps) {
  const pathname = usePathname();
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

  return (
    <>
      {[
        { label: 'Geral', items: items.filter((item) => item.group === 'general') },
        { label: 'Cadastros', items: items.filter((item) => item.group === 'records') },
        { label: 'Comercial', items: items.filter((item) => item.group === 'commercial') },
        {
          label: 'Pessoas',
          items: items.filter((item) => item.group === 'people-operations'),
        },
        {
          label: 'Administração',
          items: items.filter((item) => item.group === 'administration'),
        },
      ].map((group) =>
        group.items.length > 0 ? (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isQuoteItem = item.href === '/quote-proposals';
                  const active = isCurrentRoute(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={
                          <Link href={item.href} aria-current={active ? 'page' : undefined} />
                        }
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {isQuoteItem &&
                      awaitingProposalCount !== null &&
                      awaitingProposalCount > 0 ? (
                        <SidebarMenuBadge
                          className="gap-1 text-warning-emphasis"
                          aria-label={`${awaitingProposalCount} orçamentos pendentes`}
                        >
                          <BellDot aria-hidden="true" className="size-3.5" />
                          {awaitingProposalCount > 99 ? '99+' : awaitingProposalCount}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null,
      )}
    </>
  );
}
