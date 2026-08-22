import {
  BadgeCheck,
  ChartNoAxesCombined,
  Bot,
  ClipboardCheck,
  FileClock,
  Files,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  ContactRound,
  Building2,
  Users,
  type LucideIcon,
} from 'lucide-react';

import {
  canAccessLicense,
  hasCommercialScope,
  hasManagementLeadershipScope,
  hasPermission,
  type Permission,
  type User,
} from '@/features/auth/domain';

export type NavigationGroup =
  'general' | 'records' | 'commercial' | 'people-operations' | 'administration';

export interface InternalNavigationItem {
  readonly label: string;
  readonly href: string;
  readonly permission: Permission;
  readonly alternativePermissions?: readonly Permission[];
  readonly icon: LucideIcon;
  readonly group?: NavigationGroup;
  readonly administratorOnly?: boolean;
}

export const INTERNAL_NAVIGATION_ITEMS: readonly InternalNavigationItem[] = [
  {
    label: 'Clientes',
    href: '/clients',
    permission: 'clients:view',
    alternativePermissions: [
      'clients:create',
      'clients:update',
      'clients:manage',
      'clients:history',
    ],
    icon: Building2,
    group: 'records',
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    permission: 'dashboard:view',
    icon: LayoutDashboard,
    group: 'general',
  },
  {
    label: 'Agentes de IA',
    href: '/ai-agents',
    permission: 'ai-agents:use',
    icon: Bot,
    group: 'general',
  },
  {
    label: 'Painel WhatsApp',
    href: '/whatsapp-conversations',
    permission: 'whatsapp-conversations:manage',
    icon: MessageCircle,
    group: 'commercial',
  },
  {
    label: 'Contatos',
    href: '/contacts',
    permission: 'whatsapp-conversations:view',
    alternativePermissions: ['whatsapp-conversations:manage'],
    icon: ContactRound,
    group: 'commercial',
  },
  {
    label: 'Orçamentos',
    href: '/quote-proposals',
    permission: 'whatsapp-conversations:manage',
    alternativePermissions: ['whatsapp-conversations:view', 'commercial:view', 'commercial:manage'],
    icon: FileClock,
    group: 'commercial',
  },
  {
    label: 'Usuários',
    href: '/users',
    permission: 'users:view',
    alternativePermissions: ['users:create', 'users:update', 'users:manage'],
    icon: Users,
    group: 'people-operations',
  },
  {
    label: 'Painel administrativo',
    href: '/administration',
    permission: 'settings:view',
    icon: ChartNoAxesCombined,
    group: 'administration',
    administratorOnly: true,
  },
  {
    label: 'Licença',
    href: '/license',
    permission: 'license:view',
    icon: BadgeCheck,
    group: 'administration',
  },
  {
    label: 'Suporte',
    href: '/support',
    permission: 'support:view',
    icon: LifeBuoy,
    group: 'general',
  },
  {
    label: 'Meus documentos',
    href: '/documents',
    permission: 'documents:view',
    icon: Files,
    group: 'general',
  },
  {
    label: 'Gestão documental',
    href: '/document-management',
    permission: 'documents:manage',
    icon: ClipboardCheck,
    group: 'people-operations',
  },
];

function hasOrganizationalScope(user: User, item: InternalNavigationItem): boolean {
  if (user.isAdministrator === true) return true;
  if (item.href === '/users') return true;
  if (item.group === 'commercial') return hasCommercialScope(user);
  if (item.group === 'people-operations') {
    return (
      user.type === 'employee' &&
      user.departments.some((department) =>
        ['management', 'personnel-department', 'human-resources'].includes(department),
      )
    );
  }
  if (item.group === 'administration') return hasManagementLeadershipScope(user);
  return true;
}

function hasNavigationPermission(user: User, item: InternalNavigationItem): boolean {
  return (
    hasPermission(user, item.permission) ||
    item.alternativePermissions?.some((permission) => hasPermission(user, permission)) === true
  );
}

export function getAuthorizedNavigationItems(
  user: User,
  items: readonly InternalNavigationItem[] = INTERNAL_NAVIGATION_ITEMS,
): InternalNavigationItem[] {
  if (user.documentAccessMode === 'document-portal') {
    return items.filter(
      (item) => item.href === '/documents' && hasNavigationPermission(user, item),
    );
  }
  return items.filter(
    (item) =>
      hasNavigationPermission(user, item) &&
      (!item.administratorOnly || user.isAdministrator === true) &&
      hasOrganizationalScope(user, item) &&
      (item.href !== '/license' || canAccessLicense(user)),
  );
}
