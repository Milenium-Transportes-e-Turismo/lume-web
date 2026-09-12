'use client';

import type { ReactNode, CSSProperties } from 'react';

import type { User } from '@/features/auth/domain';
import { AppSidebar } from '@/shared/app-sidebar';
import { CurrentUserProfilePictureProvider } from '@/shared/current-user-avatar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar';

import { AccentColorPreferenceSync } from './accent-color-preference';

export interface AuthenticatedShellProps {
  readonly user: User;
  readonly children: ReactNode;
}

export function AuthenticatedShell({ user, children }: AuthenticatedShellProps) {
  return (
    <CurrentUserProfilePictureProvider key={user.id} userId={user.id}>
      <AccentColorPreferenceSync userId={user.id} />
      <SidebarProvider
        style={{ '--sidebar-width': '21rem', '--sidebar-width-icon': '3.5rem' } as CSSProperties}
      >
        <AppSidebar user={user} />
        <SidebarInset className="min-w-0">
          <div className="flex h-12 shrink-0 items-center px-4 md:hidden">
            <SidebarTrigger aria-label="Alternar menu lateral" />
          </div>
          <div className="min-w-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </CurrentUserProfilePictureProvider>
  );
}
