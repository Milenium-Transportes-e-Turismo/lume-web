export const WHATSAPP_CONVERSATION_DEPARTMENTS = [
  'human-resources',
  'personnel-department',
  'commercial',
  'purchasing',
  'controlling',
  'maintenance',
  'monitoring',
  'management',
  'operations',
  'cleaning',
  'financial',
  'information-technology',
] as const;

export type WhatsAppConversationDepartment = (typeof WHATSAPP_CONVERSATION_DEPARTMENTS)[number];

export const WHATSAPP_ROUTABLE_DEPARTMENTS = [
  'commercial',
  'purchasing',
  'controlling',
  'personnel-department',
  'financial',
  'management',
  'maintenance',
  'monitoring',
  'operations',
] as const satisfies readonly WhatsAppConversationDepartment[];

export const WHATSAPP_CONVERSATION_STATES = [
  'bot-active',
  'waiting-for-customer',
  'sent-to-human',
  'human-active',
  'closed',
] as const;

export type WhatsAppConversationState = (typeof WHATSAPP_CONVERSATION_STATES)[number];

export const WHATSAPP_CONVERSATION_FLOW_STEPS = [
  'main-menu',
  'commercial-menu',
  'quote-data-collection',
  'quote-summary-confirmation',
  'quote-send-pending',
  'commercial-follow-up-menu',
  'human-service',
  'closed',
] as const;

export type WhatsAppConversationFlowStep = (typeof WHATSAPP_CONVERSATION_FLOW_STEPS)[number];

export const WHATSAPP_REQUEST_STATUSES = [
  'not-started',
  'collecting-information',
  'waiting-for-customer',
  'under-review',
  'approved',
  'rejected',
  'cancelled',
] as const;

export type WhatsAppRequestStatus = (typeof WHATSAPP_REQUEST_STATUSES)[number];

export const WHATSAPP_MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type WhatsAppMessageDirection = (typeof WHATSAPP_MESSAGE_DIRECTIONS)[number];

export const WHATSAPP_MESSAGE_DELIVERY_STATUSES = [
  'received',
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
] as const;
export type WhatsAppMessageDeliveryStatus = (typeof WHATSAPP_MESSAGE_DELIVERY_STATUSES)[number];

export const WHATSAPP_MESSAGE_KINDS = [
  'text',
  'image',
  'document',
  'audio',
  'video',
  'sticker',
  'location',
  'contact',
  'unknown',
] as const;
export type WhatsAppMessageKind = (typeof WHATSAPP_MESSAGE_KINDS)[number];

export interface WhatsAppContact {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly profilePictureUrl: string | null;
}

export interface WhatsAppChannel {
  readonly id: string;
  readonly name: string;
  readonly phoneNumber: string;
}

export interface WhatsAppConversationAssignee {
  readonly id: string;
  readonly name: string;
}

