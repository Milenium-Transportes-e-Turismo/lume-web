/** @jest-environment node */

import { TenantApiCustomerContextGateway } from './tenant-api-customer-context-gateway';

const sessionId = '00000000-0000-4000-8000-000000000101';
const contactId = '00000000-0000-4000-8000-000000000102';
const suggestionId = '00000000-0000-4000-8000-000000000103';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('TenantApiCustomerContextGateway', () => {
  it('loads summary and suggestions from the public session-scoped routes', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          serviceSessionId: sessionId,
          whatsappContactId: contactId,
          identity: null,
          relatedCompanies: [],
          approvedProfile: [],
          recentServices: [],
          recentQuotes: [],
          pending: [],
          limits: {
            relatedCompanies: 5,
            approvedProfile: 10,
            recentServices: 5,
            recentQuotes: 5,
            pending: 10,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: suggestionId,
            whatsappContactId: contactId,
            registrationId: null,
            serviceSessionId: sessionId,
            agentExecutionId: null,
            profileKey: 'language',
            suggestedValue: 'Português',
            rationale: 'Idioma observado.',
            origin: { messageId: 'safe', apiKey: 'must-not-cross' },
            status: 'pending',
            reviewedByUserId: null,
            reviewedAt: null,
            reviewReason: null,
            createdAt: '2026-08-29T10:00:00.000Z',
            updatedAt: '2026-08-29T10:00:00.000Z',
          },
        ]),
      );
    const gateway = new TenantApiCustomerContextGateway(
      'https://tenant.example/api/v1/',
      'access-token',
      fetcher,
    );

    await expect(gateway.getSummary(sessionId)).resolves.toMatchObject({
      serviceSessionId: sessionId,
    });
    const suggestions = await gateway.listSuggestions({ serviceSessionId: sessionId });
    expect(suggestions[0]?.origin).toEqual({ messageId: 'safe' });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `https://tenant.example/api/v1/customer-context/profile-suggestions?serviceSessionId=${sessionId}&limit=100`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('posts the audited decision contract without extra fields', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        suggestionId,
        status: 'approved',
        reviewedByUserId: '00000000-0000-4000-8000-000000000104',
        reviewedAt: '2026-08-29T11:00:00.000Z',
      }),
    );
    const gateway = new TenantApiCustomerContextGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    const input = {
      commandId: '00000000-0000-4000-8000-000000000105',
      expectedUpdatedAt: '2026-08-29T10:00:00.000Z',
      decision: 'approved' as const,
    };

    await gateway.decideSuggestion(suggestionId, input);
    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/customer-context/profile-suggestions/${suggestionId}/decision`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
});
