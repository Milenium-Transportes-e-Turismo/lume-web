import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RegistrationForm } from './registration-form';

const catalog = {
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
  it('renders only the fields that belong to the selected identity type', () => {
    const { rerender } = render(
      <RegistrationForm action={jest.fn()} catalog={catalog} initialValues={{ type: 'pf' }} />,
    );

    expect(screen.getByLabelText('Nome')).toBeRequired();
    expect(screen.getByLabelText('CPF')).toBeInTheDocument();
    expect(screen.queryByLabelText('Razão social')).not.toBeInTheDocument();

    rerender(
      <RegistrationForm
        key="pj"
        action={jest.fn()}
        catalog={catalog}
        initialValues={{ type: 'pj' }}
      />,
    );

    expect(screen.getByLabelText('Razão social')).toBeRequired();
    expect(screen.getByLabelText('CNPJ')).toBeRequired();
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument();
  });

  it('adds multiple contacts and searches configurable markers', async () => {
    const user = userEvent.setup();
    render(<RegistrationForm action={jest.fn()} catalog={catalog} />);

    await user.click(screen.getByRole('button', { name: 'Incluir primeiro telefone' }));
    expect(screen.getByLabelText('Número')).toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Adicionar telefone' }));
    expect(screen.getAllByLabelText('Número')).toHaveLength(2);

    await user.type(screen.getByLabelText('Pesquisar Marcadores'), 'opera');
    expect(screen.getByText('Operacional')).toBeInTheDocument();
    expect(screen.queryByText('Comercial')).not.toBeInTheDocument();
  });
});
