import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegistrationForm } from './registration-form';
jest.mock('../actions/registration-actions', () => ({
  createRegistrationTagAction: jest.fn().mockResolvedValue({
    success: true,
    tag: { id: 'new', name: 'Prioridade', code: 'prioridade', color: null, active: true },
  }),
}));
const catalog = {
  roles: [
    { id: 'client', code: 'client', name: 'Cliente', isSystem: true },
    { id: 'driver-role', code: 'driver', name: 'Motorista', isSystem: true, active: false },
  ],
  tags: [
    { id: 'driver-tag', code: 'driver', name: 'Motorista', color: null, active: true },
    { id: 'finance', code: 'financial', name: 'Financeiro', color: null, active: true },
  ],
};
beforeAll(() => {
  window.PointerEvent ??= MouseEvent as typeof PointerEvent;
});

it('starts without a role and preserves selected tags while filtering', () => {
  const view = render(<RegistrationForm action={jest.fn()} catalog={catalog} canManageTags />);
  const form = view.container.querySelector('form')!;
  expect(new FormData(form).getAll('roleCodes')).toEqual([]);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Motorista' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pesquisar Marcadores' }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar Marcadores' }), {
    target: { value: 'Financeiro' },
  });
  expect(screen.queryByRole('checkbox', { name: 'Motorista' })).not.toBeInTheDocument();
  expect(new FormData(form).getAll('tagCodes')).toEqual(['driver']);
});

it('creates a tag in the dialog and selects it in the current registration', async () => {
  const view = render(<RegistrationForm action={jest.fn()} catalog={catalog} canManageTags />);
  fireEvent.click(screen.getByRole('button', { name: 'Criar marcador' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Nome do marcador' }), {
    target: { value: 'Prioridade' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar marcador' }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Prioridade' })).toBeChecked());
  expect(new FormData(view.container.querySelector('form')!).getAll('tagCodes')).toContain(
    'prioridade',
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
