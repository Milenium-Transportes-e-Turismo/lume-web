import type {
  RegistrationDataReview,
  RegistrationDataReviewDecision,
  RegistrationDataReviewStatus,
} from '../domain';

export type RegistrationDataReviewGatewayErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class RegistrationDataReviewGatewayError extends Error {
  constructor(
    readonly code: RegistrationDataReviewGatewayErrorCode,
    message: string,
    readonly publicCode: string,
  ) {
    super(message);
    this.name = 'RegistrationDataReviewGatewayError';
  }
}

export interface RegistrationDataReviewGateway {
  list(status?: RegistrationDataReviewStatus): Promise<readonly RegistrationDataReview[]>;
  decide(
    reviewId: string,
    input: {
      readonly commandId: string;
      readonly decision: 'approved' | 'rejected';
      readonly reason?: string;
    },
  ): Promise<RegistrationDataReviewDecision>;
}
