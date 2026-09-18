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
  Route,
  RadioTower,
  ContactRound,
  Building2,
  Bus,
  Tags,
  ScanSearch,
  Users,
  BookOpenCheck,
  ListChecks,
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
  | 'general'
  | 'records'
  | 'commercial'
  | 'operations'
  | 'people-operations'
  | 'administration'
  | 'financial';

export interface InternalNavigationItem {
  readonly label: string;
  readonly href: string;
  readonly navigationKey?: string;
  readonly permission: Permission;
  readonly alternativePermissions?: readonly Permission[];
  readonly icon: LucideIcon;
  readonly group?: NavigationGroup;
  readonly administratorOnly?: boolean;
}

export const INTERNAL_NAVIGATION_ITEMS: readonly InternalNavigationItem[] = [
  {
    label: 'CNPJs do tenant',
    href: '/companies',
    permission: 'clients:view',
    alternativePermissions: ['clients:manage'],
    icon: Building2,
    group: 'general',
  },
  {
    label: 'Frota',
    href: '/fleet',
    permission: 'trips:view',
    alternativePermissions: ['trips:manage'],
    icon: Bus,
    group: 'records',
  },
  {
    label: 'Tipos e categorias',
    href: '/catalogs',
    permission: 'trips:view',
    alternativePermissions: ['trips:manage'],
    icon: Tags,
    group: 'records',
  },
  {
    label: 'Registros',
    href: '/transport',
    permission: 'trips:view',
    alternativePermissions: ['trips:manage', 'contracts:view', 'contracts:manage'],
    icon: Route,
    group: 'financial',
  },
  {
    label: 'Avic System',
    href: '/integrations/avic',
    permission: 'trips:view',
    alternativePermissions: ['trips:manage'],
    icon: RadioTower,
    group: 'general',
  },
  {
    label: 'Cadastro',
    href: '/registrations',
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
    label: 'Conciliação de Cadastros',
    href: '/registration-reconciliation',
    permission: 'clients:history',
    alternativePermissions: ['clients:manage'],
    icon: ScanSearch,
    group: 'records',
  },
  {
    label: 'Revisões cadastrais',
    href: '/registration-data-reviews',
    permission: 'clients:manage',
    icon: ListChecks,
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
    permission: 'ai-agents:view',
    icon: Bot,
    group: 'administration',
  },
  {
    label: 'Conhecimento',
    href: '/knowledge',
    permission: 'knowledge:view',
    alternativePermissions: ['knowledge:manage', 'knowledge:publish'],
    icon: BookOpenCheck,
    group: 'general',
  },
  {
    label: 'Painel WhatsApp',
    href: '/whatsapp-conversations',
    permission: 'service:view',
    alternativePermissions: ['whatsapp-conversations:view', 'whatsapp-conversations:manage'],
    icon: MessageCircle,
    group: 'commercial',
  },
  {
    label: 'Contatos',
    href: '/contacts',
    permission: 'clients:view',
    icon: ContactRound,
    group: 'records',
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
    label: 'Roteirização',
    href: '/operacao/roteirizacao',
    permission: 'route-planner:view',
    alternativePermissions: ['route-planner:calculate'],
    icon: Route,
    group: 'operations',
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
    label: 'Canais WhatsApp',
    href: '/whatsapp-channels',
    permission: 'whatsapp-channels:view',
    icon: RadioTower,
    group: 'administration',
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

const NAVIGATION_KEYS_BY_PATH: Readonly<Record<string, string>> = {
  '/dashboard': 'dashboard',
  '/routing': 'operations.routing',
  '/operacao/roteirizacao': 'operations.routing',
  '/companies': 'company.companies',
  '/fleet': 'company.fleet',
  '/registrations': 'company.registrations',
  '/contacts': 'company.contacts',
  '/knowledge': 'company.knowledge',
  '/ai-agents': 'company.ai-agents',
  '/whatsapp-conversations': 'company.whatsapp-conversations',
  '/quote-proposals': 'company.quote-proposals',
  '/users': 'company.users',
  '/administration': 'company.administration',
  '/whatsapp-channels': 'company.whatsapp-channels',
  '/license': 'company.license',
  '/support': 'company.support',
  '/documents': 'company.documents',
  '/document-management': 'company.document-management',
  '/transport': 'operations.transport',
  '/integrations/avic': 'company.integrations.avic',
  '/catalogs': 'company.catalogs',
  '/registration-reconciliation': 'company.registration-reconciliation',
  '/registration-data-reviews': 'company.registration-data-reviews',
};

export function navigationKeyForHref(href: string): string | undefined {
  return NAVIGATION_KEYS_BY_PATH[href.split('?')[0]];
}

function hasOrganizationalScope(user: User, item: InternalNavigationItem): boolean {
  if (user.isAdministrator === true) return true;
  if (item.href === '/users' || item.href === '/transport') return true;
  if (item.href === '/whatsapp-conversations') return user.type === 'employee';
  if (item.group === 'commercial') return hasCommercialScope(user);
  if (item.group === 'operations') {
    return (
      user.type === 'employee' &&
      user.departments.some((department) =>
        ['management', 'commercial', 'operations', 'information-technology'].includes(department),
      )
    );
  }
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
