import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { RegistrationGateway } from '../application';
import { executeAuthenticatedRegistrationMutation } from '../server';
import { promoteRegistrationCandidateAction } from './registration-actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('../server', () => ({
  executeAuthenticatedRegistrationMutation: jest.fn(),
}));

describe('registration actions', () => {
  const promoteCandidate = jest.fn();
  const redirectSignal = new Error('NEXT_REDIRECT');

  beforeEach(() => {
    jest.clearAllMocks();
    promoteCandidate.mockResolvedValue({
      promotedRegistration: {
        id: 'registration-1',
        type: 'pj',
        displayName: 'Empresa Exemplo',
      },
    });
    jest
      .mocked(executeAuthenticatedRegistrationMutation)
      .mockImplementation(async (operation) =>
        operation({ promoteCandidate } as unknown as RegistrationGateway),
      );
    jest.mocked(redirect).mockImplementation(() => {
      throw redirectSignal;
    });
  });

  it('does not convert the successful promotion redirect into an error redirect', async () => {
    const data = new FormData();
    data.set('candidateId', 'candidate-1');
    data.set('expectedVersion', '3');

    await expect(promoteRegistrationCandidateAction(data)).rejects.toBe(redirectSignal);

    expect(promoteCandidate).toHaveBeenCalledWith('candidate-1', 3);
    expect(revalidatePath).toHaveBeenCalledWith('/registration-reconciliation');
    expect(revalidatePath).toHaveBeenCalledWith('/registrations');
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(
      `/registrations/registration-1?success=${encodeURIComponent(
        'Candidato promovido ao Cadastro oficial.',
      )}`,
    );
  });
});
