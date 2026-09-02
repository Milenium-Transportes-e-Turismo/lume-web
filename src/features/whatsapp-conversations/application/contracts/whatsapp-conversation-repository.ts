import type {
  WhatsAppConversation,
  WhatsAppConversationMetrics,
  WhatsAppConversationDepartment,
  WhatsAppMessage,
  WhatsAppConversationState,
  WhatsAppRequestStatus,
  WhatsAppServiceAssignmentTarget,
  WhatsAppServiceSessionPriority,
  WhatsAppMediaInterpretation,
  DeferredWhatsAppMediaInterpretation,
} from '../../domain';

export interface WhatsAppMessageSearchResult {
  readonly messages: readonly WhatsAppMessage[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface GetWhatsAppConversationsFilters {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly department?: WhatsAppConversationDepartment;
  readonly state?: WhatsAppConversationState;
  readonly control?: 'bot' | 'human' | 'paused' | 'closed';
  readonly requestStatus?: WhatsAppRequestStatus;
  readonly archive?: 'active' | 'archived' | 'all';
}

export interface WhatsAppConversationPage {
  readonly conversations: readonly WhatsAppConversation[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly metrics: WhatsAppConversationMetrics;
}

export type WhatsAppConversationRepositoryErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'too-many-requests'
  | 'service-unavailable';

export class WhatsAppConversationRepositoryError extends Error {
  constructor(
    readonly code: WhatsAppConversationRepositoryErrorCode,
    message: string,
    readonly currentVersion: number | null = null,
  ) {
    super(message);
    this.name = 'WhatsAppConversationRepositoryError';
  }
}

export interface SendHumanWhatsAppMessageCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly text: string;
}

export interface VersionedWhatsAppServiceSessionCommand {
  readonly commandId: string;
  readonly expectedVersion: number;
  readonly serviceSessionId: string;
  readonly reason?: string | null;
}

export interface ReturnToQueueWhatsAppServiceSessionCommand extends VersionedWhatsAppServiceSessionCommand {
  readonly queueId: string;
}

export interface ChangeWhatsAppServiceSessionPriorityCommand extends VersionedWhatsAppServiceSessionCommand {
  readonly priority: WhatsAppServiceSessionPriority;
}

export interface TransferWhatsAppServiceSessionCommand extends VersionedWhatsAppServiceSessionCommand {
  readonly departmentId: string;
  readonly queueId?: string;
  readonly userId?: string;
}

export interface SendHumanWhatsAppMessageResult {
  readonly conversation: WhatsAppConversation;
  readonly message: WhatsAppMessage;
}

export interface WhatsAppMediaContent {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly mimeType: string;
}

export interface WhatsAppConversationRepository {
  getServiceAssignmentTargets(): Promise<readonly WhatsAppServiceAssignmentTarget[]>;
  startConversation(phone: string): Promise<WhatsAppConversation>;
  getConversations(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<readonly WhatsAppConversation[]>;
  getDashboardConversations(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<readonly WhatsAppConversation[]>;
  getConversationPage(filters?: GetWhatsAppConversationsFilters): Promise<WhatsAppConversationPage>;
  getDashboardConversationPage(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<WhatsAppConversationPage>;
  getConversationById(
    conversationId: string,
    messagePage?: number,
  ): Promise<WhatsAppConversation | null>;
  searchMessages(
    conversationId: string,
    search: string,
    page?: number,
  ): Promise<WhatsAppMessageSearchResult>;
  takeOverConversation(
    conversationId: string,
    expectedVersion: number,
    commandId?: string,
    serviceSessionId?: string,
  ): Promise<WhatsAppConversation>;
  returnConversationToBot(
    conversationId: string,
    expectedVersion: number,
    commandId?: string,
    serviceSessionId?: string,
  ): Promise<WhatsAppConversation>;
  forwardConversation(
    conversationId: string,
    targetDepartment: WhatsAppConversationDepartment,
    expectedVersion: number,
    commandId?: string,
    serviceSessionId?: string,
  ): Promise<WhatsAppConversation>;
  returnConversationToQueue(
    conversationId: string,
    command: ReturnToQueueWhatsAppServiceSessionCommand,
  ): Promise<WhatsAppConversation>;
  transferServiceSession(
    conversationId: string,
    command: TransferWhatsAppServiceSessionCommand,
  ): Promise<WhatsAppConversation>;
  changeConversationPriority(
    conversationId: string,
    command: ChangeWhatsAppServiceSessionPriorityCommand,
  ): Promise<WhatsAppConversation>;
  changeConversationDepartment(
    conversationId: string,
    targetDepartment: WhatsAppConversationDepartment,
    expectedVersion: number,
  ): Promise<WhatsAppConversation>;
  archiveConversation(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation>;
  unarchiveConversation(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation>;
  markConversationAsRead(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation>;
  closeConversationAfterRejection(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation>;
  closeConversation(
    conversationId: string,
    expectedVersion: number,
    reason?: string | null,
    commandId?: string,
    serviceSessionId?: string,
  ): Promise<WhatsAppConversation>;
  sendHumanMessage(
    conversationId: string,
    command: SendHumanWhatsAppMessageCommand,
  ): Promise<SendHumanWhatsAppMessageResult>;
  downloadMessageContent(conversationId: string, messageId: string): Promise<WhatsAppMediaContent>;
  getMediaInterpretation(
    conversationId: string,
    messageId: string,
  ): Promise<WhatsAppMediaInterpretation>;
  analyzeMedia(
    conversationId: string,
    messageId: string,
  ): Promise<WhatsAppMediaInterpretation | DeferredWhatsAppMediaInterpretation>;
  correctMediaInterpretation(
    conversationId: string,
    messageId: string,
    correction: string,
    feedback?: string,
  ): Promise<WhatsAppMediaInterpretation>;
}
