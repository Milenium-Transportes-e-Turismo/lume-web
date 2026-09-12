import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TripPanel } from './trip-panel';

const issue = {
  id: 'issue-1',
  version: 1,
  recordId: 'record-1',
  vehicleExternalId: '6',
  code: 'ODOMETER_GAP',
  status: 'OPEN',
  verificationState: 'UNAVAILABLE',
  context: { previousEndKm: '638612', startKm: '638700', gapKm: '88' },
  guidance: 'Corrija na Avic e aguarde a verificação.',
  detectedAt: '2026-07-31T12:00:00Z',
  lastVerifiedAt: null,
  history: [],
};
let mockFetch: jest.Mock;
beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;
  Object.defineProperty(global.crypto, 'randomUUID', {
    configurable: true,
    value: jest
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValue('22222222-2222-4222-8222-222222222222'),
  });
});
function reply(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

it('retains unavailable verification and never offers KM editing or manual resolution', async () => {
  mockFetch.mockResolvedValue(reply({ items: [issue], nextCursor: null }));
  render(<TripPanel resource="issues" canManage />);
  expect(await screen.findByText('Verificação indisponível')).toBeInTheDocument();
  expect(screen.getByText(/Corrija a quilometragem somente na Avic/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /resolver|corrigir km/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
});

it('reuses commandId after uncertain failure and preserves the users justification', async () => {
  let attempts = 0;
  mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      attempts++;
      return attempts === 1
        ? reply({ message: 'Indisponível', code: 'RETRY_LATER' }, 503)
        : reply({ ...issue, version: 2 });
    }
    if (path.includes('/issues/issue-1')) return reply(issue);
    return reply({ items: [issue], nextCursor: null });
  });
  render(<TripPanel resource="issues" canManage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ver contexto e histórico' }));
  const textarea = await screen.findByRole('textbox', { name: 'Justificativa no Lume' });
  fireEvent.change(textarea, { target: { value: 'Conferência solicitada na origem.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar justificativa' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('RETRY_LATER');
  expect(textarea).toHaveValue('Conferência solicitada na origem.');
  fireEvent.click(screen.getByRole('button', { name: 'Registrar justificativa' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Justificativa confirmada'),
  );
  const writes = mockFetch.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(init.body));
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0]).toMatchObject({
    expectedVersion: 1,
    text: 'Conferência solicitada na origem.',
  });
});

it('reloads a conflicting issue and requires a new command with the authoritative version', async () => {
  let attempts = 0;
  mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      attempts++;
      return attempts === 1
        ? reply({ message: 'Atualizado por outro usuário', code: 'VERSION_CONFLICT' }, 409)
        : reply({ ...issue, version: 3 });
    }
    if (path.includes('/issues/issue-1')) return reply({ ...issue, version: attempts ? 2 : 1 });
    return reply({ items: [issue], nextCursor: null });
  });
  render(<TripPanel resource="issues" canManage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ver contexto e histórico' }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Justificativa no Lume' }), {
    target: { value: 'Aguardando Avic.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar justificativa' }));
  await screen.findByText(/VERSION_CONFLICT/);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Registrar justificativa' })).not.toBeDisabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Registrar justificativa' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Justificativa confirmada'),
  );
  const writes = mockFetch.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(init.body));
  expect(writes.map((body) => body.expectedVersion)).toEqual([1, 2]);
  expect(writes[0].commandId).not.toEqual(writes[1].commandId);
});
