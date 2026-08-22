import { fireEvent, render, screen } from '@testing-library/react';

import { ContractCreationForm } from './contract-creation-form';

jest.mock('../actions', () => ({
  createRoutingContractAction: jest.fn(),
}));

const client = {
  id: '00000000-0000-4000-8000-000000000001',
  taxId: '11222333000181',
  legalName: 'Cliente de teste',
  tradeName: null,
  costCenter: null,
  clientType: 'pj' as const,
  avicExternalId: null,
  individualName: null,
  cpf: null,
  individualEmail: null,
  individualWhatsapp: null,
  individualPhones: [],
  cnpj: '11222333000181',
  legalEmail: null,
  legalWhatsapp: null,
  legalPhones: [],
  status: 'active' as const,
  version: 1,
  createdAt: '2026-08-21T12:00:00.000Z',
  updatedAt: '2026-08-21T12:00:00.000Z',
};

describe('ContractCreationForm', () => {
  it('supports several shifts and explains capacity per vehicle', () => {
    render(<ContractCreationForm companies={[client]} fixedPoints={[]} />);

    expect(screen.getByText('Turno 1')).toBeInTheDocument();
    expect(
      screen.getByText(/limite de colaboradores em cada veiculo deste turno/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /adicionar turno/i }));

    expect(screen.getByText('Turno 2')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/capacidade por veiculo neste turno/i)).toHaveLength(2);
  });

  it('shows required documents only for intermunicipal contracts', () => {
    render(<ContractCreationForm companies={[client]} fixedPoints={[]} />);

    expect(screen.queryByLabelText(/dados documentais exigidos/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/abrangencia/i), {
      target: { value: 'intermunicipal' },
    });
    expect(screen.getByLabelText(/dados documentais exigidos/i)).toBeInTheDocument();
  });
});
