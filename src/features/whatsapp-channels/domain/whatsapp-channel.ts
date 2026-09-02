export const WHATSAPP_CHANNEL_ORGANIZATIONAL_STATUSES = [
  'pending',
  'active',
  'cancelled',
  'disabled',
] as const;
export type WhatsAppChannelOrganizationalStatus =
  (typeof WHATSAPP_CHANNEL_ORGANIZATIONAL_STATUSES)[number];

export const WHATSAPP_CHANNEL_CONNECTION_STATUSES = [
  'unknown',
  'connected',
  'disconnected',
  'connecting',
  'error',
] as const;
export type WhatsAppChannelConnectionStatus = (typeof WHATSAPP_CHANNEL_CONNECTION_STATUSES)[number];

export const WHATSAPP_CHANNEL_ROUTING_MODES = ['department-owned', 'general-triage'] as const;
export type WhatsAppChannelRoutingMode = (typeof WHATSAPP_CHANNEL_ROUTING_MODES)[number];

export interface ManagedWhatsAppChannel {
  readonly id: string;
  readonly companyId: string;
  readonly providerId: string;
  readonly displayName: string;
  readonly phoneNumber: string;
  readonly evolutionInstanceName: string;
  readonly evolutionInstanceId: string | null;
  readonly departmentId: string | null;
  readonly routingMode: WhatsAppChannelRoutingMode;
  readonly organizationalStatus: WhatsAppChannelOrganizationalStatus;
  readonly connectionStatus: WhatsAppChannelConnectionStatus;
  readonly allowedAutomaticTargetDepartmentIds: readonly string[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WhatsAppChannelQrCode {
  readonly code: string | null;
  readonly base64: string;
}

export interface WhatsAppChannelOperationResult {
  readonly channel: ManagedWhatsAppChannel;
  readonly qrCode: WhatsAppChannelQrCode | null;
  readonly providerIssue: {
    readonly reason: string;
    readonly message: string;
  } | null;
  readonly infrastructureCleanupPending: boolean;
}

export type WhatsAppChannelAction =
  'request-qr' | 'reconnect' | 'synchronize-connection' | 'disconnect' | 'cancel-setup' | 'disable';

export function whatsappChannelQrDataUrl(qrCode: WhatsAppChannelQrCode): string {
  return /^data:image\/(?:png|jpeg|webp);base64,/u.test(qrCode.base64)
    ? qrCode.base64
    : `data:image/png;base64,${qrCode.base64}`;
}
