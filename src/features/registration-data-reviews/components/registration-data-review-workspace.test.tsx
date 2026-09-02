import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { decideRegistrationDataReviewAction } from '../actions';
import type { RegistrationDataReview } from '../domain';
import { RegistrationDataReviewWorkspace } from './registration-data-review-workspace';

jest.mock('../actions', () => ({
  decideRegistrationDataReviewAction: jest.fn(),
  loadRegistrationDataReviewsAction: jest.fn(),
}));

const review: RegistrationDataReview = {
  id: '00000000-0000-4000-8000-000000000201',
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

describe('RegistrationDataReviewWorkspace', () => {
  afterEach(() => jest.clearAllMocks());

  it('filters immediately and requires a reason for rejection', async () => {
    const user = userEvent.setup();
    jest.mocked(decideRegistrationDataReviewAction).mockResolvedValue({
      success: true,
      message: 'Alteração rejeitada com auditoria.',
      reviews: [{ ...review, status: 'rejected', reviewReason: 'Sem evidência' }],
    });
    render(<RegistrationDataReviewWorkspace initialReviews={[review]} initialError="" />);

    expect(screen.getByText('Lume antiga')).toBeInTheDocument();
    expect(screen.getByText('Lume Transportes')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar revisões'), 'inexistente');
    expect(screen.getByText('Fila vazia')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar revisões'));
    await user.click(screen.getByRole('button', { name: 'Rejeitar' }));
    expect(screen.getByLabelText('Motivo')).toBeRequired();
    await user.type(screen.getByLabelText('Motivo'), 'Sem evidência');
    await user.click(screen.getByRole('button', { name: 'Confirmar rejeição' }));

    await waitFor(() =>
      expect(decideRegistrationDataReviewAction).toHaveBeenCalledWith({
        reviewId: review.id,
        commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
        decision: 'rejected',
        reason: 'Sem evidência',
      }),
    );
  });
});
