'use client';

import { Suspense } from 'react';
import type { User } from '@/features/auth/domain';
import { AuthenticatedNavigation } from '@/features/navigation/authenticated-navigation';
import { ThemeToggle } from '@/features/navigation/theme-toggle';
import { AccentColorPicker } from '@/features/navigation/accent-color-preference';
import { CommercialNotificationCenter } from '@/features/navigation/commercial-notification-center';
import { LumeBrand } from '@/shared/lume-brand';
import { NavUser } from '@/shared/nav-user';
import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger } from '@/shared/ui/sidebar';

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  readonly user: User;
}
export function AppSidebar({ user, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <div className="flex h-full min-h-0 min-w-0">
        <div
          aria-label="Ferramentas da aplicação"
          role="toolbar"
          className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-sidebar-border py-3"
        >
          <SidebarTrigger
            aria-label="Recolher ou expandir navegação"
            title="Recolher ou expandir navegação"
          />
          <ThemeToggle />
          <div title="Notificações">
            <CommercialNotificationCenter user={user} />
          </div>
          <AccentColorPicker userId={user.id} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
          <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-3">
            <div className="flex h-8 items-center px-1">
              <LumeBrand compact />
            </div>
            <NavUser user={user} />
          </SidebarHeader>
          <SidebarContent>
            <nav aria-label="Navegação da área interna">
              <Suspense>
                <AuthenticatedNavigation user={user} />
              </Suspense>
            </nav>
          </SidebarContent>
        </div>
      </div>
    </Sidebar>
  );
}
