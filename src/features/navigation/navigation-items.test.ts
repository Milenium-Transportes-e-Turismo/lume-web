import { FileText, LayoutDashboard } from 'lucide-react';

import type { EmployeeUser } from '@/features/auth/domain';

import {
  getAuthorizedNavigationItems,
  INTERNAL_NAVIGATION_ITEMS,
  type InternalNavigationItem,
} from './navigation-items';

function createEmployee(
  permissions: EmployeeUser['permissions'],
  isActive = true,
  departments: readonly string[] = ['commercial'],
): EmployeeUser {
  return {
    id: 'employee-001',
    name: 'Maria Silva',
    type: 'employee',
    departments,
    permissions,
    clientCategory: null,
    isActive,
  };
}

describe('getAuthorizedNavigationItems', () => {
  it('returns an implemented route when the user has its permission', () => {
    const items = getAuthorizedNavigationItems(createEmployee(['dashboard:view']));

    expect(items.map((item) => item.label)).toEqual(['Dashboard']);
    expect(INTERNAL_NAVIGATION_ITEMS).toHaveLength(17);
  });

  it('shows License only with its explicit permission inside Management', () => {
    const items = getAuthorizedNavigationItems(
      createEmployee(['dashboard:view', 'license:view'], true, ['management']),
    );

    expect(items.map((item) => item.label)).toContain('Licença');
  });

  it.each(['users:view', 'users:create', 'users:update', 'users:manage'] as const)(
    'shows Users with any related permission: %s',
    (permission) => {
      const items = getAuthorizedNavigationItems(
        createEmployee([permission], true, ['commercial']),
      );

      expect(items.map((item) => item.label)).toContain('Usuários');
    },
  );

  it.each([
    'clients:view',
    'clients:create',
    'clients:update',
    'clients:manage',
    'clients:history',
  ] as const)('shows Cadastro to any department with a related permission: %s', (permission) => {
    const items = getAuthorizedNavigationItems(createEmployee([permission], true, ['operations']));

    expect(items.map((item) => item.label)).toContain('Cadastro');
  });

  it('shows reconciliation only with history or management permission', () => {
    expect(
      getAuthorizedNavigationItems(createEmployee(['clients:view'])).map((item) => item.label),
    ).not.toContain('Conciliação de Cadastros');
    expect(
      getAuthorizedNavigationItems(createEmployee(['clients:history'])).map((item) => item.label),
    ).toContain('Conciliação de Cadastros');
  });

  it('shows knowledge with any authoritative knowledge permission without an extra department gate', () => {
    for (const permission of ['knowledge:view', 'knowledge:manage', 'knowledge:publish'] as const) {
      expect(
        getAuthorizedNavigationItems(createEmployee([permission], true, ['purchasing'])).map(
          (item) => item.label,
        ),
      ).toContain('Knowledge Base');
    }
  });

  it('shows registration reviews only with clients management permission', () => {
    expect(
      getAuthorizedNavigationItems(createEmployee(['clients:manage'], true, ['operations'])).map(
        (item) => item.label,
      ),
    ).toContain('Revisões cadastrais');
    expect(
      getAuthorizedNavigationItems(createEmployee(['clients:view'], true, ['operations'])).map(
        (item) => item.label,
      ),
    ).not.toContain('Revisões cadastrais');
  });

  it('shows route planning only inside an operational employee scope', () => {
    const operational = getAuthorizedNavigationItems(
      createEmployee(['route-planner:calculate'], true, ['operations']),
    );
    const unrelated = getAuthorizedNavigationItems(
      createEmployee(['route-planner:calculate'], true, ['purchasing']),
    );

    expect(operational.map((item) => item.label)).toContain('Roteirização');
    expect(unrelated.map((item) => item.label)).not.toContain('Roteirização');
  });

  it('shows Users to an explicit administrator even without department data', () => {
    const administrator = {
      ...createEmployee(['users:view'], true, []),
      isAdministrator: true,
    };

    expect(getAuthorizedNavigationItems(administrator).map((item) => item.label)).toContain(
      'Usuários',
    );
  });

  it('shows the administration dashboard only to administrators', () => {
    const regularUser = createEmployee(['settings:view'], true, ['management']);
    const administrator = { ...regularUser, isAdministrator: true };

    expect(getAuthorizedNavigationItems(regularUser).map((item) => item.label)).not.toContain(
      'Painel administrativo',
    );
    expect(getAuthorizedNavigationItems(administrator).map((item) => item.label)).toContain(
      'Painel administrativo',
    );
  });

  it('requires the explicit license permission inside Management', () => {
    const items = getAuthorizedNavigationItems(
      createEmployee(['dashboard:view'], true, ['management']),
    );

    expect(items.map((item) => item.label)).toEqual(['Dashboard']);
    expect(items.map((item) => item.label)).not.toContain('Licença');
  });

  it('filters each navigation destination by its required permission', () => {
    const items: readonly InternalNavigationItem[] = [
      {
        label: 'Dashboard',
        href: '/dashboard',
        permission: 'dashboard:view',
        icon: LayoutDashboard,
      },
      {
        label: 'Relatórios',
        href: '/reports',
        permission: 'reports:view',
        icon: FileText,
      },
    ];

    const authorizedItems = getAuthorizedNavigationItems(createEmployee(['reports:view']), items);

    expect(authorizedItems.map((item) => item.label)).toEqual(['Relatórios']);
  });

  it('exposes the proposal queue only to WhatsApp attendants', () => {
    const items = getAuthorizedNavigationItems(
      createEmployee(['dashboard:view', 'whatsapp-conversations:manage']),
    );

    expect(items.map((item) => item.label)).toContain('Orçamentos');
    expect(items.map((item) => item.label)).toContain('Contatos');
    expect(items.find((item) => item.label === 'Orçamentos')?.href).toBe('/quote-proposals');
  });

  it('grants the service workspace across internal departments but keeps other commercial routes scoped', () => {
    const commercialAdministrator = getAuthorizedNavigationItems(
      createEmployee(['dashboard:view', 'users:view'], true, ['commercial']),
    );
    const operationsWithServicePermission = getAuthorizedNavigationItems(
      createEmployee(['dashboard:view', 'service:view'], true, ['operations']),
    );

    expect(commercialAdministrator.map((item) => item.label)).toContain('Usuários');
    expect(commercialAdministrator.map((item) => item.label)).not.toContain('Licença');
    expect(operationsWithServicePermission.map((item) => item.label)).toContain('Painel WhatsApp');
    expect(operationsWithServicePermission.map((item) => item.label)).not.toContain('Orçamentos');
  });

  it('keeps legacy WhatsApp permissions as navigation aliases without granting by default', () => {
    expect(
      getAuthorizedNavigationItems(
        createEmployee(['whatsapp-conversations:view'], true, ['operations']),
      ).map((item) => item.label),
    ).toContain('Painel WhatsApp');
    expect(
      getAuthorizedNavigationItems(createEmployee([], true, ['operations'])).map(
        (item) => item.label,
      ),
    ).not.toContain('Painel WhatsApp');
  });

  it('does not expose destinations to an inactive user', () => {
    const items = getAuthorizedNavigationItems(createEmployee(['dashboard:view'], false));

    expect(items).toEqual([]);
  });

  it('restricts document portal users to their own document route', () => {
    const user = {
      ...createEmployee(['dashboard:view', 'documents:view', 'documents:manage'], true, [
        'personnel-department',
      ]),
      documentAccessMode: 'document-portal' as const,
    };

    expect(getAuthorizedNavigationItems(user).map((item) => item.href)).toEqual(['/documents']);
  });
});
