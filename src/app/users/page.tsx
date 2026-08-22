import { AuthenticatedShell } from '@/features/navigation';
import {
  type UserListFilters,
  UsersManagement,
  withoutLicenseManagement,
} from '@/features/tenant-administration/users';
import type {
  PermissionCatalog,
  TenantUserList,
  TenantUserStatus,
} from '@/features/tenant-administration/domain';
import {
  executeAuthenticatedTenantRequest,
  requireTenantSession,
  rethrowTenantPageError,
} from '@/features/tenant-administration/server';
import { PageFeedbackToast } from '@/shared/page-feedback-toast';
import { executeAuthenticatedRoutingRequest } from '@/features/routing/server';

export default async function UsersRoute({
  searchParams,
}: {
  readonly searchParams: Promise<{
    error?: string;
    success?: string;
    search?: string;
    department?: string;
    permission?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const session = await requireTenantSession([
    'users:view',
    'users:create',
    'users:update',
    'users:manage',
  ]);
  const query = await searchParams;
  let users: TenantUserList;
  let routingCompanies: readonly { readonly id: string; readonly label: string }[] = [];
  let permissionCatalog: PermissionCatalog = {
    resources: [],
    actions: [],
    actionsByResource: {},
    permissions: [],
    permissionsByDepartment: {},
    implicitPermissions: [],
  };
  const status = ['active', 'inactive', 'suspended'].includes(query.status ?? '')
    ? (query.status as TenantUserStatus)
    : undefined;
  const filters: UserListFilters = {
    search: query.search?.trim() || undefined,
    department: query.department && query.department !== '__all__' ? query.department : undefined,
    permission: query.permission && query.permission !== '__all__' ? query.permission : undefined,
    status,
  };
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const canManageAccess =
    session.user.isAdministrator === true ||
    (session.user.type === 'employee' &&
      session.user.departments.includes('information-technology'));

  try {
    if (canManageAccess) {
      [users, permissionCatalog] = await executeAuthenticatedTenantRequest((gateway) =>
        Promise.all([
          gateway.listUsers({ ...filters, page, pageSize: 20 }),
          gateway.listPermissions(),
        ]),
      );
      if (!session.user.isAdministrator) {
        permissionCatalog = withoutLicenseManagement(permissionCatalog);
      }
    } else {
      users = await executeAuthenticatedTenantRequest((gateway) =>
        gateway.listUsers({ ...filters, page, pageSize: 20 }),
      );
    }
  } catch (error) {
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
      <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
        <PageFeedbackToast error={query.error} success={query.success} />
        <UsersManagement
          users={users}
          permissionCatalog={permissionCatalog}
          canCreate={session.user.permissions.includes('users:create')}
          canEdit={
            session.user.isAdministrator === true ||
            session.user.permissions.includes('users:create') ||
            session.user.permissions.includes('users:update')
          }
          canManageAccess={canManageAccess}
          canManageLifecycle={canManageAccess}
          canDelete={session.user.isAdministrator === true}
          currentUserId={session.user.id}
          filters={filters}
          routingCompanies={routingCompanies}
        />
      </div>
    </AuthenticatedShell>
  );
}
