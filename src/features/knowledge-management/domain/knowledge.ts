export const KNOWLEDGE_SCOPES = ['tenant', 'department', 'multi-department'] as const;
export type KnowledgeScope = (typeof KNOWLEDGE_SCOPES)[number];

export const KNOWLEDGE_VISIBILITIES = ['customer-safe', 'internal'] as const;
export type KnowledgeVisibility = (typeof KNOWLEDGE_VISIBILITIES)[number];

export const KNOWLEDGE_VERSION_STATUSES = ['draft', 'published', 'superseded', 'archived'] as const;
export type KnowledgeVersionStatus = (typeof KNOWLEDGE_VERSION_STATUSES)[number];

export const KNOWLEDGE_SUGGESTION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'published',
] as const;
export type KnowledgeSuggestionStatus = (typeof KNOWLEDGE_SUGGESTION_STATUSES)[number];

export const KNOWLEDGE_GAP_STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'] as const;
export type KnowledgeGapStatus = (typeof KNOWLEDGE_GAP_STATUSES)[number];

export type JsonRecord = Readonly<Record<string, unknown>>;

export interface KnowledgeBase {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly archivedAt: string | null;
  readonly documentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnowledgeDepartment {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isDefault: boolean;
}

export interface KnowledgeOriginal {
  readonly available: true;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface KnowledgeChunk {
  readonly id: string;
  readonly ordinal: number;
  readonly pageNumber: number | null;
  readonly content: string;
  readonly contentHash: string;
  readonly tokenCount: number | null;
  readonly provenance: JsonRecord;
}

export interface KnowledgeVersion {
  readonly id: string;
  readonly version: number;
  readonly status: KnowledgeVersionStatus;
  readonly content: string | null;
  readonly original: KnowledgeOriginal | null;
  readonly contentHash: string | null;
  readonly provenance: JsonRecord;
  readonly effectiveFrom: string | null;
  readonly effectiveUntil: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly chunks: readonly KnowledgeChunk[];
}

export interface KnowledgeDocumentSummary {
  readonly id: string;
  readonly knowledgeBaseId: string;
  readonly title: string;
  readonly description: string | null;
  readonly sourceType: 'article' | 'file';
  readonly scope: KnowledgeScope;
  readonly visibility: KnowledgeVisibility;
  readonly departmentIds: readonly string[];
  readonly archivedAt: string | null;
  readonly latestVersion: KnowledgeVersion | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnowledgeDocument extends Omit<KnowledgeDocumentSummary, 'latestVersion'> {
  readonly versions: readonly KnowledgeVersion[];
}

export interface KnowledgeSuggestion {
  readonly id: string;
  readonly serviceSessionId: string | null;
  readonly agentExecutionId: string | null;
  readonly resultingDocumentId: string | null;
  readonly title: string;
  readonly proposedContent: string;
  readonly evidence: JsonRecord;
  readonly status: KnowledgeSuggestionStatus;
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnowledgeGap {
  readonly id: string;
  readonly serviceSessionId: string | null;
  readonly agentExecutionId: string | null;
  readonly topic: string;
  readonly occurrenceCount: number;
  readonly status: KnowledgeGapStatus;
  readonly evidence: JsonRecord;
  readonly firstObservedAt: string;
  readonly lastObservedAt: string;
  readonly resolvedAt: string | null;
}

export interface KnowledgePermissions {
  readonly canView: boolean;
  readonly canManage: boolean;
  readonly canPublish: boolean;
}
