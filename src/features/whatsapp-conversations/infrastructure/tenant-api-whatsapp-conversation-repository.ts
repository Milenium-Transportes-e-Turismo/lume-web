import type { ResolveWhatsAppAssistantSuggestionCommand } from '../application/contracts/whatsapp-conversation-repository';
import 'server-only';

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  WhatsAppConversationRepositoryError,
  type GetWhatsAppConversationsFilters,
  type ChangeWhatsAppServiceSessionPriorityCommand,
  type TransferWhatsAppServiceSessionCommand,
  type ReturnToQueueWhatsAppServiceSessionCommand,
  type SendHumanWhatsAppMessageCommand,
  type SendHumanWhatsAppMessageResult,
  type WhatsAppConversationPage,
  type WhatsAppMessageSearchResult,
  type WhatsAppConversationRepository,
  type WhatsAppConversationRepositoryErrorCode,
} from '../application';
import {
  WHATSAPP_CONVERSATION_DEPARTMENTS,
  WHATSAPP_CONVERSATION_FLOW_STEPS,
  WHATSAPP_CONVERSATION_STATES,
  WHATSAPP_MESSAGE_DELIVERY_STATUSES,
  WHATSAPP_MESSAGE_DIRECTIONS,
  WHATSAPP_MESSAGE_KINDS,
  WHATSAPP_MESSAGE_ACTOR_TYPES,
  WHATSAPP_MESSAGE_SOURCES,
  WHATSAPP_MEDIA_INTERPRETATION_STATUSES,
  WHATSAPP_REQUEST_STATUSES,
  WHATSAPP_SERVICE_SESSION_ACTIONS,
  WHATSAPP_SERVICE_SESSION_CONTROL_MODES,
  WHATSAPP_SERVICE_SESSION_PRIORITIES,
  WHATSAPP_SERVICE_SESSION_STATUSES,
  getCurrentWhatsAppServiceSession,
  getWhatsAppConversationMetrics,
  type WhatsAppConversation,
  type WhatsAppConversationEvidence,
  type WhatsAppConversationDepartment,
  type WhatsAppConversationTransition,
  type WhatsAppMessage,
  type WhatsAppMessageAttachment,
  type WhatsAppEvidenceItem,
  type WhatsAppQuoteRequest,
  type WhatsAppServiceAssignmentTarget,
  type WhatsAppMediaInterpretation,
  type DeferredWhatsAppMediaInterpretation,
} from '../domain';

type Fetcher = typeof fetch;

const MAX_WHATSAPP_MEDIA_CONTENT_BYTES = 50 * 1024 * 1024;

const isoDateSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const nullableIsoDateSchema = isoDateSchema.nullable();
const nullableCivilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const jsonObjectSchema = z.record(z.string(), z.unknown());

const mediaInterpretationSchema = z.object({
  mediaAssetId: z.string().uuid(),
  interpretationId: z.string().uuid().nullable(),
  status: z.enum(WHATSAPP_MEDIA_INTERPRETATION_STATUSES),
  transcription: z.string().nullable(),
  detectedLanguage: z.string().nullable(),
  extractedText: z.string().nullable(),
  summary: z.string().nullable(),
  documentType: z.string().nullable(),
  structuredData: jsonObjectSchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  provenance: jsonObjectSchema.nullable(),
  errorCode: z.string().nullable(),
  correction: z
    .object({
      correction: z.string().min(1),
      feedback: z.string().nullable(),
      correctedByUserId: z.string().uuid(),
      createdAt: isoDateSchema,
    })
    .nullable(),
  effectiveContext: z.object({
    value: z.string().nullable(),
    source: z.enum(['human', 'machine', 'none']),
  }),
  completedAt: nullableIsoDateSchema,
});
const deferredMediaInterpretationSchema = z.object({
  mediaAssetId: z.string().uuid(),
  status: z.literal('deferred'),
  reason: z.enum(['human-control-disabled', 'media-agent-unavailable', 'binary-not-stored']),
});

const evidenceItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).nullable().optional(),
    title: z.string().min(1).nullable().optional(),
    status: z.string().min(1).nullable().optional(),
    summary: z.string().min(1).nullable().optional(),
    reason: z.string().min(1).nullable().optional(),
    url: z.string().url().nullable().optional(),
    occurredAt: nullableIsoDateSchema.optional(),
    createdAt: nullableIsoDateSchema.optional(),
    provider: z.string().min(1).nullable().optional(),
    model: z.string().min(1).nullable().optional(),
    metadata: jsonObjectSchema.optional(),
  })
  .passthrough();

const conversationEvidenceSchema = z.object({
  agentExecutions: z.array(evidenceItemSchema).optional().default([]),
  knowledgeSources: z.array(evidenceItemSchema).optional().default([]),
  toolExecutions: z.array(evidenceItemSchema).optional().default([]),
  mediaInterpretations: z.array(evidenceItemSchema).optional().default([]),
  registrationDataReviews: z.array(evidenceItemSchema).optional().default([]),
});

const serviceSessionPartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const apiServiceSessionStatuses = [
  'open',
  'waiting-customer',
  'waiting-human',
  'paused-by-higher-priority',
  'closing',
  'closed',
] as const;
const apiServiceControlModes = ['ai', 'human'] as const;
const apiServicePriorities = ['low', 'normal', 'high', 'urgent'] as const;

