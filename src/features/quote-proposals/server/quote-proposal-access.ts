import { hasCommercialScope, hasPermission, type User } from '@/features/auth/domain';

const QUOTE_PROPOSAL_READ_PERMISSIONS = [
  'whatsapp-conversations:view',
  'whatsapp-conversations:manage',
  'commercial:view',
  'commercial:manage',
] as const;

export function canReadQuoteProposals(user: User): boolean {
  if (!user.isActive) return false;
  if (user.isAdministrator === true) return true;

  return (
    hasCommercialScope(user) &&
    QUOTE_PROPOSAL_READ_PERMISSIONS.some((permission) => hasPermission(user, permission))
  );
}

export function canManageQuoteProposals(user: User): boolean {
  if (!user.isActive) return false;
  if (user.isAdministrator === true) return true;

  return (
    hasCommercialScope(user) &&
    (hasPermission(user, 'whatsapp-conversations:manage') ||
      hasPermission(user, 'commercial:manage'))
  );
}
