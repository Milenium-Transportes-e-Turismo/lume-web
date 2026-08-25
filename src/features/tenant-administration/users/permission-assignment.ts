import type { PermissionCatalog } from '../domain';

const COMMON_PERMISSION_RESOURCES = new Set([
  'dashboard',
  'ai-agents',
  'manuals',
  'profile',
  'support',
]);

const RELATED_PERMISSION_RESOURCES: Readonly<Record<string, readonly string[]>> = {
  commercial: ['commercial', 'clients', 'quotes', 'whatsapp-conversations', 'route-planner'],
  purchasing: ['purchasing', 'contracts', 'documents'],
  controllership: ['financial', 'commercial', 'clients', 'reports'],
  'personnel-department': ['personnel-department', 'human-resources', 'reports'],
  financial: ['financial', 'commercial', 'clients', 'reports', 'invoices'],
  management: ['*'],
  maintenance: ['maintenance', 'operations', 'drivers'],
  monitoring: ['monitoring', 'operations', 'drivers', 'reports'],
  operations: [
    'operations',
    'monitoring',
    'maintenance',
    'cleaning',
    'drivers',
    'reports',
    'trips',
    'service-requests',
    'route-planner',
  ],
  'information-technology': [
    'users',
    'ai-agents',
    'manuals',
    'reports',
    'settings',
    'route-planner',
  ],
};

export function permissionResource(permission: string): string {
  return permission.split(':', 1)[0] ?? permission;
}

export function compatiblePermissionCodes(
  catalog: PermissionCatalog,
  departments: readonly string[],
): readonly string[] {
  if (departments.length === 0) return [];
  const implicit = new Set(catalog.implicitPermissions);

  const published = departments.flatMap(
    (department) => catalog.permissionsByDepartment?.[department] ?? [],
  );

  if (published.length > 0) {
    const publishedSet = new Set(published);
    return catalog.permissions.filter(
      (permission) => publishedSet.has(permission) && !implicit.has(permission),
    );
  }

  const resources = new Set(COMMON_PERMISSION_RESOURCES);
  departments.forEach((department) => {
    (RELATED_PERMISSION_RESOURCES[department] ?? [department]).forEach((resource) =>
      resources.add(resource),
    );
  });

  if (resources.has('*')) {
    return catalog.permissions.filter((permission) => !implicit.has(permission));
  }
  return catalog.permissions.filter(
    (permission) => resources.has(permissionResource(permission)) && !implicit.has(permission),
  );
}

export function groupPermissionsByResource(
  permissions: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const groups = new Map<string, string[]>();

  permissions.forEach((permission) => {
    const resource = permissionResource(permission);
    groups.set(resource, [...(groups.get(resource) ?? []), permission]);
  });

  return new Map(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
      .map(([resource, codes]) => [
        resource,
        [...codes].sort((left, right) => left.localeCompare(right, 'pt-BR')),
      ]),
  );
}