const serviceSessionSchema = z
  .object({
    id: z.string().min(1),
    companyId: z.string().min(1),
    threadId: z.string().min(1),
    sourceChannelId: z.string().min(1),
    currentDepartmentId: z.string().min(1).nullable(),
    responsibleUserId: z.string().min(1).nullable(),
    queueId: z.string().min(1).nullable(),
    relatedServiceSessionId: z.string().min(1).nullable(),
    status: z.union([z.enum(WHATSAPP_SERVICE_SESSION_STATUSES), z.enum(apiServiceSessionStatuses)]),
    controlMode: z.union([
      z.enum(WHATSAPP_SERVICE_SESSION_CONTROL_MODES),
      z.enum(apiServiceControlModes),
    ]),
    priority: z.union([z.enum(WHATSAPP_SERVICE_SESSION_PRIORITIES), z.enum(apiServicePriorities)]),
    priorityReason: z.string().nullable().optional().default(null),
    prioritySource: z.string().nullable().optional().default(null),
    isForeground: z.boolean(),
    version: z.number().int().positive(),
    responsible: serviceSessionPartySchema.nullable().optional().default(null),
    queue: serviceSessionPartySchema.nullable().optional().default(null),
    availableActions: z.array(z.enum(WHATSAPP_SERVICE_SESSION_ACTIONS)).optional().default([]),
    publicContinuationCode: z.string().min(1).nullable().optional().default(null),
    continuationCodeExpiresAt: nullableIsoDateSchema.optional().default(null),
    closingStartedAt: nullableIsoDateSchema.optional().default(null),
    aiClosingStartedAt: nullableIsoDateSchema.optional().default(null),
    closingDeadlineAt: nullableIsoDateSchema.optional().default(null),
    closedAt: nullableIsoDateSchema.optional().default(null),
  })
  .transform(({ aiClosingStartedAt, ...session }) => ({
    ...session,
    status: session.status
      .toUpperCase()
      .replaceAll('-', '_') as (typeof WHATSAPP_SERVICE_SESSION_STATUSES)[number],
    controlMode:
      session.controlMode.toUpperCase() as (typeof WHATSAPP_SERVICE_SESSION_CONTROL_MODES)[number],
    priority:
      session.priority.toUpperCase() as (typeof WHATSAPP_SERVICE_SESSION_PRIORITIES)[number],
    closingStartedAt: session.closingStartedAt ?? aiClosingStartedAt,
  }));

const serviceAssignmentTargetSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  isDefault: z.boolean(),
  queues: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      assignmentStrategy: z.enum(['manual', 'round-robin', 'least-load']),
      maxConcurrentAttendances: z.number().int().positive().nullable(),
    }),
  ),
  users: z.array(serviceSessionPartySchema.extend({ id: z.string().uuid() })),
});

const quoteRequestSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int().positive(),
  status: z.enum(WHATSAPP_REQUEST_STATUSES),
  contactName: z.string().nullable(),
  document: z.string().nullable(),
  email: z.string().nullable(),
  serviceType: z.string().nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  departureDate: nullableCivilDateSchema,
  departureAt: nullableIsoDateSchema,
  returnDate: nullableCivilDateSchema,
  returnAt: nullableIsoDateSchema,
  passengerCount: z.number().int().positive().nullable(),
  vehicleType: z.string().nullable(),
  vehicleAtDisposal: z.boolean().nullable(),
  localTransfers: z.boolean().nullable(),
  notes: z.string().nullable(),
  structuredData: jsonObjectSchema,
  version: z.number().int().positive(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

const conversationSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  channel: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    phoneNumber: z.string().min(1),
  }),
  sourceChannel: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      type: z.string().min(1),
      address: z.string().nullable().optional().default(null),
    })
    .optional(),
  contact: z.object({
    id: z.string().uuid(),
    phone: z.string().min(1),
    displayName: z.string().nullable(),
    profilePictureUrl: z.string().url().nullable(),
  }),
  department: z.enum(WHATSAPP_CONVERSATION_DEPARTMENTS),
  conversationState: z.enum(WHATSAPP_CONVERSATION_STATES),
  flowStep: z.enum(WHATSAPP_CONVERSATION_FLOW_STEPS),
  requestStatus: z.enum(WHATSAPP_REQUEST_STATUSES),
  resumeState: z.enum(WHATSAPP_CONVERSATION_STATES).nullable(),
  assignedTo: z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1),
    })
    .nullable(),
  assistantSuggestions: z
    .array(
      z.object({
        id: z.string().uuid(),
        serviceSessionId: z.string().uuid(),
        kind: z.enum(['new-quote', 'department']),
        question: z.string().min(1).max(1000),
        targetDepartment: z.enum(WHATSAPP_CONVERSATION_DEPARTMENTS),
        createdAt: z.string().datetime(),
      }),
    )
    .optional()
    .default([]),
  currentServiceSession: serviceSessionSchema.optional(),
  serviceSession: serviceSessionSchema.optional(),
  evidence: conversationEvidenceSchema.optional(),
  agentExecutions: z.array(evidenceItemSchema).optional(),
  knowledgeSources: z.array(evidenceItemSchema).optional(),
  toolExecutions: z.array(evidenceItemSchema).optional(),
  mediaInterpretations: z.array(evidenceItemSchema).optional(),
  registrationDataReviews: z.array(evidenceItemSchema).optional(),
  unreadCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  lastInboundAt: nullableIsoDateSchema,
  lastOutboundAt: nullableIsoDateSchema,
  lastMessagePreview: z.string().nullable(),
  closedAt: nullableIsoDateSchema,
  archivedAt: nullableIsoDateSchema.optional().default(null),
  archiveReason: z.string().nullable().optional().default(null),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  currentQuoteRequest: quoteRequestSchema.nullable(),
  hasApprovedQuoteRequest: z.boolean().default(false),
});

