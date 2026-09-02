import type {
  CustomerContextDetailPage,
  CustomerContextDetailSection,
  CustomerContextSummary,
  CustomerProfileSuggestion,
  CustomerProfileSuggestionStatus,
} from '../domain';

export type CustomerContextGatewayErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class CustomerContextGatewayError extends Error {
  constructor(
    readonly code: CustomerContextGatewayErrorCode,
    message: string,
    readonly publicCode: string,
  ) {
    super(message);
    this.name = 'CustomerContextGatewayError';
  }
}

export interface CustomerContextGateway {
  getSummary(serviceSessionId: string): Promise<CustomerContextSummary>;
  getDetails(
    serviceSessionId: string,
    section: CustomerContextDetailSection,
    limit?: number,
  ): Promise<CustomerContextDetailPage>;
  listSuggestions(input: {
    readonly serviceSessionId: string;
    readonly status?: CustomerProfileSuggestionStatus;
    readonly limit?: number;
  }): Promise<readonly CustomerProfileSuggestion[]>;
  decideSuggestion(
    suggestionId: string,
    input: {
      readonly commandId: string;
      readonly expectedUpdatedAt: string;
      readonly decision: 'approved' | 'ignored';
      readonly reason?: string;
    },
  ): Promise<{
    readonly suggestionId: string;
    readonly status: 'approved' | 'ignored';
    readonly reviewedByUserId: string;
    readonly reviewedAt: string;
    readonly idempotent?: boolean;
  }>;
}
