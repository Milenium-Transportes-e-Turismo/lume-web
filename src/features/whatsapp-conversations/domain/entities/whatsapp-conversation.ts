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

export const WHATSAPP_SERVICE_SESSION_STATUSES = [
  'OPEN',
  'WAITING_CUSTOMER',
  'WAITING_HUMAN',
  'PAUSED_BY_HIGHER_PRIORITY',
  'CLOSING',
  'CLOSED',
] as const;
export type WhatsAppServiceSessionStatus = (typeof WHATSAPP_SERVICE_SESSION_STATUSES)[number];

export const WHATSAPP_SERVICE_SESSION_CONTROL_MODES = ['AI', 'HUMAN'] as const;
export type WhatsAppServiceSessionControlMode =
  (typeof WHATSAPP_SERVICE_SESSION_CONTROL_MODES)[number];

export const WHATSAPP_SERVICE_SESSION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type WhatsAppServiceSessionPriority = (typeof WHATSAPP_SERVICE_SESSION_PRIORITIES)[number];

export const WHATSAPP_SERVICE_SESSION_ACTIONS = [
  'ASSUME',
  'RETURN_TO_QUEUE',
  'TRANSFER_USER',
  'TRANSFER_DEPARTMENT',
  'CHANGE_PRIORITY',
  'RETURN_TO_AI',
  'CLOSE',
] as const;
export type WhatsAppServiceSessionAction = (typeof WHATSAPP_SERVICE_SESSION_ACTIONS)[number];

export const WHATSAPP_MESSAGE_ACTOR_TYPES = [
  'CUSTOMER',
  'HUMAN_USER',
  'EXTERNAL_HUMAN',
  'AI_AGENT',
  'SYSTEM',
] as const;
export type WhatsAppMessageActorType = (typeof WHATSAPP_MESSAGE_ACTOR_TYPES)[number];

export const WHATSAPP_MESSAGE_SOURCES = ['LUME_WEB', 'WHATSAPP_APP', 'AUTOMATION'] as const;
export type WhatsAppMessageSource = (typeof WHATSAPP_MESSAGE_SOURCES)[number];

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

export interface WhatsAppServiceSessionParty {
  readonly id: string;
  readonly name: string;
}

export interface WhatsAppServiceAssignmentQueue {
  readonly id: string;
  readonly name: string;
  readonly assignmentStrategy: 'manual' | 'round-robin' | 'least-load';
  readonly maxConcurrentAttendances: number | null;
}

export interface WhatsAppServiceAssignmentTarget {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly queues: readonly WhatsAppServiceAssignmentQueue[];
  readonly users: readonly WhatsAppServiceSessionParty[];
}

export interface WhatsAppSourceChannel {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly address: string | null;
}

export interface WhatsAppServiceSession {
  readonly id: string;
  readonly companyId: string;
  readonly threadId: string;
  readonly sourceChannelId: string;
  readonly currentDepartmentId: string | null;
  readonly responsibleUserId: string | null;
  readonly queueId: string | null;
  readonly relatedServiceSessionId: string | null;
  readonly status: WhatsAppServiceSessionStatus;
  readonly controlMode: WhatsAppServiceSessionControlMode;
  readonly priority: WhatsAppServiceSessionPriority;
  readonly priorityReason: string | null;
  readonly prioritySource: string | null;
  readonly isForeground: boolean;
  readonly version: number;
  readonly responsible: WhatsAppServiceSessionParty | null;
  readonly queue: WhatsAppServiceSessionParty | null;
  readonly availableActions: readonly WhatsAppServiceSessionAction[];
  readonly projection: 'NATIVE' | 'LEGACY_CONVERSATION';
  readonly publicContinuationCode: string | null;
  readonly continuationCodeExpiresAt: string | null;
  readonly closingStartedAt: string | null;
  readonly closingDeadlineAt: string | null;
  readonly closedAt: string | null;
}

export interface WhatsAppMessageActor {
  readonly type: WhatsAppMessageActorType | string;
  readonly id: string | null;
  readonly name: string | null;
}