const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

const conversationListSchema = z.object({
  data: z.array(conversationSchema),
  meta: paginationSchema,
  summary: z
    .object({
      total: z.number().int().nonnegative(),
      botActive: z.number().int().nonnegative(),
      attendantActive: z.number().int().nonnegative(),
      automationPaused: z.number().int().nonnegative(),
      unreadMessages: z.number().int().nonnegative(),
      unreadConversations: z.number().int().nonnegative(),
    })
    .optional(),
});

const messageAttemptSchema = z.object({
  id: z.string().uuid(),
  attemptNumber: z.number().int().positive(),
  status: z.enum(['pending', 'succeeded', 'failed']),
  providerMessageId: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: isoDateSchema,
  completedAt: nullableIsoDateSchema,
});

const mediaSchema = z
  .object({
    mimeType: z.string().min(1).optional(),
    size: z.number().nonnegative().optional(),
    url: z
      .string()
      .url()
      .refine((value) => value.startsWith('https://'))
      .optional(),
    fileName: z.string().min(1).optional(),
  })
  .catchall(z.unknown())
  .nullable();

const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  providerMessageId: z.string().nullable(),
  direction: z.enum(WHATSAPP_MESSAGE_DIRECTIONS),
  deliveryStatus: z.enum(WHATSAPP_MESSAGE_DELIVERY_STATUSES),
  kind: z.enum(WHATSAPP_MESSAGE_KINDS),
  text: z.string().nullable(),
  media: mediaSchema,
  sentBy: z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1),
    })
    .nullable()
    .optional(),
  actor: z
    .object({
      type: z.union([z.enum(WHATSAPP_MESSAGE_ACTOR_TYPES), z.string().min(1)]),
      id: z.string().min(1).nullable().optional().default(null),
      name: z.string().min(1).nullable().optional().default(null),
    })
    .nullable()
    .optional(),
  source: z
    .union([z.enum(WHATSAPP_MESSAGE_SOURCES), z.string().min(1)])
    .nullable()
    .optional(),
  evidence: conversationEvidenceSchema.optional(),
  correlationId: z.string().min(1),
  occurredAt: isoDateSchema,
  attempts: z.array(messageAttemptSchema),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

const messageListSchema = z.object({
  data: z.array(messageSchema),
  meta: paginationSchema,
});

const humanMessageResultSchema = z.object({
  message: messageSchema,
  conversation: conversationSchema,
});

const versionedActionResultSchema = z
  .object({
    resultingVersion: z.number().int().positive(),
    conversation: conversationSchema.optional(),
    snapshot: z.union([conversationSchema, serviceSessionSchema]).optional(),
  })
  .refine((value) => value.conversation !== undefined || value.snapshot !== undefined);

const conversationSnapshotSchema = z.object({
  department: z.enum(WHATSAPP_CONVERSATION_DEPARTMENTS),
  conversationState: z.enum(WHATSAPP_CONVERSATION_STATES),
  flowStep: z.enum(WHATSAPP_CONVERSATION_FLOW_STEPS),
  requestStatus: z.enum(WHATSAPP_REQUEST_STATUSES),
});

const transitionSchema = z.object({
  id: z.string().uuid(),
  commandId: z.string().min(1).max(120),
  name: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  resultingVersion: z.number().int().positive(),
  actorType: z.string().min(1),
  actorUserId: z.string().uuid().nullable(),
  actorAgentId: z.string().min(1).nullable().optional(),
  source: z.string().min(1).nullable().optional(),
  actor: z
    .object({
      type: z.string().min(1),
      user: z
        .object({
          id: z.string().uuid(),
          name: z.string().min(1),
        })
        .nullable(),
    })
    .optional(),
  from: conversationSnapshotSchema,
  to: conversationSnapshotSchema,
  metadata: jsonObjectSchema,
  createdAt: isoDateSchema,
});

const transitionListSchema = z.object({
  data: z.array(transitionSchema),
  meta: paginationSchema,
});

const apiErrorSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]).optional(),
  details: z
    .object({
      currentVersion: z.number().int().positive().optional(),
    })
    .passthrough()
    .optional(),
});

type ApiConversation = z.infer<typeof conversationSchema>;
type ApiMessage = z.infer<typeof messageSchema>;
type ApiPagination = z.infer<typeof paginationSchema>;
type ApiEvidenceItem = z.infer<typeof evidenceItemSchema>;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function filtersToQuery(filters?: GetWhatsAppConversationsFilters): string {
  const params = new URLSearchParams({
    page: String(filters?.page ?? 1),
    pageSize: String(filters?.pageSize ?? 100),
  });

  if (filters?.search?.trim()) params.set('search', filters.search.trim());
  if (filters?.department) params.set('department', filters.department);
  if (filters?.state) params.set('state', filters.state);
  if (filters?.control) params.set('control', filters.control);
  if (filters?.requestStatus) params.set('requestStatus', filters.requestStatus);
  if (filters?.archive) params.set('archive', filters.archive);

  return `?${params.toString()}`;
}

