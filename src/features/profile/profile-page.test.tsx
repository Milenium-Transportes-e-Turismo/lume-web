import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { toast } from '@/shared/ui/toast';

import { changeOwnPasswordAction } from './profile-actions';
import { ProfilePage } from './profile-page';

const routerPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

jest.mock('./profile-actions', () => ({
  changeOwnPasswordAction: jest.fn(),
  updateProfilePictureAction: jest.fn(),
}));

describe('ProfilePage', () => {
  it('documents the accepted picture formats, dimensions and size', () => {
    render(
      <ProfilePage
        profile={{
          id: 'user-001',
          name: 'Taiane Karine',
          username: 'taiane.karine',
          email: 'taiane@example.com',
          profilePictureDataUrl: null,
        }}
      />,
    );

    const pictureAction = screen.getByRole('button', { name: 'Escolher foto' });
    expect(pictureAction.tagName).toBe('LABEL');
    expect(pictureAction).toHaveAttribute('for', 'profile-picture');
    expect(screen.getByLabelText('Escolher foto')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp',
    );
    expect(
      screen.getByText(
        'JPEG, PNG ou WebP. Dimensões entre 128 × 128 e 2048 × 2048 pixels. Tamanho máximo de 512 KB.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the public error code in a failed profile action toast', async () => {
    const interaction = userEvent.setup();
    const toastAdd = jest.spyOn(toast, 'add');
    jest.mocked(changeOwnPasswordAction).mockResolvedValueOnce({
      success: false,
      message: 'Não foi possível alterar a senha.',
      errorCode: 'VALIDATION_ERROR',
    });
    render(
      <ProfilePage
        profile={{
          id: 'user-001',
          name: 'Taiane Karine',
          username: 'taiane.karine',
          email: 'taiane@example.com',
          profilePictureDataUrl: null,
        }}
      />,
    );

    await interaction.type(screen.getByLabelText('Senha atual'), 'SenhaAtual@2026');
    await interaction.type(screen.getByLabelText('Nova senha'), 'NovaSenha@2026');
    await interaction.type(screen.getByLabelText('Confirmar nova senha'), 'NovaSenha@2026');
    await interaction.click(screen.getByRole('button', { name: 'Alterar senha' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Não foi possível alterar a senha.',
          type: 'error',
        }),
      ),
    );
    toastAdd.mockRestore();
  });
});