export interface WhatsAppEvidenceItem {
  readonly id: string;
  readonly name: string | null;
  readonly status: string | null;
  readonly summary: string | null;
  readonly url: string | null;
  readonly occurredAt: string | null;
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface WhatsAppConversationEvidence {
  readonly agentExecutions: readonly WhatsAppEvidenceItem[];
  readonly knowledgeSources: readonly WhatsAppEvidenceItem[];
  readonly toolExecutions: readonly WhatsAppEvidenceItem[];
  readonly mediaInterpretations: readonly WhatsAppEvidenceItem[];
  readonly registrationDataReviews: readonly WhatsAppEvidenceItem[];
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

export const WHATSAPP_MEDIA_INTERPRETATION_STATUSES = [
  'not-requested',
  'pending',
  'succeeded',
  'failed',
  'unsupported',
] as const;
export type WhatsAppMediaInterpretationStatus =
  (typeof WHATSAPP_MEDIA_INTERPRETATION_STATUSES)[number];

export interface WhatsAppMediaInterpretation {
  readonly mediaAssetId: string;
  readonly interpretationId: string | null;
  readonly status: WhatsAppMediaInterpretationStatus;
  readonly transcription: string | null;
  readonly detectedLanguage: string | null;
  readonly extractedText: string | null;
  readonly summary: string | null;
  readonly documentType: string | null;
  readonly structuredData: Readonly<Record<string, unknown>> | null;
  readonly confidence: number | null;
  readonly durationSeconds: number | null;
  readonly provenance: Readonly<Record<string, unknown>> | null;
  readonly errorCode: string | null;
  readonly correction: {
    readonly correction: string;
    readonly feedback: string | null;
    readonly correctedByUserId: string;
    readonly createdAt: string;
  } | null;
  readonly effectiveContext: {
    readonly value: string | null;
    readonly source: 'human' | 'machine' | 'none';
  };
  readonly completedAt: string | null;
}

export interface DeferredWhatsAppMediaInterpretation {
  readonly mediaAssetId: string;
  readonly status: 'deferred';
  readonly reason: 'human-control-disabled' | 'media-agent-unavailable' | 'binary-not-stored';
}

export interface WhatsAppMessage {
  readonly id: string;
  readonly direction: WhatsAppMessageDirection;
  readonly deliveryStatus: WhatsAppMessageDeliveryStatus;
  readonly kind: WhatsAppMessageKind;
  readonly text: string | null;
  readonly attachment: WhatsAppMessageAttachment | null;
  readonly sentBy?: WhatsAppConversationAssignee | null;
  readonly actor?: WhatsAppMessageActor | null;
  readonly source?: WhatsAppMessageSource | string | null;
  readonly evidence?: WhatsAppConversationEvidence;
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
  readonly actorAgentId?: string | null;
  readonly source?: string | null;
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

export interface WhatsAppAssistantSuggestion {
  readonly id: string;
  readonly serviceSessionId: string;
  readonly kind: 'new-quote' | 'department';
  readonly question: string;
  readonly targetDepartment: WhatsAppConversationDepartment;
  readonly createdAt: string;
}

export interface WhatsAppConversation {
  readonly assistantSuggestions?: readonly WhatsAppAssistantSuggestion[];

  readonly id: string;
  readonly companyId: string;
  readonly channel: WhatsAppChannel;
  readonly sourceChannel?: WhatsAppSourceChannel;
  readonly contact: WhatsAppContact;
  readonly department: WhatsAppConversationDepartment;
  readonly conversationState: WhatsAppConversationState;
  readonly flowStep: WhatsAppConversationFlowStep;
  readonly requestStatus: WhatsAppRequestStatus;
  readonly resumeState: WhatsAppConversationState | null;
  readonly assignedTo: WhatsAppConversationAssignee | null;
  readonly currentServiceSession?: WhatsAppServiceSession;
  readonly evidence?: WhatsAppConversationEvidence;
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

const EMPTY_WHATSAPP_CONVERSATION_EVIDENCE: WhatsAppConversationEvidence = {
  agentExecutions: [],
  knowledgeSources: [],
  toolExecutions: [],
  mediaInterpretations: [],
  registrationDataReviews: [],
};

export function getWhatsAppConversationEvidence(
  conversation: WhatsAppConversation,
): WhatsAppConversationEvidence {
  return conversation.evidence ?? EMPTY_WHATSAPP_CONVERSATION_EVIDENCE;
}

export function getCurrentWhatsAppServiceSession(
  conversation: WhatsAppConversation,
): WhatsAppServiceSession {
  if (conversation.currentServiceSession) return conversation.currentServiceSession;

  const status: WhatsAppServiceSessionStatus =
    conversation.conversationState === 'closed'
      ? 'CLOSED'
      : conversation.conversationState === 'waiting-for-customer'
        ? 'WAITING_CUSTOMER'
        : conversation.conversationState === 'sent-to-human'
          ? 'WAITING_HUMAN'
          : 'OPEN';
  const controlMode: WhatsAppServiceSessionControlMode =
    conversation.conversationState === 'human-active' ||
    conversation.conversationState === 'sent-to-human'
      ? 'HUMAN'
      : 'AI';

  return {
    id: conversation.id,
    companyId: conversation.companyId,
    threadId: conversation.id,
    sourceChannelId: conversation.channel.id,
    currentDepartmentId: conversation.department,
    responsibleUserId: conversation.assignedTo?.id ?? null,
    queueId: null,
    relatedServiceSessionId: null,
    status,
    controlMode,
    priority: 'NORMAL',
    priorityReason: null,
    prioritySource: null,
    isForeground: status !== 'CLOSED',
    version: conversation.version,
    responsible: conversation.assignedTo,
    queue: null,
    availableActions:
      status === 'CLOSED'
        ? []
        : conversation.conversationState === 'human-active' && conversation.assignedTo !== null
          ? ['ASSUME', 'TRANSFER_DEPARTMENT', 'RETURN_TO_AI', 'CLOSE']
          : ['ASSUME', 'TRANSFER_DEPARTMENT', 'CLOSE'],
    projection: 'LEGACY_CONVERSATION',
    publicContinuationCode: null,
    continuationCodeExpiresAt: null,
    closingStartedAt: null,
    closingDeadlineAt: null,
    closedAt: conversation.closedAt,
  };
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

export function isWhatsAppServiceSessionPriority(
  value: unknown,
): value is WhatsAppServiceSessionPriority {
  return includesValue(WHATSAPP_SERVICE_SESSION_PRIORITIES, value);
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