function latestConversationActivity(conversation: ApiConversation): string {
  const candidates = [
    conversation.lastInboundAt,
    conversation.lastOutboundAt,
    conversation.updatedAt,
  ].filter((value): value is string => value !== null);

  return candidates.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}

function mapQuoteRequest(
  quoteRequest: ApiConversation['currentQuoteRequest'],
): WhatsAppQuoteRequest | null {
  if (quoteRequest === null) return null;

  return {
    ...quoteRequest,
    structuredData: quoteRequest.structuredData,
  };
}

function isTelephoneLabel(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && /^[+\d\s().-]+$/u.test(normalized);
}

function contactDisplayName(conversation: ApiConversation): string {
  const savedName = conversation.contact.displayName?.trim();
  if (savedName && !isTelephoneLabel(savedName)) return savedName;

  const confirmedName = conversation.currentQuoteRequest?.contactName?.trim();
  if (confirmedName && !isTelephoneLabel(confirmedName)) return confirmedName;

  return 'Contato não identificado';
}

function mapAttachment(message: ApiMessage): WhatsAppMessageAttachment | null {
  if (message.kind === 'text') return null;

  const media = message.media ?? {};
  const retentionStatus =
    media.retentionStatus === 'pending' ||
    media.retentionStatus === 'stored' ||
    media.retentionStatus === 'unavailable' ||
    media.retentionStatus === 'too-large'
      ? media.retentionStatus
      : null;
  const secureUrl = `/api/whatsapp-conversations/${encodeURIComponent(message.conversationId)}/messages/${encodeURIComponent(message.id)}/content`;
  const isHistoricalExport =
    typeof media.legacyReference === 'string' &&
    media.legacyReference.startsWith('whatsapp-export://');
  const hasRecoverableContent =
    retentionStatus === 'stored' ||
    retentionStatus === 'pending' ||
    (retentionStatus === null &&
      !isHistoricalExport &&
      (message.providerMessageId !== null || message.direction === 'outbound'));

  return {
    mimeType: typeof media.mimeType === 'string' ? media.mimeType : null,
    size: typeof media.size === 'number' ? media.size : null,
    url: hasRecoverableContent ? secureUrl : null,
    fileName: typeof media.fileName === 'string' ? media.fileName : null,
    retentionStatus,
    metadata: media,
  };
}

function mapEvidenceItem(item: ApiEvidenceItem): WhatsAppEvidenceItem {
  return {
    id: item.id,
    name: item.name ?? item.title ?? null,
    status: item.status ?? null,
    summary: item.summary ?? item.reason ?? null,
    url: item.url ?? null,
    occurredAt: item.occurredAt ?? item.createdAt ?? null,
    provider: item.provider ?? null,
    model: item.model ?? null,
    metadata: sanitizeEvidenceMetadata(item.metadata ?? {}),
  };
}

const SENSITIVE_EVIDENCE_METADATA_KEY =
  /(?:api[-_]?key|secret|token|credential|authorization|cookie)/iu;

function sanitizeEvidenceMetadata(
  metadata: Readonly<Record<string, unknown>>,
  depth = 0,
): Readonly<Record<string, unknown>> {
  if (depth >= 4) return {};

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !SENSITIVE_EVIDENCE_METADATA_KEY.test(key))
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return [
            key,
            value.map((item) =>
              item && typeof item === 'object' && !Array.isArray(item)
                ? sanitizeEvidenceMetadata(item as Readonly<Record<string, unknown>>, depth + 1)
                : item,
            ),
          ];
        }

        if (value && typeof value === 'object') {
          return [
            key,
            sanitizeEvidenceMetadata(value as Readonly<Record<string, unknown>>, depth + 1),
          ];
        }

        return [key, value];
      }),
  );
}

function mapEvidence(
  evidence: z.infer<typeof conversationEvidenceSchema> | undefined,
): WhatsAppConversationEvidence {
  return {
    agentExecutions: (evidence?.agentExecutions ?? []).map(mapEvidenceItem),
    knowledgeSources: (evidence?.knowledgeSources ?? []).map(mapEvidenceItem),
    toolExecutions: (evidence?.toolExecutions ?? []).map(mapEvidenceItem),
    mediaInterpretations: (evidence?.mediaInterpretations ?? []).map(mapEvidenceItem),
    registrationDataReviews: (evidence?.registrationDataReviews ?? []).map(mapEvidenceItem),
  };
}

function getConversationEvidence(conversation: ApiConversation): WhatsAppConversationEvidence {
  return mapEvidence({
    agentExecutions: conversation.evidence?.agentExecutions ?? conversation.agentExecutions ?? [],
    knowledgeSources:
      conversation.evidence?.knowledgeSources ?? conversation.knowledgeSources ?? [],
    toolExecutions: conversation.evidence?.toolExecutions ?? conversation.toolExecutions ?? [],
    mediaInterpretations:
      conversation.evidence?.mediaInterpretations ?? conversation.mediaInterpretations ?? [],
    registrationDataReviews:
      conversation.evidence?.registrationDataReviews ?? conversation.registrationDataReviews ?? [],
  });
}

