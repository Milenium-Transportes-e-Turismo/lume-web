import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  executeWhatsAppChannelAction,
  loadWhatsAppChannelsAction,
  updateWhatsAppChannelAction,
} from '../actions';
import type { ManagedWhatsAppChannel } from '../domain';
import { WhatsAppChannelManagement } from './whatsapp-channel-management';

jest.mock('../actions', () => ({
  createWhatsAppChannelAction: jest.fn(),
  executeWhatsAppChannelAction: jest.fn(),
  loadWhatsAppChannelsAction: jest.fn(),
  updateWhatsAppChannelAction: jest.fn(),
}));

beforeAll(() => {
  window.PointerEvent ??= MouseEvent as typeof PointerEvent;
});

const mockedExecute = jest.mocked(executeWhatsAppChannelAction);
const mockedLoad = jest.mocked(loadWhatsAppChannelsAction);

const channel: ManagedWhatsAppChannel = {
  id: '00000000-0000-4000-8000-000000000101',
  companyId: '00000000-0000-4000-8000-000000000201',
  providerId: 'evolution',
  displayName: 'WhatsApp Matriz',
  phoneNumber: '5534999990000',
  evolutionInstanceName: 'lume-matriz-1',
  evolutionInstanceId: 'instance-provider-1',
  departmentId: null,
  routingMode: 'general-triage',
  organizationalStatus: 'active',
  connectionStatus: 'connected',
  allowedAutomaticTargetDepartmentIds: [],
  version: 3,
  createdAt: '2026-08-29T10:00:00.000Z',
  updatedAt: '2026-08-29T10:10:00.000Z',
};

const allPermissions = {
  canView: true,
  canCreate: true,
  canManage: true,
  canConnect: true,
  canDisconnect: true,
  isAdministrator: true,
};

describe('WhatsAppChannelManagement', () => {
  beforeEach(() => {
    mockedLoad.mockResolvedValue({ success: true, channels: [channel] });
    mockedExecute.mockResolvedValue({
      success: true,
      message: 'Ação concluída no canal.',
      operation: {
        channel: { ...channel, version: 4 },
        qrCode: null,
        providerIssue: null,
        infrastructureCleanupPending: false,
      },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('keeps organizational and connection states distinct and filters immediately', async () => {
    const user = userEvent.setup();
    render(<WhatsAppChannelManagement initialChannels={[channel]} permissions={allPermissions} />);

    expect(screen.getAllByText('Ativo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Conectado').length).toBeGreaterThan(0);
    await user.type(screen.getByRole('searchbox'), 'inexistente');
    expect(screen.getByText('Nenhum canal encontrado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Filtrar/iu })).not.toBeInTheDocument();
  });

  it('sends commandId and the selected authoritative version for connection actions', async () => {
    const user = userEvent.setup();
    render(<WhatsAppChannelManagement initialChannels={[channel]} permissions={allPermissions} />);

    await user.click(screen.getByRole('button', { name: 'Sincronizar' }));

    await waitFor(() =>
      expect(mockedExecute).toHaveBeenCalledWith({
        channelId: channel.id,
        action: 'synchronize-connection',
        commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
        expectedVersion: 3,
      }),
    );
    expect(await screen.findByText('Ação concluída no canal.')).toBeInTheDocument();
  });

  it('does not render mutating controls for a read-only operator', () => {
    render(
      <WhatsAppChannelManagement
        initialChannels={[channel]}
        permissions={{
          canView: true,
          canCreate: false,
          canManage: false,
          canConnect: false,
          canDisconnect: false,
          isAdministrator: false,
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Provisionar canal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar QR' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar configuração' })).not.toBeInTheDocument();
  });

  it('shows initial loading failure without inventing a channel', () => {
    render(
      <WhatsAppChannelManagement
        initialChannels={[]}
        initialError="Tenant API indisponível."
        permissions={allPermissions}
      />,
    );

    expect(screen.getByText('Tenant API indisponível.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum canal encontrado')).toBeInTheDocument();
  });
});

it('salva a preferência dos agentes com a versão atual do canal', async () => {
  const user = userEvent.setup();
  jest.mocked(updateWhatsAppChannelAction).mockResolvedValue({
    success: true,
    message: 'Configuração atualizada.',
    operation: {
      channel: { ...channel, agentsEnabled: false, version: 4 },
      qrCode: null,
      providerIssue: null,
      infrastructureCleanupPending: false,
    },
  });
  render(<WhatsAppChannelManagement initialChannels={[channel]} permissions={allPermissions} />);
  await user.click(screen.getByRole('button', { name: 'Editar configuração' }));
  const toggle = screen.getByRole('checkbox', { name: 'Agentes de IA habilitados' });
  expect(toggle).toBeChecked();
  await user.click(toggle);
  await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));
  await waitFor(() =>
    expect(updateWhatsAppChannelAction).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: channel.id, agentsEnabled: false, expectedVersion: 3 }),
    ),
  );
  expect(await screen.findByText('Desabilitados')).toBeInTheDocument();
});
