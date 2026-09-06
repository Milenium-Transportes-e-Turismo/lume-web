export type DocumentRequestContext =
  'admission' | 'document-update' | 'document-renewal' | 'regularization' | 'offboarding' | 'other';

export type DocumentRequestStatus =
  | 'draft'
  | 'pending-upload'
  | 'partially-submitted'
  | 'submitted'
  | 'automatic-validation'
  | 'pending-human-review'
  | 'resubmission-required'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface DocumentTypeSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}

export interface DocumentRequestSummary {
  readonly id: string;
  readonly context: DocumentRequestContext;
  readonly status: DocumentRequestStatus;
  readonly deadline: string | null;
  readonly version: number;
  readonly subject: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly registrationId?: string | null;
    readonly userId?: string | null;
  };
  readonly checklist: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly version: number;
  };
  readonly progress: {
    readonly total: number;
    readonly uploaded: number;
    readonly approved: number;
    readonly pending: number;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DocumentRequestList {
  readonly data: readonly DocumentRequestSummary[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface DocumentChecklistSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly context: DocumentRequestContext;
  readonly version: number;
  readonly active: boolean;
  readonly items: readonly {
    readonly id: string;
    readonly requirement: 'required' | 'optional' | 'conditional';
    readonly instructions: string | null;
    readonly documentType: { readonly id: string; readonly code: string; readonly name: string };
  }[];
}

export interface DocumentRequestDetail extends Omit<DocumentRequestSummary, 'progress'> {
  readonly notes: string | null;
  readonly completedAt: string | null;
  readonly createdBy: { readonly id: string; readonly name: string };
  readonly subject: DocumentRequestSummary['subject'] & {
    readonly documentAccessMode: 'standard' | 'document-portal';
  };
  readonly items: readonly DocumentRequestItem[];
}

export interface DocumentRequestItem {
  readonly id: string;
  readonly requirement: 'required' | 'optional' | 'conditional';
  readonly status: Exclude<DocumentRequestStatus, 'draft' | 'partially-submitted'> | 'waived';
  readonly position: number;
  readonly instructions: string | null;
  readonly dueAt: string | null;
  readonly validUntil: string | null;
  readonly currentVersion: number;
  readonly config: Readonly<Record<string, unknown>>;
  readonly documentType: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly description: string | null;
  };
  readonly submissions: readonly DocumentSubmission[];
}

export interface DocumentSubmission {
  readonly id: string;
  readonly version: number;
  readonly status: DocumentRequestItem['status'];
  readonly extractedData: Readonly<Record<string, unknown>>;
  readonly confirmedData: Readonly<Record<string, unknown>>;
  readonly submittedAt: string;
  readonly files: readonly {
    readonly id: string;
    readonly side: 'single' | 'front' | 'back' | 'page';
    readonly pageNumber: number;
    readonly fileName: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly sha256: string;
    readonly createdAt: string;
  }[];
  readonly validation: null | {
    readonly status: string;
    readonly alerts: readonly unknown[];
    readonly extractedFields: Readonly<Record<string, unknown>>;
    readonly overallConfidence: number | null;
    readonly summary: string | null;
    readonly provider: string;
    readonly modelVersion: string | null;
    readonly completedAt: string | null;
  };
  readonly reviews: readonly {
    readonly id: string;
    readonly decision: string;
    readonly reason: string | null;
    readonly notes: string | null;
    readonly originalCheckStatus: string;
    readonly originalCheckedAt: string | null;
    readonly originalObservation: string | null;
    readonly reviewedBy: { readonly id: string; readonly name: string };
    readonly createdAt: string;
  }[];
}

export const DOCUMENT_CONTEXT_LABELS: Readonly<Record<DocumentRequestContext, string>> = {
  admission: 'Admissão',
  'document-update': 'Atualização documental',
  'document-renewal': 'Renovação',
  regularization: 'Regularização',
  offboarding: 'Desligamento',
  other: 'Outra solicitação',
};

export const DOCUMENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: 'Rascunho',
  'pending-upload': 'Aguardando envio',
  'partially-submitted': 'Envio parcial',
  submitted: 'Enviado',
  'automatic-validation': 'Pré-validação',
  'pending-human-review': 'Aguardando revisão',
  'resubmission-required': 'Reenvio solicitado',
  approved: 'Aprovado',
  rejected: 'Recusado',
  expired: 'Vencido',
  waived: 'Dispensado',
  cancelled: 'Cancelado',
};