function mapMessage(message: ApiMessage): WhatsAppMessage {
  return {
    id: message.id,
    direction: message.direction,
    deliveryStatus: message.deliveryStatus,
    kind: message.kind,
    text: message.text,
    attachment: mapAttachment(message),
    sentBy: message.sentBy ?? null,
    ...(message.actor !== undefined ? { actor: message.actor } : {}),
    ...(message.source !== undefined ? { source: message.source } : {}),
    ...(message.evidence !== undefined ? { evidence: mapEvidence(message.evidence) } : {}),
    occurredAt: message.occurredAt,
    attempts: message.attempts,
  };
}

function mapConversation(
  conversation: ApiConversation,
  messages: readonly WhatsAppMessage[] = [],
  transitions: readonly WhatsAppConversationTransition[] = [],
  messageHistory?: ApiPagination,
): WhatsAppConversation {
  const mappedConversation: WhatsAppConversation = {
    id: conversation.id,
    companyId: conversation.companyId,
    channel: conversation.channel,
    sourceChannel: conversation.sourceChannel ?? {
      id: conversation.channel.id,
      name: conversation.channel.name,
      type: 'WHATSAPP',
      address: conversation.channel.phoneNumber,
    },
    contact: {
      id: conversation.contact.id,
      name: contactDisplayName(conversation),
      phone: conversation.contact.phone,
      profilePictureUrl: conversation.contact.profilePictureUrl,
    },
    department: conversation.department,
    conversationState: conversation.conversationState,
    flowStep: conversation.flowStep,
    requestStatus: conversation.requestStatus,
    resumeState: conversation.resumeState,
    assignedTo: conversation.assignedTo,
    ...((conversation.currentServiceSession ?? conversation.serviceSession)
      ? {
          currentServiceSession: {
            ...(conversation.currentServiceSession ?? conversation.serviceSession)!,
            projection: 'NATIVE' as const,
          },
        }
      : {}),
    evidence: getConversationEvidence(conversation),
    assistantSuggestions: conversation.assistantSuggestions,
    unreadCount: conversation.unreadCount,
    version: conversation.version,
    lastInboundAt: conversation.lastInboundAt,
    lastOutboundAt: conversation.lastOutboundAt,
    lastMessagePreview: conversation.lastMessagePreview ?? '',
    lastMessageAt: latestConversationActivity(conversation),
    closedAt: conversation.closedAt,
    archivedAt: conversation.archivedAt,
    archiveReason: conversation.archiveReason,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    currentQuoteRequest: mapQuoteRequest(conversation.currentQuoteRequest),
    hasApprovedQuoteRequest: conversation.hasApprovedQuoteRequest,
    messages,
    ...(messageHistory ? { messageHistory } : {}),
    transitions,
  };

  return {
    ...mappedConversation,
    currentServiceSession:
      mappedConversation.currentServiceSession ??
      getCurrentWhatsAppServiceSession(mappedConversation),
  };
}

function responseStatusToErrorCode(status: number): WhatsAppConversationRepositoryErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'too-many-requests';
  return 'service-unavailable';
}

function invalidMediaResponse(message: string): never {
  throw new WhatsAppConversationRepositoryError('invalid-response', message);
}

function declaredMediaContentLength(response: Response): number | null {
  const rawContentLength = response.headers.get('content-length');
  if (rawContentLength === null) return null;

  if (!/^\d+$/u.test(rawContentLength)) {
    return invalidMediaResponse('A Tenant API retornou um tamanho de mídia inválido.');
  }

  const contentLength = Number(rawContentLength);
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > MAX_WHATSAPP_MEDIA_CONTENT_BYTES
  ) {
    return invalidMediaResponse('A Tenant API retornou um tamanho de mídia inválido.');
  }

  return contentLength;
}

function mediaMimeType(response: Response): string {
  const mimeType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!mimeType) {
    return invalidMediaResponse('A Tenant API não informou o tipo da mídia.');
  }
  return mimeType;
}

function safeMediaFileName(encodedValue: string | null, messageId: string): string {
  let decodedValue: string | null = null;
  if (encodedValue) {
    try {
      decodedValue = decodeURIComponent(encodedValue);
    } catch {
      decodedValue = null;
    }
  }

  const leaf = (decodedValue?.split(/[\\/]/u).pop() ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/gu, '_')
    .replace(/["<>:|?*]/gu, '_')
    .trim();

  return (leaf || `midia-whatsapp-${messageId.slice(0, 8)}`).slice(0, 200);
}

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new WhatsAppConversationRepositoryError(
      'invalid-response',
      'A Tenant API retornou dados de WhatsApp incompatíveis com o contrato.',
    );
  }

  return parsed.data;
}

function parseErrorResponse(value: unknown): {
  readonly message: string | null;
  readonly currentVersion: number | null;
} {
  const parsed = apiErrorSchema.safeParse(value);
  if (!parsed.success) return { message: null, currentVersion: null };

  const rawMessage = parsed.data.message;
  const message = Array.isArray(rawMessage) ? rawMessage.join(' ') : rawMessage;

  return {
    message: message?.trim() || null,
    currentVersion: parsed.data.details?.currentVersion ?? null,
  };
}

export class LumeApiWhatsAppConversationRepository implements WhatsAppConversationRepository {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 5_000,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  async getServiceAssignmentTargets(): Promise<readonly WhatsAppServiceAssignmentTarget[]> {
    return parseResponse(
      z.array(serviceAssignmentTargetSchema),
      await this.request('/service/sessions/assignment-targets'),
    );
  }

