import userEvent from '@testing-library/user-event';
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

const legacyCatalog = {
  roles: [
    { id: '4a98308b-f32b-42b6-8fb4-a6d6e9277d1e', code: 'client', name: 'Cliente', isSystem: true },
    {
      id: '70f34006-cd48-47f3-844d-abd424037fc6',
      code: 'driver',
      name: 'Motorista',
      isSystem: true,
    },
  ],
  tags: [
    {
      id: 'c23abf58-d45a-44c0-9c46-2bcfa3289dfe',
      code: 'commercial',
      name: 'Comercial',
      color: null,
    },
    {
      id: '2ab32e11-830d-4770-b0dc-5b5efc2301c7',
      code: 'operations',
      name: 'Operacional',
      color: null,
    },
  ],
} as const;

describe('RegistrationForm', () => {
  it('exibe situação, nomes e documento em formato amigável', () => {
    const { container } = render(
      <RegistrationForm
        action={jest.fn()}
        catalog={legacyCatalog}
        initialValues={{
          type: 'pf',
          status: 'inactive',
          firstName: 'MARIA',
          lastName: 'DOS SANTOS',
          cpf: '52998224725',
        }}
      />,
    );

    expect(screen.getByLabelText('Situação')).toHaveTextContent('Inativo');
    expect(screen.getByLabelText('Situação')).not.toHaveTextContent('inactive');
    expect(screen.getByLabelText('Nome')).toHaveValue('Maria');
    expect(screen.getByLabelText('Sobrenome')).toHaveValue('Dos Santos');
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25');
    expect(new FormData(container.querySelector('form')!).get('status')).toBe('inactive');
  });

  it('renders only the fields that belong to the selected identity type', () => {
    const { rerender } = render(
      <RegistrationForm
        action={jest.fn()}
        catalog={legacyCatalog}
        initialValues={{ type: 'pf' }}
      />,
    );

    expect(screen.getByLabelText('Nome')).toBeRequired();
    expect(screen.getByLabelText('CPF')).toBeInTheDocument();
    expect(screen.queryByLabelText('Razão social')).not.toBeInTheDocument();

    rerender(
      <RegistrationForm
        key="pj"
        action={jest.fn()}
        catalog={legacyCatalog}
        initialValues={{ type: 'pj' }}
      />,
    );

    expect(screen.getByLabelText('Razão social')).toBeRequired();
    expect(screen.getByLabelText('CNPJ')).toBeRequired();
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument();
  });

  it('adds multiple contacts and searches configurable markers', async () => {
    const user = userEvent.setup();
    render(<RegistrationForm action={jest.fn()} catalog={legacyCatalog} />);

    await user.click(screen.getByRole('button', { name: 'Incluir primeiro telefone' }));
    expect(screen.getByLabelText('Número')).toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Adicionar telefone' }));
    expect(screen.getAllByLabelText('Número')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Pesquisar Marcadores' }));
    await user.type(screen.getByRole('searchbox', { name: 'Pesquisar Marcadores' }), 'opera');
    expect(screen.getByText('Operacional')).toBeInTheDocument();
    expect(screen.queryByText('Comercial')).not.toBeInTheDocument();
  });
});
