'use client';

import Link from 'next/link';
import { ChevronsUpDown, CircleUserRound, LifeBuoy, UserRound, Files } from 'lucide-react';

import { LogoutButton } from '@/features/auth/components';
import { hasPermission, type User } from '@/features/auth/domain';
import { CurrentUserAvatar } from '@/shared/current-user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/shared/ui/sidebar';

export function NavUser({ user }: { readonly user: User }) {
  const { isMobile } = useSidebar();
  const accountTypeLabel = user.type === 'employee' ? 'Atendente' : 'Cliente';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <CurrentUserAvatar
              name={user.name}
              className="size-8 rounded-lg"
              imageClassName="rounded-lg"
              fallbackClassName="rounded-lg"
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{accountTypeLabel}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-64"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2 p-2">
                <CircleUserRound className="size-4" aria-hidden="true" />
                <span className="grid">
                  <strong className="font-semibold text-foreground">{user.name}</strong>
                  <small className="font-normal">{accountTypeLabel}</small>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {hasPermission(user, 'profile:view') || hasPermission(user, 'profile:update') ? (
                <DropdownMenuItem render={<Link href="/profile" />}>
                  <UserRound aria-hidden="true" />
                  Meu perfil
                </DropdownMenuItem>
              ) : null}
              {hasPermission(user, 'documents:view') ? (
                <DropdownMenuItem render={<Link href="/documents" />}>
                  <Files aria-hidden="true" />
                  Meus documentos
                </DropdownMenuItem>
              ) : null}
              {hasPermission(user, 'support:view') || hasPermission(user, 'support:create') ? (
                <DropdownMenuItem render={<Link href="/support" />}>
                  <LifeBuoy aria-hidden="true" />
                  Suporte
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="p-1 [&_form]:w-full [&_button]:w-full [&_button]:justify-start">
              <LogoutButton />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
