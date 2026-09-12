import { Users, Database, Bus, BookUser, ClipboardList, type LucideIcon } from 'lucide-react';
import { hasPermission, type User } from '@/features/auth/domain';
import { getAuthorizedNavigationItems } from './navigation-items';
export type NavigationNode = {
  label: string;
  href?: string;
  icon?: LucideIcon;
  children?: NavigationNode[];
};
export function getNavigationTree(user: User): { label: string; items: NavigationNode[] }[] {
  const allowed = getAuthorizedNavigationItems(user);
  const lookup = (href: string, label?: string, target?: string): NavigationNode[] => {
    const item = allowed.find((candidate) => candidate.href === href);
    return item ? [{ label: label ?? item.label, href: target ?? item.href, icon: item.icon }] : [];
  };
  const branch = (
    label: string,
    children: NavigationNode[],
    icon?: LucideIcon,
  ): NavigationNode[] => (children.length ? [{ label, children, icon }] : []);
  const people = [
    ...lookup('/registrations', 'Funcionários', '/registrations?roleCodes=employee'),
    ...lookup(
      '/registrations',
      'Prestadores de serviço',
      '/registrations?roleCodes=service-provider',
    ),
    ...lookup('/registrations', 'Fornecedores', '/registrations?roleCodes=supplier'),
    ...lookup('/contacts'),
  ];
  const registrations = [
    ...lookup('/registrations', 'Consultar'),
    ...(hasPermission(user, 'clients:create')
      ? lookup('/registrations', 'Criar', '/registrations/new')
      : []),
    ...lookup('/registration-reconciliation'),
    ...lookup('/registration-data-reviews'),
  ];
  const records = allowed.find((item) => item.href === '/transport');
  const canTrips = hasPermission(user, 'trips:view') || hasPermission(user, 'trips:manage');
  const canContracts =
    hasPermission(user, 'contracts:view') || hasPermission(user, 'contracts:manage');
  const recordChildren: NavigationNode[] = records
    ? [
        ...(canTrips
          ? [
              { label: 'Pendências', href: '/transport?tab=issues' },
              { label: 'Importação e análise', href: '/transport?tab=imports' },
              { label: 'Registros importados', href: '/transport?tab=records' },
            ]
          : []),
        ...(canContracts ? [{ label: 'Rotas de origem', href: '/transport?tab=routes' }] : []),
        ...(canTrips && canContracts
          ? [{ label: 'KM por contrato', href: '/transport?tab=summary' }]
          : []),
      ]
    : [];
  if (user.documentAccessMode === 'document-portal')
    return [{ label: 'Pessoal', items: lookup('/documents') }].filter(
      (group) => group.items.length,
    );
  return [
    { label: '', items: [...lookup('/whatsapp-conversations'), ...lookup('/document-management')] },
    {
      label: 'Empresa',
      items: [
        ...branch(
          'Dados',
          [
            ...lookup('/companies'),
            ...branch('Integrações', lookup('/integrations/avic')),
            ...branch('Pessoas', people, Users),
            ...branch(
              'Frota',
              [
                ...lookup('/fleet', 'Veículos'),
                ...lookup('/catalogs', 'Tipos de serviço', '/catalogs?kind=service-type'),
                ...lookup('/catalogs', 'Tipos de veículo', '/catalogs?kind=vehicle-type'),
                ...lookup('/catalogs', 'Categorias', '/catalogs?kind=category'),
              ],
              Bus,
            ),
            ...lookup('/knowledge'),
          ],
          Database,
        ),
        ...lookup('/ai-agents'),
        ...branch('Cadastro', registrations, BookUser),
        ...lookup('/whatsapp-channels'),
      ],
    },
    {
      label: 'Plataforma',
      items: [...lookup('/users'), ...lookup('/administration'), ...lookup('/license')],
    },
    { label: 'Dashboards', items: lookup('/dashboard') },
    {
      label: 'Financeiro',
      items: branch('Controle', branch('Registros', recordChildren, ClipboardList)),
    },
    { label: 'Operacional', items: lookup('/routing') },
    { label: 'Comercial', items: lookup('/quote-proposals') },
  ].filter((group) => group.items.length);
}
