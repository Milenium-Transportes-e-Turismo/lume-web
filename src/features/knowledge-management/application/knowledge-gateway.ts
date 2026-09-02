import type {
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeDocumentSummary,
  KnowledgeDepartment,
  KnowledgeGap,
  KnowledgeGapStatus,
  KnowledgeScope,
  KnowledgeSuggestion,
  KnowledgeSuggestionStatus,
  KnowledgeVisibility,
} from '../domain';

export type KnowledgeGatewayErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class KnowledgeGatewayError extends Error {
  constructor(
    readonly code: KnowledgeGatewayErrorCode,
    message: string,
    readonly publicCode: string,
  ) {
    super(message);
    this.name = 'KnowledgeGatewayError';
  }
}

export interface KnowledgeMetadataInput {
  readonly commandId: string;
  readonly knowledgeBaseId: string;
  readonly title: string;
  readonly description?: string;
  readonly scope: KnowledgeScope;
  readonly visibility: KnowledgeVisibility;
  readonly departmentIds: readonly string[];
  readonly effectiveFrom?: string;
  readonly effectiveUntil?: string;
}

export interface KnowledgeGateway {
  listDepartments(): Promise<readonly KnowledgeDepartment[]>;
  listBases(): Promise<readonly KnowledgeBase[]>;
  createBase(input: {
    readonly commandId: string;
    readonly name: string;
    readonly description?: string;
  }): Promise<unknown>;
  listDocuments(knowledgeBaseId?: string): Promise<readonly KnowledgeDocumentSummary[]>;
  getDocument(documentId: string): Promise<KnowledgeDocument>;
  createArticle(input: KnowledgeMetadataInput & { readonly content: string }): Promise<unknown>;
  uploadOriginal(input: KnowledgeMetadataInput & { readonly file: File }): Promise<unknown>;
  createNextDraft(
    documentId: string,
    input: {
      readonly commandId: string;
      readonly expectedVersion: number;
      readonly content?: string;
      readonly effectiveFrom?: string;
      readonly effectiveUntil?: string;
    },
  ): Promise<unknown>;
  updateDraft(
    documentId: string,
    versionId: string,
    input: {
      readonly commandId: string;
      readonly expectedVersion: number;
      readonly expectedContentHash: string;
      readonly content: string;
      readonly effectiveFrom?: string;
      readonly effectiveUntil?: string;
    },
  ): Promise<unknown>;
  publishVersion(
    documentId: string,
    versionId: string,
    input: { readonly commandId: string; readonly expectedVersion: number },
  ): Promise<unknown>;
  archiveVersion(
    documentId: string,
    versionId: string,
    input: { readonly commandId: string; readonly expectedVersion: number },
  ): Promise<unknown>;
  archiveDocument(
    documentId: string,
    input: { readonly commandId: string; readonly expectedVersion: number },
  ): Promise<unknown>;
  getOriginal(documentId: string, versionId: string): Promise<Response>;
  listSuggestions(status?: KnowledgeSuggestionStatus): Promise<readonly KnowledgeSuggestion[]>;
  reviewSuggestion(
    suggestionId: string,
    input: { readonly commandId: string; readonly decision: 'approved' | 'rejected' },
  ): Promise<unknown>;
  listGaps(status?: KnowledgeGapStatus): Promise<readonly KnowledgeGap[]>;
  reviewGap(
    gapId: string,
    input: {
      readonly commandId: string;
      readonly decision: 'acknowledged' | 'resolved' | 'dismissed';
    },
  ): Promise<unknown>;
}
