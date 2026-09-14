export interface TenantUser {
  readonly version: number;
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly cpf: string | null;
  readonly departments: readonly string[];
  readonly isAdministrator: boolean;
  readonly type?: 'employee' | 'candidate' | 'client';
  readonly routingCompanyId?: string | null;
  readonly clientCategory?: 'legal-entity' | 'individual' | null;
  readonly documentAccessMode?: 'standard' | 'document-portal' | 'client';
  readonly jobTitle: string | null;
  readonly maritalStatus:
    'single' | 'married' | 'stable-union' | 'divorced' | 'widowed' | 'not-informed' | null;
  readonly militaryDocumentStatus: 'applicable' | 'not-applicable' | 'pending-confirmation';
  readonly dependents: readonly TenantUserDependent[];
  readonly permissionCodes: readonly string[];
  readonly permissions: readonly string[];
  readonly isActive: boolean;
  readonly status: TenantUserStatus;
  readonly suspendedUntil: string | null;
  readonly suspensionReason: string | null;
  readonly mustChangePassword: boolean;
  readonly hasProfilePicture: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TenantUserDependent {
  readonly name: string;
  readonly birthDate: string;
  readonly relationship?: string;
}

export interface TenantUserList {
  readonly data: readonly TenantUser[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface PermissionCatalog {
  readonly resources: readonly string[];
  readonly actions: readonly string[];
  readonly actionsByResource: Readonly<Record<string, readonly string[]>>;
  readonly permissions: readonly string[];
  readonly permissionsByDepartment?: Readonly<Record<string, readonly string[]>>;
  readonly implicitPermissions: readonly string[];
}

export interface LocalLicenseStatus {
  readonly state: 'active' | 'grace';
  readonly tenantId: string;
  readonly installationId: string;
  readonly plan: string;
  readonly features: readonly string[];
  readonly expiresAt: string;
  readonly graceUntil: string;
}

export interface TenantNotificationItem {
  readonly id: string;
  readonly type: string;
  readonly department: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly count: number;
  readonly unreadCount: number;
  readonly read: boolean;
}

export interface TenantNotificationSummary {
  readonly items: readonly TenantNotificationItem[];
  readonly total: number;
  readonly unreadTotal: number;
}

export interface TenantNotificationReadReceipt {
  readonly notificationId: string;
  readonly pendingTotal: number;
  readonly unreadTotal: number;
  readonly markedRead: number;
  readonly readAt: string;
}

export const COMMERCIAL_PENDING_QUOTES_NOTIFICATION_ID =
  'commercial.pending-quote-proposals' as const;

export interface TenantProfile {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly profilePictureDataUrl: string | null;
}

export interface CreateTenantUserInput {
  readonly routingCompanyId?: string | null;
  readonly clientCategory?: 'legal-entity' | 'individual' | null;
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly isAdministrator: boolean;
  readonly documentAccessMode?: 'standard' | 'document-portal' | 'client';
  readonly requestDocuments?: boolean;
  readonly jobTitle?: string;
  readonly maritalStatus?: NonNullable<TenantUser['maritalStatus']>;
  readonly militaryDocumentStatus?: TenantUser['militaryDocumentStatus'];
  readonly dependents?: readonly TenantUserDependent[];
  readonly departments: readonly string[];
  readonly permissionCodes: readonly string[];
  readonly initialDocumentRequestCommandId?: string;
}

export interface UpdateTenantUserInput {
  readonly commandId: string;
  readonly expectedVersion: number;
  readonly routingCompanyId?: string | null;
  readonly clientCategory?: 'legal-entity' | 'individual' | null;
  readonly name?: string;
  readonly email?: string;
  readonly cpf?: string | null;
  readonly isAdministrator?: boolean;
  readonly documentAccessMode?: 'standard' | 'document-portal' | 'client';
  readonly jobTitle?: string | null;
  readonly maritalStatus?: TenantUser['maritalStatus'];
  readonly militaryDocumentStatus?: TenantUser['militaryDocumentStatus'];
  readonly dependents?: readonly TenantUserDependent[];
  readonly departments?: readonly string[];
  readonly permissionCodes?: readonly string[];
}

export type TenantUserStatus = 'active' | 'inactive' | 'suspended';

export interface UpdateTenantUserStatusInput {
  readonly status: TenantUserStatus;
  readonly suspendedUntil?: string;
  readonly suspensionReason?: string;
}

export const TENANT_DEPARTMENTS = [
  'commercial',
  'purchasing',
  'controllership',
  'personnel-department',
  'financial',
  'management',
  'maintenance',
  'monitoring',
  'operations',
  'information-technology',
  'client-company',
] as const;

export const TENANT_DEPARTMENT_LABELS: Readonly<Record<string, string>> = {
  commercial: 'Comercial',
  purchasing: 'Compras',
  controllership: 'Controladoria',
  'personnel-department': 'Departamento Pessoal',
  financial: 'Financeiro',
  management: 'Gerência',
  maintenance: 'Manutenção',
  monitoring: 'Monitoramento',
  operations: 'Operacional',
  // Compatibilidade de leitura para vínculos criados antes do catálogo atual.
  'human-resources': 'Recursos Humanos',
  controlling: 'Controladoria',
  cleaning: 'Limpeza',
  'client-company': 'Empresa cliente',
  'information-technology': 'Tecnologia da Informação (TI)',
};

export function getTenantDepartmentLabel(department: string): string {
  return TENANT_DEPARTMENT_LABELS[department] ?? 'Departamento legado';
}
