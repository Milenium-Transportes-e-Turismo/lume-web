import type {
  CreateTenantUserInput,
  LocalLicenseStatus,
  PermissionCatalog,
  TenantNotificationReadReceipt,
  TenantNotificationSummary,
  TenantProfile,
  TenantUser,
  TenantUserList,
  TenantUserStatus,
  UpdateTenantUserInput,
  UpdateTenantUserStatusInput,
  ApiUsageSummary,
  ApiUsageRequestList,
  ApiUsageResultFilter,
} from '../domain';

export type TenantAdministrationErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

const defaultPublicCodeByErrorCode: Readonly<Record<TenantAdministrationErrorCode, string>> = {
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  validation: 'VALIDATION_ERROR',
  conflict: 'CONFLICT',
  'not-found': 'NOT_FOUND',
  'invalid-response': 'INVALID_RESPONSE',
  'service-unavailable': 'SERVICE_UNAVAILABLE',
};

export class TenantAdministrationError extends Error {
  constructor(
    readonly code: TenantAdministrationErrorCode,
    message: string,
    readonly publicCode: string = defaultPublicCodeByErrorCode[code],
  ) {
    super(message);
    this.name = 'TenantAdministrationError';
  }
}

export interface TenantAdministrationGateway {
  listUsers(query?: {
    page?: number;
    pageSize?: number;
    search?: string;
    department?: string;
    permission?: string;
    status?: TenantUserStatus;
  }): Promise<TenantUserList>;
  getUser(userId: string): Promise<TenantUser>;
  createUser(input: CreateTenantUserInput): Promise<TenantUser>;
  updateUser(userId: string, input: UpdateTenantUserInput): Promise<TenantUser>;
  updateUserStatus(userId: string, input: UpdateTenantUserStatusInput): Promise<TenantUser>;
  deleteUser(userId: string, password: string): Promise<{ readonly deleted: true }>;
  listAuditOperations(query: {
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    userId?: string;
    includeActivity?: boolean;
    status?: ApiUsageResultFilter;
  }): Promise<import('../domain/api-usage').AuditOperationList>;
  getApiUsageSummary(query?: { from?: string; to?: string }): Promise<ApiUsageSummary>;
  listApiUsageRequests(query?: {
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    userId?: string;
    status?: ApiUsageResultFilter;
  }): Promise<ApiUsageRequestList>;
  requestPasswordReset(userId: string): Promise<{
    readonly requested: true;
    readonly recipient: string;
    readonly expiresAt: string;
  }>;
  listPermissions(): Promise<PermissionCatalog>;
  getNotifications(): Promise<TenantNotificationSummary>;
  markNotificationRead(notificationId: string): Promise<TenantNotificationReadReceipt>;
  getLicenseStatus(): Promise<LocalLicenseStatus>;
  getProfile(): Promise<TenantProfile>;
  updateProfilePicture(dataUrl: string | null): Promise<TenantProfile>;
  changeOwnPassword(input: {
    readonly currentPassword: string;
    readonly newPassword: string;
  }): Promise<{ readonly changed: true; readonly sessionRevoked: true }>;
}
