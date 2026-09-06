export type RegistrationType = 'pf' | 'pj';
export type RegistrationStatus = 'active' | 'inactive';

export interface RegistrationRole {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly active?: boolean;
}

export interface RegistrationTag {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly color: string | null;
  readonly active?: boolean;
}

export interface RegistrationPhone {
  readonly id?: string;
  readonly number: string;
  readonly originalValue?: string | null;
  readonly normalizedValue?: string;
  readonly type: 'mobile' | 'commercial' | 'residential' | 'other';
  readonly isPrimary: boolean;
  readonly hasWhatsApp: boolean;
  readonly whatsappContactId?: string | null;
  readonly activeFrom?: string | null;
  readonly activeUntil?: string | null;
}

export interface RegistrationEmail {
  readonly id?: string;
  readonly address: string;
  readonly type: 'personal' | 'commercial' | 'financial' | 'other';
  readonly isPrimary: boolean;
}

export interface RegistrationRelationship {
  readonly id: string;
  readonly direction: 'incoming' | 'outgoing';
  readonly type: string;
  readonly jobTitle: string | null;
  readonly department: string | null;
  readonly isPrimary: boolean;
  readonly notes: string | null;
  readonly version: number;
  readonly relatedRegistration: {
    readonly id: string;
    readonly type: RegistrationType;
    readonly displayName: string;
  };
}

export interface RegistrationAddress {
  readonly street: string;
  readonly number: string;
  readonly complement?: string | null;
  readonly district: string;
  readonly postalCode: string;
  readonly city: string;
  readonly state: string;
}

export interface RegistrationDocumentProfile {
  readonly jobTitle: string | null;
  readonly maritalStatus: string | null;
  readonly militaryDocumentStatus: 'applicable' | 'not-applicable' | 'pending-confirmation';
  readonly dependents: readonly {
    readonly name: string;
    readonly birthDate: string;
    readonly relationship?: string;
  }[];
}

export interface Registration {
  readonly documentProfile?: RegistrationDocumentProfile | null;
  readonly address?: RegistrationAddress | null;
  readonly serviceInstructions?: string | null;
  readonly id: string;
  readonly type: RegistrationType;
  readonly status: RegistrationStatus;
  readonly displayName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly individualName: string | null;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly cpf: string | null;
  readonly cnpj: string | null;
  readonly avicExternalId: string | null;
  readonly roles: readonly RegistrationRole[];
  readonly tags: readonly RegistrationTag[];
  readonly phones: readonly RegistrationPhone[];
  readonly emails: readonly RegistrationEmail[];
  readonly relationships: readonly RegistrationRelationship[];
  readonly externalReferences: readonly {
    readonly id: string;
    readonly provider: string;
    readonly resourceType: string;
    readonly externalResourceId: string;
    readonly syncStatus: string | null;
    readonly lastSyncedAt: string | null;
  }[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RegistrationCatalog {
  readonly roles: readonly RegistrationRole[];
  readonly tags: readonly RegistrationTag[];
}

export interface RegistrationHistory {
  readonly id: string;
  readonly action: string;
  readonly actorName: string | null;
  readonly beforeSnapshot: Readonly<Record<string, unknown>> | null;
  readonly afterSnapshot: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export type RegistrationCandidateStatus =
  | 'imported'
  | 'processing'
  | 'insufficient-data'
  | 'ready-for-decision'
  | 'ambiguous'
  | 'in-review'
  | 'unidentified'
  | 'ignored'
  | 'approved'
  | 'promoted'
  | 'error';

export interface RegistrationCandidateSource {
  readonly id: string;
  readonly matchRule: string | null;
  readonly score: number | null;
  readonly evidence: string | null;
  readonly isPrimary: boolean;
  readonly externalRecord: {
    readonly id: string;
    readonly kind: 'pdf-customer' | 'whatsapp-contact';
    readonly sourceSheet: string;
    readonly sourceRow: number;
    readonly externalId: string;
    readonly rawPayload: Readonly<Record<string, unknown>>;
    readonly normalizedPayload: Readonly<Record<string, unknown>>;
    readonly technicalRecord: boolean;
  };
}

export interface RegistrationCandidate {
  readonly id: string;
  readonly batch: {
    readonly id: string;
    readonly fileName: string;
    readonly source: string;
    readonly createdAt: string;
  };
  readonly status: RegistrationCandidateStatus;
  readonly suggestedType: RegistrationType | null;
  readonly confirmedType: RegistrationType | null;
  readonly displayName: string | null;
  readonly normalizedName: string | null;
  readonly documentOriginal: string | null;
  readonly documentNormalized: string | null;
  readonly documentValid: boolean | null;
  readonly phoneOriginal: string | null;
  readonly phoneNormalized: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly confidence: number;
  readonly priority: number;
  readonly suggestedRoles: readonly unknown[];
  readonly evidence: readonly unknown[];
  readonly qualityIssues: readonly string[];
  readonly minimumDataComplete: boolean;
  readonly confirmedPayload: Readonly<Record<string, unknown>> | null;
  readonly whatsappConversationId: string | null;
  readonly reviewedAt: string | null;
  readonly promotedRegistration: {
    readonly id: string;
    readonly type: RegistrationType;
    readonly displayName: string;
  } | null;
  readonly promotedAt: string | null;
  readonly version: number;
  readonly sources: readonly RegistrationCandidateSource[];
  readonly decisions: readonly {
    readonly id: string;
    readonly action: string;
    readonly actorName: string;
    readonly note: string | null;
    readonly createdAt: string;
  }[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RegistrationImportBatch {
  readonly id: string;
  readonly fileName: string;
  readonly fileSha256: string;
  readonly source: string;
  readonly status: 'processing' | 'completed' | 'completed-with-errors' | 'failed';
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly counts: Readonly<Record<string, unknown>>;
  readonly totalRows: number;
  readonly importedRows: number;
  readonly duplicateRows: number;
  readonly ignoredRows: number;
  readonly errorRows: number;
  readonly errorMessage: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RegistrationList<T> {
  readonly items: readonly T[];
  readonly total: number;
}
