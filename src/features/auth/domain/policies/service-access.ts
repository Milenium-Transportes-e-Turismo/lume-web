import { hasPermission } from '../services';
import type { Permission, User } from '../entities';

export const SERVICE_CAPABILITIES = [
  'view',
  'respond',
  'assume',
  'transfer',
  'priority',
  'close',
] as const;

export type ServiceCapability = (typeof SERVICE_CAPABILITIES)[number];

const LEGACY_SERVICE_ALIASES: Readonly<Record<ServiceCapability, readonly Permission[]>> = {
  view: ['whatsapp-conversations:view', 'whatsapp-conversations:manage'],
  respond: ['whatsapp-conversations:manage'],
  assume: ['whatsapp-conversations:manage'],
  transfer: ['whatsapp-conversations:manage'],
  priority: ['whatsapp-conversations:manage'],
  close: ['whatsapp-conversations:manage'],
};

/**
 * Authorizes one canonical service capability. Legacy WhatsApp permissions are
 * accepted only as explicit compatibility aliases while old sessions expire.
 */
export function hasServiceCapability(user: User, capability: ServiceCapability): boolean {
  const canonicalPermission = `service:${capability}` as Permission;
  return (
    hasPermission(user, canonicalPermission) ||
    LEGACY_SERVICE_ALIASES[capability].some((permission) => hasPermission(user, permission))
  );
}

/** Legacy-only operations do not inherit a canonical service capability. */
export function hasLegacyWhatsAppManagement(user: User): boolean {
  return hasPermission(user, 'whatsapp-conversations:manage');
}
