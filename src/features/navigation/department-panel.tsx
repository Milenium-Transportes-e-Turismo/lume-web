import Link from 'next/link';

import type { User } from '@/features/auth/domain';
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

import { AuthenticatedShell } from './authenticated-shell';
import type { NavigationNode } from './navigation-tree';

export interface DepartmentPanelProps {
  readonly user: User;
  readonly title: string;
  readonly description: string;
  readonly navigation: NavigationNode;
}

function collectDestinations(node: NavigationNode, result: NavigationNode[] = []): NavigationNode[] {
  for (const child of node.children ?? []) {
    if (child.href) result.push(child);
    collectDestinations(child, result);
  }
  return result;
}

export function DepartmentPanel({ user, title, description, navigation }: DepartmentPanelProps) {
  const destinations = collectDestinations(navigation);

  return (
    <AuthenticatedShell user={user}>
      <main
        className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8"
        aria-label={`Painel ${title}`}
      >
        <div>
          <p className="text-sm font-medium text-muted-foreground">Departamento</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Indicadores do departamento</CardTitle>
            <CardDescription>
              Os indicadores serão exibidos aqui quando o contrato de dados estiver confirmado na
              Tenant API.
            </CardDescription>
          </CardHeader>
        </Card>

        <section aria-labelledby={`${navigation.href}-telas`}>
          <h2 id={`${navigation.href}-telas`} className="text-lg font-semibold">
            Telas disponíveis
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((destination) => (
              <Link
                key={destination.href}
                href={destination.href!}
                className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{destination.label}</CardTitle>
                    <CardDescription>Abrir tela do departamento.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </AuthenticatedShell>
  );
}
