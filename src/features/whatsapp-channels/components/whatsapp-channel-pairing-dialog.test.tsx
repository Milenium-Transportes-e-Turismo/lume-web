import { act, fireEvent, render, screen } from '@testing-library/react';
import { WhatsAppChannelPairingDialog } from './whatsapp-channel-pairing-dialog';
import { executeWhatsAppChannelAction, loadWhatsAppChannelPairingAction } from '../actions';

jest.mock('../actions', () => ({
  executeWhatsAppChannelAction: jest.fn(),
  loadWhatsAppChannelPairingAction: jest.fn(),
}));
const load = jest.mocked(loadWhatsAppChannelPairingAction);
const execute = jest.mocked(executeWhatsAppChannelAction);
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());
const qr = { code: 'old', base64: 'YWJj' };
it('replaces stale QR images, hides them on failure and stops polling after closing', async () => {
  const channel = { id: 'channel', version: 2 } as never;
  load
    .mockResolvedValueOnce({
      success: true,
      pairing: {
        channel,
        connectionStatus: 'connecting',
        qrCode: { code: 'new', base64: 'ZGVm' },
        providerIssue: null,
      },
    })
    .mockResolvedValueOnce({
      success: false,
      message: 'Provedor indisponível',
      publicCode: 'UNAVAILABLE',
    });
  const view = render(
    <WhatsAppChannelPairingDialog
      channelId="channel"
      initialQrCode={qr}
      onClose={jest.fn()}
      onConnected={jest.fn()}
    />,
  );
  expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,YWJj');
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,ZGVm');
  await act(async () => {
    jest.advanceTimersByTime(8000);
  });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Atualizar código' })).toBeInTheDocument();
  view.unmount();
  await act(async () => {
    jest.advanceTimersByTime(240000);
  });
  expect(load).toHaveBeenCalledTimes(2);
});
it('confirms the authoritative channel after the provider reports connected', async () => {
  const channel = { id: 'channel', version: 4, connectionStatus: 'connected' } as never;
  load.mockResolvedValue({
    success: true,
    pairing: { channel, connectionStatus: 'connected', qrCode: null, providerIssue: null },
  });
  execute.mockResolvedValue({
    success: true,
    message: 'Conectado',
    operation: { channel, qrCode: null, providerIssue: null, infrastructureCleanupPending: false },
  });
  const connected = jest.fn();
  render(
    <WhatsAppChannelPairingDialog
      channelId="channel"
      initialQrCode={qr}
      onClose={jest.fn()}
      onConnected={connected}
    />,
  );
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(execute).toHaveBeenCalledWith(
    expect.objectContaining({ expectedVersion: 4, action: 'synchronize-connection' }),
  );
  expect(connected).toHaveBeenCalledWith(channel);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('clears an expired QR and allows a new attempt', async () => {
  const channel = { id: 'channel', version: 2 } as never;
  load.mockResolvedValue({
    success: true,
    pairing: { channel, connectionStatus: 'connecting', qrCode: qr, providerIssue: null },
  });
  render(
    <WhatsAppChannelPairingDialog
      channelId="channel"
      initialQrCode={qr}
      onClose={jest.fn()}
      onConnected={jest.fn()}
    />,
  );
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  jest.setSystemTime(Date.now() + 180000);
  await act(async () => {
    jest.advanceTimersByTime(8000);
  });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar código' }));
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(screen.getByRole('img')).toBeInTheDocument();
});
