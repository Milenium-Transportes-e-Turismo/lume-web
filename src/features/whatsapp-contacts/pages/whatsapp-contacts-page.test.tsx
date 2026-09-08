import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WhatsAppContactsPage } from './whatsapp-contacts-page';

describe('approved contacts export page', () => {
  const preview = {
    total: 1,
    batch: 1,
    batchSize: 3000,
    totalBatches: 1,
    contacts: [
      {
        id: 'contact',
        name: 'José da Silva',
        phones: ['+5534999990000'],
        emails: ['jose@example.com'],
      },
    ],
  };
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(Response.json(preview));
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows canonical contact preview and export, without import or contact mutation controls', async () => {
    render(<WhatsAppContactsPage canExport />);
    expect(await screen.findByText('José da Silva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar para Google Contacts' })).toBeEnabled();
    expect(screen.queryByText('Importar CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Novo contato')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastro' })).toHaveAttribute(
      'href',
      '/registrations',
    );
  });

  it('disables export without file access or without approved registrations', async () => {
    render(<WhatsAppContactsPage canExport={false} />);
    await screen.findByText('José da Silva');
    expect(screen.getByRole('button', { name: 'Exportar para Google Contacts' })).toBeDisabled();
  });

  it('does not claim download success after an API failure', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(Response.json(preview))
      .mockResolvedValueOnce(
        Response.json({ message: 'Exportação indisponível.' }, { status: 503 }),
      );
    render(<WhatsAppContactsPage canExport />);
    await screen.findByText('José da Silva');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar para Google Contacts' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Exportação indisponível.'),
    );
    expect(screen.queryByText(/Arquivo baixado/)).not.toBeInTheDocument();
  });
});
