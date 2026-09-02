export const CUSTOMER_PROFILE_KEYS = [
  'proposal-delivery-preference',
  'preferred-contact-channel',
  'accessibility-need',
  'language',
  'service-preference',
  'communication-style',
  'travel-preference',
  'billing-preference',
  'other-confirmed-preference',
] as const;

export type CustomerProfileKey = (typeof CUSTOMER_PROFILE_KEYS)[number];
export type CustomerProfileSuggestionStatus = 'pending' | 'approved' | 'ignored';
export type CustomerContextDetailSection =
  'relationships' | 'profile' | 'services' | 'quotes' | 'pending';

export interface CustomerContextSummary {
  readonly serviceSessionId: string;
  readonly whatsappContactId: string;
  readonly identity: {
    readonly registrationId: string;
    readonly kind: 'personal' | 'company';
    readonly displayName: string;
    readonly confirmedAt: string;
  } | null;
  readonly relatedCompanies: readonly {
    readonly registrationId: string;
    readonly displayName: string;
    readonly relationshipType: string;
    readonly jobTitle: string | null;
    readonly department: string | null;
  }[];
  readonly approvedProfile: readonly {
    readonly suggestionId: string;
    readonly key: CustomerProfileKey;
    readonly value: string;
    readonly approvedAt: string;
  }[];
  readonly recentServices: readonly {
    readonly serviceSessionId: string;
    readonly status: string;
    readonly controlMode: string;
    readonly departmentId: string | null;
    readonly priority: string;
    readonly pendingActionCount: number;
    readonly updatedAt: string;
  }[];
  readonly recentQuotes: readonly {
    readonly quoteRequestId: string;
    readonly status: string;
    readonly serviceType: string | null;
    readonly origin: string | null;
    readonly destination: string | null;
    readonly departureDate: string | null;
    readonly updatedAt: string;
  }[];
  readonly pending: readonly {
    readonly kind: 'service' | 'quote' | 'case';
    readonly id: string;
    readonly status: string;
    readonly updatedAt: string;
  }[];
  readonly limits: {
    readonly relatedCompanies: number;
    readonly approvedProfile: number;
    readonly recentServices: number;
    readonly recentQuotes: number;
    readonly pending: number;
  };
}

export interface CustomerContextDetailPage {
  readonly section: CustomerContextDetailSection;
  readonly items: readonly unknown[];
  readonly limit: number;
  readonly hasMore: boolean;
}

export interface CustomerProfileSuggestion {
  readonly id: string;
  readonly whatsappContactId: string;
  readonly registrationId: string | null;
  readonly serviceSessionId: string | null;
  readonly agentExecutionId: string | null;
  readonly profileKey: CustomerProfileKey;
  readonly suggestedValue: string;
  readonly rationale: string | null;
  readonly origin: unknown;
  readonly status: CustomerProfileSuggestionStatus;
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: string | null;
  readonly reviewReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const SENSITIVE_KEY = /(?:api[-_]?key|authorization|credential|password|prompt|secret|token)/iu;

export function sanitizeCustomerContextValue(value: unknown, depth = 0): unknown {
  if (depth >= 6) return '[conteúdo aninhado omitido]';
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeCustomerContextValue(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, item]) => [key, sanitizeCustomerContextValue(item, depth + 1)]),
    );
  }
  return value;
}