  async startConversation(phone: string): Promise<WhatsAppConversation> {
    const response = parseResponse(
      conversationSchema,
      await this.request('/whatsapp/conversations', {
        method: 'POST',
        body: { commandId: randomUUID(), phone },
      }),
    );
    return mapConversation(response);
  }

  async getConversations(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<readonly WhatsAppConversation[]> {
    return (await this.getConversationPage(filters)).conversations;
  }

  async getDashboardConversations(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<readonly WhatsAppConversation[]> {
    return (await this.getDashboardConversationPage(filters)).conversations;
  }

  getConversationPage(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<WhatsAppConversationPage> {
    return this.getConversationCollectionPage('/whatsapp/conversations', filters);
  }

  getDashboardConversationPage(
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<WhatsAppConversationPage> {
    return this.getConversationCollectionPage('/whatsapp/conversations/dashboard', filters);
  }

  private async getConversationCollectionPage(
    path: string,
    filters?: GetWhatsAppConversationsFilters,
  ): Promise<WhatsAppConversationPage> {
    const firstPage = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 100;
    const response = parseResponse(
      conversationListSchema,
      await this.request(
        `${path}${filtersToQuery({
          ...filters,
          page: firstPage,
          pageSize,
        })}`,
      ),
    );

    const conversations = response.data.map((conversation) => mapConversation(conversation));
    const localMetrics = getWhatsAppConversationMetrics(conversations);

    return {
      conversations,
      ...response.meta,
      metrics: response.summary
        ? {
            ...response.summary,
            awaitingProposal: 0,
          }
        : localMetrics,
    };
  }

  async getConversationById(
    conversationId: string,
    messagePage = 1,
  ): Promise<WhatsAppConversation | null> {
    let conversationValue: unknown;

    try {
      conversationValue = await this.request(
        `/whatsapp/conversations/${encodeURIComponent(conversationId)}`,
      );
    } catch (error) {
      if (error instanceof WhatsAppConversationRepositoryError && error.code === 'not-found') {
        return null;
      }
      throw error;
    }

    const conversation = parseResponse(conversationSchema, conversationValue);
    const [messageHistory, transitions] = await Promise.all([
      this.getMessagePage(conversationId, messagePage),
      this.getAllTransitions(conversationId),
    ]);

    return mapConversation(conversation, messageHistory.messages, transitions, messageHistory.meta);
  }

  async searchMessages(
    conversationId: string,
    search: string,
    page = 1,
  ): Promise<WhatsAppMessageSearchResult> {
    const path = `/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '50',
      search: search.trim(),
    });
    const result = parseResponse(
      messageListSchema,
      await this.request(`${path}?${params.toString()}`),
    );
    return {
      messages: result.data.map(mapMessage),
      ...result.meta,
    };
  }

  async downloadMessageContent(
    conversationId: string,
    messageId: string,
  ): Promise<{
    readonly bytes: Uint8Array;
    readonly fileName: string;
    readonly mimeType: string;
  }> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.baseUrl}/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/content`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: '*/*',
            Authorization: `Bearer ${this.accessToken}`,
          },
          signal: AbortSignal.timeout(Math.max(this.timeoutMs, 35_000)),
        },
      );
    } catch {
      throw new WhatsAppConversationRepositoryError(
        'service-unavailable',
        'Não foi possível carregar a mídia desta conversa.',
      );
    }

    if (!response.ok) {
      throw new WhatsAppConversationRepositoryError(
        responseStatusToErrorCode(response.status),
        'Não foi possível carregar a mídia desta conversa.',
      );
    }

    const declaredLength = declaredMediaContentLength(response);
    const mimeType = mediaMimeType(response);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      return invalidMediaResponse('A Tenant API retornou uma mídia que não pôde ser lida.');
    }

    if (
      bytes.byteLength < 1 ||
      bytes.byteLength > MAX_WHATSAPP_MEDIA_CONTENT_BYTES ||
      (declaredLength !== null && bytes.byteLength !== declaredLength)
    ) {
      return invalidMediaResponse(
        'A Tenant API retornou uma mídia vazia, incompleta ou acima do limite.',
      );
    }

