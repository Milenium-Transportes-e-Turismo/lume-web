import type {
  DocumentChecklistSummary,
  DocumentRequestContext,
  DocumentRequestDetail,
  DocumentRequestList,
  DocumentRequestStatus,
  DocumentTypeSummary,
} from '../domain';

export type DocumentManagementErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class DocumentManagementError extends Error {
  constructor(
    readonly code: DocumentManagementErrorCode,
    message: string,
    readonly publicCode = code.toUpperCase().replaceAll('-', '_'),
  ) {
    super(message);
    this.name = 'DocumentManagementError';
  }
}

export interface DocumentManagementGateway {
  listRequests(query?: {
    page?: number;
    pageSize?: number;
    status?: DocumentRequestStatus;
    context?: DocumentRequestContext;
    subjectUserId?: string;
  }): Promise<DocumentRequestList>;
  getRequest(requestId: string): Promise<DocumentRequestDetail>;
  listChecklists(): Promise<readonly DocumentChecklistSummary[]>;
  listDocumentTypes(): Promise<readonly DocumentTypeSummary[]>;
  createRequest(input: {
    commandId: string;
    subjectUserId?: string;
    subjectRegistrationId?: string;
    checklistId: string;
    context: DocumentRequestContext;
    deadline?: string;
    notes?: string;
  }): Promise<DocumentRequestDetail>;
  createBatchRequests(input: {
    commandId: string;
    subjectUserIds: readonly string[];
    documentTypeIds: readonly string[];
    context: DocumentRequestContext;
    deadline?: string;
    notes?: string;
  }): Promise<{
    readonly createdCount: number;
    readonly idempotentCount: number;
    readonly requests: readonly {
      readonly id: string;
      readonly subjectUserId: string;
      readonly itemCount: number;
      readonly idempotent: boolean;
    }[];
    readonly skippedDocuments: readonly {
      readonly subjectUserId: string;
      readonly documentTypeId: string;
      readonly reason: string;
    }[];
  }>;
  addRequestItem(
    requestId: string,
    input: {
      documentTypeId: string;
      requirement: 'required' | 'optional';
      instructions?: string;
      dueAt?: string;
      reason: string;
    },
  ): Promise<DocumentRequestDetail>;
  setRequestItemPolicy(
    requestItemId: string,
    input: { policy: 'required' | 'optional' | 'waived'; reason: string },
  ): Promise<DocumentRequestDetail>;
  upload(requestItemId: string, formData: FormData): Promise<DocumentRequestDetail>;
  uploadAndComplete(requestItemId: string, formData: FormData): Promise<DocumentRequestDetail>;
  completeSubmission(submissionId: string): Promise<DocumentRequestDetail>;
  deleteSubmission(
    submissionId: string,
    input: { reason?: string },
  ): Promise<DocumentRequestDetail>;
  updateExtractedData(
    submissionId: string,
    input: {
      fields: Readonly<Record<string, unknown>>;
      confidences?: Readonly<Record<string, number>>;
    },
  ): Promise<DocumentRequestDetail>;
  review(
    submissionId: string,
    input: {
      commandId: string;
      decision: 'approved' | 'rejected' | 'resubmission-required';
      reason?: string;
      notes?: string;
      validUntil?: string;
      originalCheckStatus?: 'not-required' | 'pending' | 'confirmed' | 'divergent';
      originalObservation?: string;
      correctedFields?: Readonly<Record<string, unknown>>;
      confirmedFields?: Readonly<Record<string, unknown>>;
    },
  ): Promise<DocumentRequestDetail>;
  getFile(fileId: string): Promise<Response>;
  downloadExport(): Promise<Response>;
  downloadUserExport(subjectUserId: string, kind?: 'users' | 'registrations'): Promise<Response>;
  downloadUserFiles(subjectUserId: string, kind?: 'users' | 'registrations'): Promise<Response>;
}
