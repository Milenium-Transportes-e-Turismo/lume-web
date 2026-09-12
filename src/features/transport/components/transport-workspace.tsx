'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { hasPermission, type User, type Permission } from '@/features/auth/domain';
import type { CatalogResource } from '../domain/contracts';
import { catalogs } from './catalog-config';
import { CatalogPanel } from './catalog-panel';
import { ImportPanel, TripPanel } from './trip-panel';
import { SummaryPanel } from './summary-panel';

type Tab = CatalogResource | 'imports' | 'records' | 'issues' | 'summary';
export function TransportWorkspace({ user, initialTab }: { user: User; initialTab?: string }) {
  const can = (resource: string, action: string) =>
    hasPermission(user, (resource + ':' + action) as Permission);
  const catalogTabs = (['routes'] as CatalogResource[]).filter(
    (resource) =>
      can(catalogs[resource].permission, 'view') || can(catalogs[resource].permission, 'manage'),
  );
  const trips = can('trips', 'view') || can('trips', 'manage');
  const allTabs: { id: Tab; label: string }[] = [
    ...(trips
      ? [
          { id: 'issues' as const, label: 'Pendências' },
          { id: 'records' as const, label: 'Registros importados' },
          { id: 'imports' as const, label: 'Importação e análise' },
        ]
      : []),
    ...catalogTabs.map((id) => ({ id, label: catalogs[id].label })),
    ...(trips && (can('contracts', 'view') || can('contracts', 'manage'))
      ? [{ id: 'summary' as const, label: 'KM por contrato' }]
      : []),
  ];
  const [tab, setTab] = useState<Tab>(
    allTabs.find((item) => item.id === initialTab)?.id ?? allTabs[0]?.id ?? 'routes',
  );
  const permission = tab in catalogs ? catalogs[tab as CatalogResource].permission : 'trips';
  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-4 md:p-6" aria-label="Registros">
      <div>
        <h1 className="text-2xl font-semibold">Registros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importação, conferência dos registros de viagens e acompanhamento de quilometragem.
        </p>
      </div>
      <nav aria-label="Áreas de registros" className="flex flex-wrap gap-2">
        {allTabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? 'default' : 'outline'}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      {tab in catalogs ? (
        <CatalogPanel
          key={tab}
          resource={tab as CatalogResource}
          canCreate={can(permission, 'create') || can(permission, 'manage')}
          canUpdate={can(permission, 'update') || can(permission, 'manage')}
          canDeactivate={
            (can('clients', 'update') || can('clients', 'manage')) &&
            user.type === 'employee' &&
            user.departments.some((department) =>
              ['management', 'directorate'].includes(department),
            )
          }
        />
      ) : tab === 'records' || tab === 'issues' ? (
        <TripPanel key={tab} resource={tab} canManage={can('trips', 'manage')} />
      ) : tab === 'imports' ? (
        <ImportPanel canManage={can('trips', 'manage')} />
      ) : tab === 'summary' ? (
        <SummaryPanel canManage={can('trips', 'manage')} />
      ) : null}
    </main>
  );
}
