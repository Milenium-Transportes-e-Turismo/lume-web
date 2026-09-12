import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CommandForm, CompleteLookup } from './transport-ui';
import { fieldsFor } from './catalog-config';

describe('fleet form and generated catalog codes', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it('loads all fleet selector pages without separate searches or pagination buttons', async () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({
      id: String(i + 1),
      name: 'Tipo ' + (i + 1),
      version: 1,
    }));
    global.fetch = jest.fn(async (url) => ({
      ok: true,
      json: async () => ({
        items: String(url).includes('page=2') ? rows.slice(25) : rows.slice(0, 25),
        total: 26,
      }),
    })) as jest.Mock;
    render(
      <CompleteLookup
        field={{ name: 'categoryId', label: 'Categoria', lookup: 'catalogs?kind=category' }}
        value=""
      />,
    );
    expect(await screen.findByRole('option', { name: 'Tipo 26' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '26' } });
    expect(screen.getByRole('combobox')).toHaveValue('26');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
  it('keeps the fleet number and selectors without asking for integration fields', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    })) as jest.Mock;
    render(<CommandForm fields={fieldsFor('fleet')} path="fleet" onSaved={jest.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Frota *' })).toBeRequired();
    expect(
      screen.getByRole('combobox', { name: 'Empresa prestadora (nome fantasia)' }),
    ).toBeRequired();
    expect(screen.queryByText('Origem do vínculo externo')).not.toBeInTheDocument();
    expect(screen.queryByText('ID confirmado do veículo na origem')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Nome ou documento')).not.toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
  });
  it('does not ask a user to assign a catalog code', () => {
    render(<CommandForm fields={fieldsFor('catalogs')} path="catalogs" onSaved={jest.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Nome *' })).toBeRequired();
    expect(screen.queryByRole('textbox', { name: /Código/ })).not.toBeInTheDocument();
  });
});
