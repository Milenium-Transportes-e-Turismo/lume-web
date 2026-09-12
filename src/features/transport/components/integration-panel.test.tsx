import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntegrationPanel } from './integration-panel';

const settings = {
  externalIdField: '',
  sourceUtcOffset: '',
  scheduleTime: '16:00',
  timezone: 'America/Sao_Paulo',
  lookbackDays: 7,
  maxTripKm: null,
  maxGapKm: null,
  sequenceComplete: false,
};
const configuration = {
  id: 'integration',
  version: 1,
  enabled: false,
  configured: false,
  activationRequirements: ['Confirmar o fuso da origem'],
  settings,
};
const originalFetch = global.fetch;
let requests: jest.Mock;
beforeEach(() => {
  requests = jest.fn(async () => ({ ok: true, status: 200, json: async () => configuration }));
  global.fetch = requests;
});
afterEach(() => {
  global.fetch = originalFetch;
});

it('shows an example without selecting a source timezone or enabling integration', async () => {
  render(<IntegrationPanel canManage />);
  expect(await screen.findByLabelText('Fuso confirmado dos horários de origem')).toHaveValue('');
  expect(screen.getByPlaceholderText('Ex.: -03:00')).toBeInTheDocument();
  expect(screen.getByLabelText('Habilitar integração')).not.toBeChecked();
});
it.each(['+HH:MM', 'America/Sao_Paulo', '-3:00', '+15:00', '-03:60'])(
  'rejects %s before sending the configuration and allows correcting it',
  async (invalid) => {
    render(<IntegrationPanel canManage />);
    const input = await screen.findByLabelText('Fuso confirmado dos horários de origem');
    fireEvent.input(input, { target: { value: invalid } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe o fuso confirmado pela Avic',
    );
    expect(requests.mock.calls.some((args) => args[1]?.method === 'PATCH')).toBe(false);
    fireEvent.input(input, { target: { value: '-03:00' } });
    expect(input).toBeValid();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    await waitFor(() =>
      expect(requests.mock.calls.some((args) => args[1]?.method === 'PATCH')).toBe(true),
    );
    const call = requests.mock.calls.find((args) => args[1]?.method === 'PATCH')!;
    expect(JSON.parse(call[1].body)).toMatchObject({
      enabled: false,
      expectedVersion: 1,
      settings: { sourceUtcOffset: '-03:00', sequenceComplete: false },
    });
  },
);
it.each(['', '+00:00', '+05:30', '-03:00'])(
  'accepts the optional offset %s without inventing readiness',
  async (offset) => {
    render(<IntegrationPanel canManage />);
    const input = await screen.findByLabelText('Fuso confirmado dos horários de origem');
    fireEvent.input(input, { target: { value: offset } });
    expect(input).toBeValid();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    await waitFor(() =>
      expect(requests.mock.calls.some((args) => args[1]?.method === 'PATCH')).toBe(true),
    );
    const call = requests.mock.calls.find((args) => args[1]?.method === 'PATCH')!;
    expect(JSON.parse(call[1].body)).toMatchObject({
      enabled: false,
      settings: { sourceUtcOffset: offset },
    });
  },
);