export interface WhatsAppMessageAttachment {
  readonly mimeType: string | null;
  readonly size: number | null;
  readonly url: string | null;
  readonly fileName: string | null;
  readonly retentionStatus?: 'pending' | 'stored' | 'unavailable' | 'too-large' | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface WhatsAppMessageAttempt {
  readonly id: string;
  readonly attemptNumber: number;
  readonly status: 'pending' | 'succeeded' | 'failed';
  readonly providerMessageId: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export interface WhatsAppMessage {
  readonly id: string;
  readonly direction: WhatsAppMessageDirection;
  readonly deliveryStatus: WhatsAppMessageDeliveryStatus;
  readonly kind: WhatsAppMessageKind;
  readonly text: string | null;
  readonly attachment: WhatsAppMessageAttachment | null;
  readonly sentBy?: WhatsAppConversationAssignee | null;
  readonly occurredAt: string;
  readonly attempts: readonly WhatsAppMessageAttempt[];
}

export interface WhatsAppMessageHistory {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface WhatsAppConversationSnapshot {
  readonly department: WhatsAppConversationDepartment;
  readonly conversationState: WhatsAppConversationState;
  readonly flowStep: WhatsAppConversationFlowStep;
  readonly requestStatus: WhatsAppRequestStatus;
}

export interface WhatsAppConversationTransition {
  readonly id: string;
  readonly commandId: string;
  readonly name: string;
  readonly expectedVersion: number;
  readonly resultingVersion: number;
  readonly actorType: string;
  readonly actorUserId: string | null;
  readonly actor?: {
    readonly type: string;
    readonly user: {
      readonly id: string;
      readonly name: string;
    } | null;
  };
  readonly from: WhatsAppConversationSnapshot;
  readonly to: WhatsAppConversationSnapshot;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface WhatsAppQuoteRequest {
  readonly id: string;
  readonly sequence: number;
  readonly status: WhatsAppRequestStatus;
  readonly contactName: string | null;
  readonly document: string | null;
  readonly email: string | null;
  readonly serviceType: string | null;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly departureDate: string | null;
  readonly departureAt: string | null;
  readonly returnDate: string | null;
  readonly returnAt: string | null;
  readonly passengerCount: number | null;
  readonly vehicleType: string | null;
  readonly vehicleAtDisposal: boolean | null;
  readonly localTransfers: boolean | null;
  readonly notes: string | null;
  readonly structuredData: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WhatsAppConversation {
  readonly id: string;
  readonly companyId: string;
  readonly channel: WhatsAppChannel;
  readonly contact: WhatsAppContact;
  readonly department: WhatsAppConversationDepartment;
  readonly conversationState: WhatsAppConversationState;
  readonly flowStep: WhatsAppConversationFlowStep;
  readonly requestStatus: WhatsAppRequestStatus;
  readonly resumeState: WhatsAppConversationState | null;
  readonly assignedTo: WhatsAppConversationAssignee | null;
  readonly unreadCount: number;
  readonly version: number;
  readonly lastInboundAt: string | null;
  readonly lastOutboundAt: string | null;
  readonly lastMessagePreview: string;
  readonly lastMessageAt: string;
  readonly closedAt: string | null;
  readonly archivedAt: string | null;
  readonly archiveReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly currentQuoteRequest: WhatsAppQuoteRequest | null;
  readonly hasApprovedQuoteRequest: boolean;
  readonly messages: readonly WhatsAppMessage[];
  readonly messageHistory?: WhatsAppMessageHistory;
  readonly transitions: readonly WhatsAppConversationTransition[];
}

function includesValue<TValue extends string>(
  values: readonly TValue[],
  value: unknown,
): value is TValue {
  return typeof value === 'string' && values.includes(value as TValue);
}

export function isWhatsAppConversationDepartment(
  value: unknown,
): value is WhatsAppConversationDepartment {
  return includesValue(WHATSAPP_CONVERSATION_DEPARTMENTS, value);
}

export function isWhatsAppConversationState(value: unknown): value is WhatsAppConversationState {
  return includesValue(WHATSAPP_CONVERSATION_STATES, value);
}

export function isWhatsAppConversationFlowStep(
  value: unknown,
): value is WhatsAppConversationFlowStep {
  return includesValue(WHATSAPP_CONVERSATION_FLOW_STEPS, value);
}

export function isWhatsAppRequestStatus(value: unknown): value is WhatsAppRequestStatus {
  return includesValue(WHATSAPP_REQUEST_STATUSES, value);
}

export function canWhatsAppBotReply(conversationState: WhatsAppConversationState): boolean {
  return conversationState === 'bot-active';
}

export function isWhatsAppBotBlocked(conversation: WhatsAppConversation): boolean {
  return !canWhatsAppBotReply(conversation.conversationState);
}

export function isWhatsAppHumanActive(conversation: WhatsAppConversation): boolean {
  return conversation.conversationState === 'human-active';
}

export function canSendHumanWhatsAppMessage(conversation: WhatsAppConversation): boolean {
  return isWhatsAppHumanActive(conversation) && conversation.assignedTo !== null;
}

export function isWhatsAppAwaitingProposal(conversation: WhatsAppConversation): boolean {
  return (
    conversation.department === 'commercial' &&
    conversation.conversationState !== 'closed' &&
    conversation.currentQuoteRequest?.status === 'under-review'
  );
}

export function isWhatsAppQuoteSummaryConfirmed(conversation: WhatsAppConversation): boolean {
  return ['under-review', 'approved', 'rejected', 'cancelled'].includes(conversation.requestStatus);
}

export function canTakeOverWhatsAppConversation(conversation: WhatsAppConversation): boolean {
  return conversation.conversationState !== 'closed';
}

export function canReturnWhatsAppConversationToBot(conversation: WhatsAppConversation): boolean {
  return conversation.conversationState === 'human-active' && conversation.assignedTo !== null;
}

export function canForwardWhatsAppConversation(conversation: WhatsAppConversation): boolean {
  return conversation.conversationState !== 'closed';
}

export function canMarkWhatsAppConversationAsRead(conversation: WhatsAppConversation): boolean {
  return conversation.conversationState !== 'closed' && conversation.unreadCount > 0;
}

export function canCloseWhatsAppConversationAfterRejection(
  conversation: WhatsAppConversation,
): boolean {
  return conversation.conversationState !== 'closed' && conversation.requestStatus === 'rejected';
}

export function canCloseWhatsAppConversation(conversation: WhatsAppConversation): boolean {
  return conversation.conversationState !== 'closed';
}
