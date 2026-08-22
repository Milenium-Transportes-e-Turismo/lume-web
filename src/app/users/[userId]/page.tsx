import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TenantAdministrationError } from '@/features/tenant-administration/application';
import type { PermissionCatalog, TenantUser } from '@/features/tenant-administration/domain';
import { UserEditorForm, withoutLicenseManagement } from '@/features/tenant-administration/users';
import {
  executeAuthenticatedTenantRequest,
  requirePeopleOperationsTenantSession,
  rethrowTenantPageError,
} from '@/features/tenant-administration/server';
import { AuthenticatedShell } from '@/features/navigation';
import { Button } from '@/shared/ui/button';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { executeAuthenticatedRoutingRequest } from '@/features/routing/server';

export default async function UserEditorRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ userId: string }>;
  readonly searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requirePeopleOperationsTenantSession(['users:update', 'users:create']);
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  let user: TenantUser;
  let routingCompanies: readonly { readonly id: string; readonly label: string }[] = [];
  let permissionCatalog: PermissionCatalog = {
    resources: [],
    actions: [],
    actionsByResource: {},
    permissions: [],
    permissionsByDepartment: {},
    implicitPermissions: [],
  };
  const canManageAccess =
    session.user.isAdministrator === true ||
    (session.user.type === 'employee' &&
      session.user.departments.includes('information-technology'));

  try {
    if (canManageAccess) {
      [user, permissionCatalog] = await executeAuthenticatedTenantRequest((gateway) =>
        Promise.all([gateway.getUser(userId), gateway.listPermissions()]),
      );
      if (!session.user.isAdministrator) {
        permissionCatalog = withoutLicenseManagement(permissionCatalog);
      }
    } else {
      user = await executeAuthenticatedTenantRequest((gateway) => gateway.getUser(userId));
    }
  } catch (error) {
    if (error instanceof TenantAdministrationError && error.code === 'not-found') notFound();
    rethrowTenantPageError(error);
  }

  if (canManageAccess && session.user.permissions.includes('clients:view')) {
    const companies = await executeAuthenticatedRoutingRequest((gateway) =>
      gateway.listCompanies({ status: 'active' }),
    );
    routingCompanies = companies.items.map((company) => ({
      id: company.id,
      label: `${company.tradeName || company.legalName} — ${company.taxId}`,
    }));
  }

  return (
    <AuthenticatedShell user={session.user}>
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <Button render={<Link href="/users" />} nativeButton={false} variant="outline">
          Voltar para usuários
        </Button>
        <header className="my-8">
          <p className="text-sm font-medium text-primary-emphasis">Administração local</p>
          <h1 className="text-3xl font-bold tracking-tight">Editar {user.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {canManageAccess
              ? 'Revise os dados, departamentos e permissões individuais.'
              : 'Revise os dados pessoais e o perfil usado nas exigências documentais.'}
          </p>
        </header>
        <PageFeedbackToast error={query.error} success={query.success} />
        <UserEditorForm
          user={user}
          permissionCatalog={permissionCatalog}
          canManageAccess={canManageAccess}
          routingCompanies={routingCompanies}
        />
      </div>
    </AuthenticatedShell>
  );
}