    return {
      bytes,
      fileName: safeMediaFileName(response.headers.get('x-whatsapp-media-filename'), messageId),
      mimeType,
    };
  }

  async getMediaInterpretation(
    conversationId: string,
    messageId: string,
  ): Promise<WhatsAppMediaInterpretation> {
    return parseResponse(
      mediaInterpretationSchema,
      await this.request(
        `/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/media-interpretation`,
      ),
    );
  }

  async analyzeMedia(
    conversationId: string,
    messageId: string,
  ): Promise<WhatsAppMediaInterpretation | DeferredWhatsAppMediaInterpretation> {
    return parseResponse(
      z.union([mediaInterpretationSchema, deferredMediaInterpretationSchema]),
      await this.request(
        `/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/actions/analyze-media`,
        { method: 'POST' },
      ),
    );
  }

  async correctMediaInterpretation(
    conversationId: string,
    messageId: string,
    correction: string,
    feedback?: string,
  ): Promise<WhatsAppMediaInterpretation> {
    return parseResponse(
      mediaInterpretationSchema,
      await this.request(
        `/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/media-interpretation/correction`,
        { method: 'POST', body: { correction, ...(feedback ? { feedback } : {}) } },
      ),
    );
  }

  async takeOverConversation(
    conversationId: string,
    expectedVersion: number,
    commandId?: string,
    serviceSessionId: string = conversationId,
  ): Promise<WhatsAppConversation> {
    return this.executeServiceSessionAction(
      conversationId,
      serviceSessionId,
      'assume',
      expectedVersion,
      {},
      commandId,
    );
  }

  async resolveAssistantSuggestion(
    input: ResolveWhatsAppAssistantSuggestionCommand,
  ): Promise<WhatsAppConversation> {
    const { conversationId, suggestionId, ...command } = input;
    const response = await this.request(
      `/whatsapp/conversations/${encodeURIComponent(conversationId)}/assistant-suggestions/${encodeURIComponent(suggestionId)}/resolve`,
      { method: 'POST', body: command },
    );
    return mapConversation(parseResponse(conversationSchema, response));
  }

  async returnConversationToBot(
    conversationId: string,
    expectedVersion: number,
    commandId?: string,
    serviceSessionId: string = conversationId,
  ): Promise<WhatsAppConversation> {
    return this.executeServiceSessionAction(
      conversationId,
      serviceSessionId,
      'return-to-ai',
      expectedVersion,
      {},
      commandId,
    );
  }

  async forwardConversation(
    conversationId: string,
    targetDepartment: WhatsAppConversationDepartment,
    expectedVersion: number,
    commandId?: string,
    serviceSessionId: string = conversationId,
  ): Promise<WhatsAppConversation> {
    const target = (await this.getServiceAssignmentTargets()).find(
      (candidate) => candidate.code === targetDepartment,
    );
    if (!target) {
      throw new WhatsAppConversationRepositoryError(
        'validation',
        'O departamento de destino não está disponível para transferência.',
      );
    }
    return this.executeServiceSessionAction(
      conversationId,
      serviceSessionId,
      'transfer',
      expectedVersion,
      { departmentId: target.id },
      commandId,
    );
  }

  async returnConversationToQueue(
    conversationId: string,
    command: ReturnToQueueWhatsAppServiceSessionCommand,
  ): Promise<WhatsAppConversation> {
    return this.executeServiceSessionAction(
      conversationId,
      command.serviceSessionId,
      'return-to-queue',
      command.expectedVersion,
      { queueId: command.queueId },
      command.commandId,
    );
  }

  async transferServiceSession(
    conversationId: string,
    command: TransferWhatsAppServiceSessionCommand,
  ): Promise<WhatsAppConversation> {
    return this.executeServiceSessionAction(
      conversationId,
      command.serviceSessionId,
      'transfer',
      command.expectedVersion,
      {
        departmentId: command.departmentId,
        ...(command.queueId ? { queueId: command.queueId } : {}),
        ...(command.userId ? { userId: command.userId } : {}),
        ...(command.reason?.trim() ? { reason: command.reason.trim() } : {}),
      },
      command.commandId,
    );
  }

  async changeConversationPriority(
    conversationId: string,
    command: ChangeWhatsAppServiceSessionPriorityCommand,
  ): Promise<WhatsAppConversation> {
    return this.executeServiceSessionAction(
      conversationId,
      command.serviceSessionId,
      'change-priority',
      command.expectedVersion,
      {
        priority: command.priority.toLowerCase(),
        reason: command.reason?.trim(),
      },
      command.commandId,
    );
  }

  async changeConversationDepartment(
    conversationId: string,
    targetDepartment: WhatsAppConversationDepartment,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return this.executeVersionedAction(conversationId, 'change-department', expectedVersion, {
      targetDepartment,
    });
  }

  async archiveConversation(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return this.executeVersionedAction(conversationId, 'archive', expectedVersion);
  }

  async unarchiveConversation(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return this.executeVersionedAction(conversationId, 'unarchive', expectedVersion);
  }

  async markConversationAsRead(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return this.executeVersionedAction(conversationId, 'mark-read', expectedVersion);
  }

  async closeConversationAfterRejection(
    conversationId: string,
    expectedVersion: number,
  ): Promise<WhatsAppConversation> {
    return this.executeVersionedAction(conversationId, 'close-after-rejection', expectedVersion);
  }

  async closeConversation(
    conversationId: string,
    expectedVersion: number,
    reason?: string | null,
    commandId?: string,
    serviceSessionId: string = conversationId,
  ): Promise<WhatsAppConversation> {
    return this.executeServiceSessionAction(
      conversationId,
      serviceSessionId,
      'close',
      expectedVersion,
      { reason: reason?.trim() },
      commandId,
    );
  }

  async sendHumanMessage(
    conversationId: string,
    command: SendHumanWhatsAppMessageCommand,
  ): Promise<SendHumanWhatsAppMessageResult> {
    const response = parseResponse(
      humanMessageResultSchema,
      await this.request(`/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: command,
      }),
    );

    return {
      conversation: mapConversation(response.conversation),
      message: mapMessage(response.message),
    };
  }

  private async getMessagePage(
    conversationId: string,
    page: number,
  ): Promise<{
    readonly messages: readonly WhatsAppMessage[];
    readonly meta: ApiPagination;
  }> {
    const path = `/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`;
    const result = parseResponse(
      messageListSchema,
      await this.request(`${path}?page=${page}&pageSize=100`),
    );

    return {
      messages: result.data
        .sort((first, second) => {
          const difference = Date.parse(first.occurredAt) - Date.parse(second.occurredAt);
          return difference === 0 ? first.id.localeCompare(second.id) : difference;
        })
        .map(mapMessage),
      meta: result.meta,
    };
  }

  private async getAllTransitions(
    conversationId: string,
  ): Promise<readonly WhatsAppConversationTransition[]> {
    const path = `/whatsapp/conversations/${encodeURIComponent(conversationId)}/transitions`;
    const firstPage = parseResponse(
      transitionListSchema,
      await this.request(`${path}?page=1&pageSize=100`),
    );
    const transitions = [...firstPage.data];

    for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
      const result = parseResponse(
        transitionListSchema,
        await this.request(`${path}?page=${page}&pageSize=100`),
      );
      transitions.push(...result.data);
    }

    return transitions.sort((first, second) => {
      const difference = second.resultingVersion - first.resultingVersion;
      return difference === 0 ? second.id.localeCompare(first.id) : difference;
    });
  }

  private async executeVersionedAction(
    conversationId: string,
    action:
      | 'take-over'
      | 'return-to-bot'
      | 'return-to-queue'
      | 'forward'
      | 'change-priority'
      | 'change-department'
      | 'archive'
      | 'unarchive'
      | 'mark-read'
      | 'close'
      | 'close-after-rejection',
    expectedVersion: number,
    extra: Readonly<Record<string, unknown>> = {},
    commandId: string = randomUUID(),
  ): Promise<WhatsAppConversation> {
    const responseValue = await this.request(
      `/whatsapp/conversations/${encodeURIComponent(conversationId)}/actions/${action}`,
      {
        method: 'POST',
        body: {
          commandId,
          expectedVersion,
          ...extra,
        },
      },
    );
    const directConversation = conversationSchema.safeParse(responseValue);

    if (directConversation.success) return mapConversation(directConversation.data);

    const response = parseResponse(versionedActionResultSchema, responseValue);
    if (response.conversation) return mapConversation(response.conversation);

    const snapshotConversation = conversationSchema.safeParse(response.snapshot);
    if (snapshotConversation.success) return mapConversation(snapshotConversation.data);

    return this.reconcileServiceSessionSnapshot(
      conversationId,
      serviceSessionSchema.parse(response.snapshot),
      response.resultingVersion,
    );
  }

  private async executeServiceSessionAction(
    conversationId: string,
    serviceSessionId: string,
    action:
      'assume' | 'return-to-queue' | 'return-to-ai' | 'transfer' | 'change-priority' | 'close',
    expectedVersion: number,
    extra: Readonly<Record<string, unknown>> = {},
    commandId: string = randomUUID(),
  ): Promise<WhatsAppConversation> {
    // A successful transfer may remove the source user's access immediately.
    const sourceConversation =
      action === 'transfer'
        ? mapConversation(
            parseResponse(
              conversationSchema,
              await this.request('/whatsapp/conversations/' + encodeURIComponent(conversationId)),
            ),
          )
        : undefined;
    const responseValue = await this.request(
      `/service/sessions/${encodeURIComponent(serviceSessionId)}/actions/${action}`,
      {
        method: 'POST',
        body: { commandId, expectedVersion, ...extra },
      },
    );
    const directServiceSession = serviceSessionSchema.safeParse(responseValue);
    if (directServiceSession.success) {
      return this.reconcileServiceSessionSnapshot(
        conversationId,
        directServiceSession.data,
        directServiceSession.data.version,
        sourceConversation,
      );
    }
    const response = parseResponse(versionedActionResultSchema, responseValue);
    const snapshotConversation = conversationSchema.safeParse(
      response.conversation ?? response.snapshot,
    );
    if (snapshotConversation.success) return mapConversation(snapshotConversation.data);

    return this.reconcileServiceSessionSnapshot(
      conversationId,
      serviceSessionSchema.parse(response.snapshot),
      response.resultingVersion,
      sourceConversation,
    );
  }

  private async reconcileServiceSessionSnapshot(
    conversationId: string,
    serviceSession: z.infer<typeof serviceSessionSchema>,
    resultingVersion: number,
    sourceConversation?: WhatsAppConversation,
  ): Promise<WhatsAppConversation> {
    const conversation = sourceConversation ?? (await this.getConversationById(conversationId));
    if (!conversation) {
      throw new WhatsAppConversationRepositoryError(
        'not-found',
        'A conversa atualizada não foi encontrada após a confirmação do comando.',
      );
    }

    return {
      ...conversation,
      currentServiceSession: {
        ...serviceSession,
        version: resultingVersion,
        projection: 'NATIVE',
      },
    };
  }

  private async request(
    path: string,
    input: { readonly method?: string; readonly body?: unknown } = {},
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: input.method ?? 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          ...(input.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new WhatsAppConversationRepositoryError(
        'service-unavailable',
        'Não foi possível conectar à Lume Tenant API.',
      );
    }

    if (!response.ok) {
      let errorBody: unknown;

      try {
        errorBody = await response.json();
      } catch {
        errorBody = null;
      }

      const parsedError = parseErrorResponse(errorBody);
      throw new WhatsAppConversationRepositoryError(
        responseStatusToErrorCode(response.status),
        parsedError.message ?? `A Tenant API respondeu com o status ${response.status}.`,
        parsedError.currentVersion,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new WhatsAppConversationRepositoryError(
        'invalid-response',
        'A Tenant API retornou uma resposta de WhatsApp que não é JSON.',
      );
    }
  }
}

export { LumeApiWhatsAppConversationRepository as TenantApiWhatsAppConversationRepository };
