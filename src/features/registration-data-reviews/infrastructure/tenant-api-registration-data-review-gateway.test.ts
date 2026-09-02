/** @jest-environment node */

import { TenantApiRegistrationDataReviewGateway } from './tenant-api-registration-data-review-gateway';

const reviewId = '00000000-0000-4000-8000-000000000201';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const review = {
  id: reviewId,
  registrationId: '00000000-0000-4000-8000-000000000202',
  whatsappContactId: null,
  serviceSessionId: '00000000-0000-4000-8000-000000000203',
  agentExecutionId: '00000000-0000-4000-8000-000000000204',
  field: 'legalName',
  currentValue: 'Lume antiga',
  proposedValue: 'Lume Transportes',
  source: 'whatsapp',
  status: 'pending',
  reviewedByUserId: null,
  reviewedAt: null,
  reviewReason: null,
  createdAt: '2026-08-29T10:00:00.000Z',
  updatedAt: '2026-08-29T10:00:00.000Z',
};

describe('TenantApiRegistrationDataReviewGateway', () => {
  it('uses the exact status query and decision route', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse([review]))
      .mockResolvedValueOnce(
        jsonResponse({
          reviewId,
          registrationId: review.registrationId,
          status: 'rejected',
          reviewedByUserId: '00000000-0000-4000-8000-000000000205',
          reviewedAt: '2026-08-29T10:05:00.000Z',
        }),
      );
    const gateway = new TenantApiRegistrationDataReviewGateway(
      'https://tenant.example/api/v1/',
      'access-token',
      fetcher,
    );
    const decision = {
      commandId: '00000000-0000-4000-8000-000000000206',
      decision: 'rejected' as const,
      reason: 'Dado sem comprovação.',
    };

    await gateway.list('pending');
    await gateway.decide(reviewId, decision);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://tenant.example/api/v1/registration-data-reviews?status=pending',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `https://tenant.example/api/v1/registration-data-reviews/${reviewId}/decision`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(decision) }),
    );
  });
});
