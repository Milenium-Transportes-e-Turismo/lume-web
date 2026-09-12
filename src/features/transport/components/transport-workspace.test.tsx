import { render, screen } from '@testing-library/react';
import type { EmployeeUser } from '@/features/auth/domain';
import { TransportWorkspace } from './transport-workspace';
jest.mock('./catalog-panel', () => ({ CatalogPanel: () => <div>Rotas cadastradas</div> }));
jest.mock('./trip-panel', () => ({
  TripPanel: () => <div>Conferência de viagens</div>,
  ImportPanel: () => <div>Importação</div>,
}));
jest.mock('./summary-panel', () => ({ SummaryPanel: () => <div>Resumo</div> }));
jest.mock('./integration-panel', () => ({ IntegrationPanel: () => <div>Integração</div> }));
const user: EmployeeUser = {
  id: 'employee',
  name: 'Operador',
  type: 'employee',
  departments: ['operations'],
  permissions: ['clients:view', 'trips:view', 'contracts:view'],
  clientCategory: null,
  isActive: true,
};
it('keeps operational panels while removing shared catalogs from Transportes', () => {
  render(<TransportWorkspace user={user} />);
  for (const name of [
    'Pendências',
    'Registros importados',
    'Importação e análise',
    'Rotas de origem',
    'KM por contrato',
  ])
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  for (const name of [
    'CNPJs do tenant',
    'Frota',
    'Tipos e categorias',
    'Vínculos de clientes e funcionários',
    'Contratos',
  ])
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
});
it('keeps route access for contract readers without requiring trip permissions', () => {
  render(<TransportWorkspace user={{ ...user, permissions: ['contracts:view'] }} />);
  expect(screen.getByRole('button', { name: 'Rotas de origem' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Pendências' })).not.toBeInTheDocument();
  expect(screen.getByText('Rotas cadastradas')).toBeInTheDocument();
});
