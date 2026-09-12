'use client';
import { hasPermission, type User, type Permission } from '@/features/auth/domain';
import { CatalogPanel } from './catalog-panel';
import { catalogs, labels } from './catalog-config';

export function CatalogWorkspace({
  user,
  resource,
  catalogKind,
}: {
  user: User;
  resource: 'companies' | 'fleet' | 'catalogs';
  catalogKind?: string;
}) {
  const config = catalogs[resource];
  const can = (action: string) =>
    hasPermission(user, (config.permission + ':' + action) as Permission) ||
    hasPermission(user, (config.permission + ':manage') as Permission);
  return (
    <main className="lume-page space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">
        {catalogKind ? labels[catalogKind] : config.label}
      </h1>
      <CatalogPanel
        resource={resource}
        catalogKind={catalogKind}
        canCreate={can('create')}
        canUpdate={can('update')}
        canDeactivate={
          can('update') &&
          user.type === 'employee' &&
          user.departments.some((department) => ['management', 'directorate'].includes(department))
        }
      />
    </main>
  );
}
