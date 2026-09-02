export const REGISTRATION_DATA_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RegistrationDataReviewStatus = (typeof REGISTRATION_DATA_REVIEW_STATUSES)[number];

export interface RegistrationDataReview {
  readonly id: string;
  readonly registrationId: string;
  readonly whatsappContactId: string | null;
  readonly serviceSessionId: string | null;
  readonly agentExecutionId: string | null;
  readonly field: string;
  readonly currentValue: unknown;
  readonly proposedValue: unknown;
  readonly source: 'whatsapp' | 'internal' | 'automation';
  readonly status: RegistrationDataReviewStatus;
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: string | null;
  readonly reviewReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RegistrationDataReviewDecision {
  readonly reviewId: string;
  readonly registrationId: string;
  readonly status: 'approved' | 'rejected';
  readonly reviewedByUserId: string;
  readonly reviewedAt: string;
  readonly idempotent?: boolean;
}
