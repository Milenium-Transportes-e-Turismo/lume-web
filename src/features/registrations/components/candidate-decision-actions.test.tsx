import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CandidateDecisionActions, PromoteCandidateButton } from './candidate-decision-actions';

describe('Candidate decision safeguards', () => {
  it('keeps individual actions associated with the review form and confirms ignore', async () => {
    const user = userEvent.setup();
    render(
      <>
        <form id="candidate-review-form" />
        <CandidateDecisionActions formId="candidate-review-form" />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Não identificado' })).toHaveAttribute(
      'form',
      'candidate-review-form',
    );
    expect(screen.getByRole('button', { name: 'Aprovar candidato' })).toHaveAttribute(
      'form',
      'candidate-review-form',
    );

    await user.click(screen.getByRole('button', { name: 'Ignorar' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar e ignorar' })).toHaveAttribute(
      'form',
      'candidate-review-form',
    );
  });

  it('requires confirmation before submitting the promotion form', async () => {
    const user = userEvent.setup();
    render(
      <>
        <form id="candidate-promotion-form" />
        <PromoteCandidateButton formId="candidate-promotion-form" />
      </>,
    );

    expect(screen.queryByRole('button', { name: 'Confirmar promoção' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Promover Cadastro' }));
    expect(screen.getByRole('button', { name: 'Confirmar promoção' })).toHaveAttribute(
      'form',
      'candidate-promotion-form',
    );
  });
});
