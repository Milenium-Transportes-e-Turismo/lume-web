export const USER_TYPES = ['employee', 'client'] as const;

export type UserType = (typeof USER_TYPES)[number];

export const DEPARTMENTS = [
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
] as const;

export type Department = string;

export const CLIENT_CATEGORIES = [
  'legal-entity',
  'individual',
  // Kept while older simulated sessions are still accepted.
  'continuous-charter',
  'eventual-charter',
] as const;

export type ClientCategory = (typeof CLIENT_CATEGORIES)[number];

export const PERMISSION_RESOURCES = [
  'dashboard',
  'users',
  'human-resources',
  'personnel-department',
  'commercial',
  'purchasing',
  'maintenance',
  'monitoring',
  'operations',
  'cleaning',
  'drivers',
  'financial',
  'clients',
  'ai-agents',
  'whatsapp-conversations',
  'manuals',
  'reports',
  'settings',
  'profile',
  'contracts',
  'quotes',
  'trips',
  'documents',
  'invoices',
  'service-requests',
  'support',
  'route-planner',
] as const;

export type PermissionResource = string;

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'manage',
  'use',
  'approve',
  'export',
  'calculate',
] as const;

export type PermissionAction = string;

export type Permission = `${PermissionResource}:${PermissionAction}`;

interface BaseUser {
  readonly id: string;
  readonly name: string;
  readonly type: UserType;
  readonly permissions: readonly Permission[];
  readonly isActive: boolean;
  readonly isAdministrator?: boolean;
  readonly documentAccessMode?: 'standard' | 'document-portal' | 'client';
  readonly routingCompanyId?: string | null;
}

export interface EmployeeUser extends BaseUser {
  readonly type: 'employee';
  readonly departments: readonly Department[];
  readonly clientCategory: null;
}

export interface ClientUser extends BaseUser {
  readonly type: 'client';
  readonly departments: readonly Department[];
  readonly clientCategory: ClientCategory;
}

export type User = EmployeeUser | ClientUser;
