import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CatalogPanel } from './catalog-panel';
import { ExistingContractPicker } from './existing-contract-picker';

const profile = '11111111-1111-4111-8111-111111111111';
let requests: jest.Mock;
function reply(value: unknown) {
  return { ok: true, status: 200, json: async () => value };
}
beforeEach(() => {
  requests = jest.fn().mockResolvedValue(reply({ items: [], total: 0 }));
  global.fetch = requests;
  Object.defineProperty(global.crypto, 'randomUUID', {
    configurable: true,
    value: () => '22222222-2222-4222-8222-222222222222',
  });
});

it.each(['affiliations', 'contracts'] as const)(
  'binds new %s to the profile without a person selector',
  async (resource) => {
    render(
      <CatalogPanel
        resource={resource}
        registrationId={profile}
        canCreate
        canUpdate
        canDeactivate={false}
      />,
    );
    await waitFor(() =>
      expect(requests).toHaveBeenCalledWith(
        expect.stringContaining('registrationId=' + profile),
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Novo cadastro' }));
    const form = screen.getByRole('form', { name: 'Criar cadastro' });
    const identity = resource === 'affiliations' ? 'registrationId' : 'clientRegistrationId';
    expect(form.querySelector('[name="' + identity + '"]')).toBeNull();
    fireEvent.submit(form);
    await waitFor(() =>
      expect(requests.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
    const [, init] = requests.mock.calls.find(([, options]) => options?.method === 'POST')!;
    expect(JSON.parse(init.body)).toMatchObject({ [identity]: profile, expectedVersion: 0 });
  },
);

it('retains the profile filter during search and pagination', async () => {
  requests.mockResolvedValue(
    reply({
      items: [{ id: 'one', version: 1, registrationId: profile, role: 'client' }],
      total: 26,
    }),
  );
  render(
    <CatalogPanel
      resource="affiliations"
      registrationId={profile}
      canCreate={false}
      canUpdate={false}
      canDeactivate={false}
    />,
  );
  await screen.findByText('Página 1 · 26 registros');
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await waitFor(() =>
    expect(
      requests.mock.calls.some(
        ([path]) => path.includes('page=2') && path.includes('registrationId=' + profile),
      ),
    ).toBe(true),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar cadastros' }), {
    target: { value: 'Empresa' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() =>
    expect(
      requests.mock.calls.some(
        ([path]) =>
          path.includes('page=1') &&
          path.includes('search=Empresa') &&
          path.includes('registrationId=' + profile),
      ),
    ).toBe(true),
  );
});

it('does not show records when the server ignores the profile filter', async () => {
  requests.mockResolvedValue(
    reply({
      items: [
        {
          id: 'wrong',
          version: 1,
          clientRegistrationId: 'another',
          name: 'Contrato de outro cliente',
        },
      ],
      total: 1,
    }),
  );
  render(
    <CatalogPanel
      resource="contracts"
      registrationId={profile}
      canCreate={false}
      canUpdate={false}
      canDeactivate={false}
    />,
  );
  await screen.findByRole('alert');
  expect(screen.queryByText('Contrato de outro cliente')).not.toBeInTheDocument();
});

it('scopes existing contract selection to the same client', async () => {
  render(
    <ExistingContractPicker registrationId={profile} selected={null} onSelected={jest.fn()} />,
  );
  await waitFor(() =>
    expect(requests).toHaveBeenCalledWith(
      expect.stringContaining('contracts/candidates?search=&page=1&registrationId=' + profile),
      expect.anything(),
    ),
  );
});

it('cannot expose another clients contract as a reuse candidate', async () => {
  requests.mockResolvedValue(
    reply({
      items: [{ id: 'wrong', clientRegistrationId: 'another', name: 'Contrato alheio' }],
      total: 1,
    }),
  );
  render(
    <ExistingContractPicker registrationId={profile} selected={null} onSelected={jest.fn()} />,
  );
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Reutilizar' })).not.toBeInTheDocument();
});
