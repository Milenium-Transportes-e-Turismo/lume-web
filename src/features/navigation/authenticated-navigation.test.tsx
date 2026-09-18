import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname, useSearchParams } from 'next/navigation';

import type { EmployeeUser } from '@/features/auth/domain';
import { getPendingQuoteProposalCountAction } from '@/features/quote-proposals/actions';
import { SidebarProvider } from '@/shared/ui/sidebar';

import { AuthenticatedNavigation } from './authenticated-navigation';
import { addNavigationFavoriteAction } from './navigation-favorite-actions';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));
jest.mock('@/features/quote-proposals/actions', () => ({
  getPendingQuoteProposalCountAction: jest.fn(),
}));
jest.mock('./navigation-favorite-actions', () => ({
  listNavigationFavoritesAction: jest.fn().mockResolvedValue({ success: true, favorites: [] }),
  addNavigationFavoriteAction: jest.fn(),
  removeNavigationFavoriteAction: jest.fn(),
}));

const mockedUseSearchParams = jest.mocked(useSearchParams);
const mockedUsePathname = jest.mocked(usePathname);
const mockedPendingCount = jest.mocked(getPendingQuoteProposalCountAction);
const mockedAddFavorite = jest.mocked(addNavigationFavoriteAction);

function renderNavigation(user: EmployeeUser) {
  return render(
    <SidebarProvider>
      <AuthenticatedNavigation user={user} />
    </SidebarProvider>,
  );
}

function createEmployee(
  permissions: EmployeeUser['permissions'],
  isActive = true,
  departments: readonly string[] = ['commercial'],
  isAdministrator = false,
): EmployeeUser {
  return {
    id: 'employee-001',
    name: 'Maria Silva',
    type: 'employee',
    departments,
    permissions,
    clientCategory: null,
    isActive,
    isAdministrator,
  };
}

describe('AuthenticatedNavigation', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/dashboard');
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>,
    );
    mockedPendingCount.mockReset();
    mockedPendingCount.mockResolvedValue({
      success: true,
      pendingTotal: 0,
    });
    mockedAddFavorite.mockReset();
    mockedAddFavorite.mockResolvedValue({ success: true, favorites: [] });
  });

  afterEach(() => {
    mockedUsePathname.mockReset();
  });

  it('renders authorized destinations and identifies the current page', () => {
    renderNavigation(createEmployee(['dashboard:view']));

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows Dashboard in Favoritos immediately after it is favorited', async () => {
    const interaction = userEvent.setup();
    mockedAddFavorite.mockResolvedValue({
      success: true,
      favorites: [
        {
          id: 'favorite-dashboard',
          navigationKey: 'dashboard',
          createdAt: '2026-09-16T12:00:00.000Z',
        },
      ],
    });

    renderNavigation(createEmployee(['dashboard:view']));

    await interaction.click(
      screen.getByRole('button', { name: 'Adicionar Dashboard aos favoritos' }),
    );

    expect(mockedAddFavorite).toHaveBeenCalledWith('dashboard');
    expect(await screen.findByText('Favoritos')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(2);
  });

  it('shows the AI agents module only with its permission', () => {
    mockedUsePathname.mockReturnValue('/ai-agents');

    renderNavigation(createEmployee(['dashboard:view', 'ai-agents:view'], true, ['management']));

    expect(screen.getByRole('link', { name: 'Agentes de IA' })).toHaveAttribute(
      'href',
      '/ai-agents',
    );
    expect(screen.getByRole('link', { name: 'Agentes de IA' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the WhatsApp conversations module with service:view across internal departments', () => {
    mockedUsePathname.mockReturnValue('/whatsapp-conversations');

    renderNavigation(createEmployee(['dashboard:view', 'service:view'], true, ['operations']));

    expect(screen.getByRole('link', { name: 'Painel WhatsApp' })).toHaveAttribute(
      'href',
      '/whatsapp-conversations',
    );
    expect(screen.getByRole('link', { name: 'Painel WhatsApp' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(mockedPendingCount).not.toHaveBeenCalled();
  });

  it('shows one parent notification icon and the numeric count only in Pendentes', async () => {
    mockedUsePathname.mockReturnValue('/quote-proposals');
    mockedPendingCount.mockResolvedValue({
      success: true,
      pendingTotal: 7,
    });

    renderNavigation(createEmployee(['whatsapp-conversations:manage']));

    expect(await screen.findByLabelText('7 orçamentos pendentes')).toHaveTextContent('7');
    expect(screen.getByRole('link', { name: 'Orçamentos' })).toHaveAttribute(
      'href',
      '/quote-proposals',
    );
    expect(screen.queryByText('Visão geral')).not.toBeInTheDocument();
  });

  it('refreshes the pending count when the notification event has no count payload', async () => {
    mockedUsePathname.mockReturnValue('/quote-proposals');
    mockedPendingCount
      .mockResolvedValueOnce({ success: true, pendingTotal: 0 })
      .mockResolvedValueOnce({ success: true, pendingTotal: 4 });

    renderNavigation(createEmployee(['whatsapp-conversations:manage']));
    await waitFor(() => expect(mockedPendingCount).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new CustomEvent('quote-proposals:count'));
    });

    expect(await screen.findByLabelText('4 orçamentos pendentes')).toHaveTextContent('4');
    expect(mockedPendingCount).toHaveBeenCalledTimes(2);
  });

  it('does not render destinations without the required permission', () => {
    renderNavigation(createEmployee(['reports:view']));

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('does not offer Dashboard to a user who lacks dashboard:view', () => {
    renderNavigation(createEmployee(['ai-agents:view'], true, ['management']));

    expect(screen.getByRole('link', { name: 'Agentes de IA' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('places WhatsApp and budgets in the Commercial group', async () => {
    renderNavigation(
      createEmployee(['dashboard:view', 'ai-agents:use', 'whatsapp-conversations:manage']),
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Comercial')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Painel WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orçamentos' })).toBeInTheDocument();
    expect(screen.queryByText('Operação')).not.toBeInTheDocument();
    await waitFor(() => expect(mockedPendingCount).toHaveBeenCalledTimes(1));
  });

  it('renders Cadastro in the corporate Records group', () => {
    mockedUsePathname.mockReturnValue('/registrations');

    renderNavigation(createEmployee(['clients:view'], true, ['operations']));

    expect(screen.getByText('Cadastro')).toBeInTheDocument();
    expect(screen.getByText('Empresa')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Transportes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CNPJs do tenant' })).toHaveAttribute(
      'href',
      '/companies',
    );
    expect(screen.getByRole('link', { name: 'Consultar' })).toHaveAttribute(
      'href',
      '/registrations',
    );
    expect(screen.getByRole('link', { name: 'Consultar' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens the Operations panel by name and expands its screens only from the separate control', async () => {
    mockedUsePathname.mockReturnValue('/operacao/roteirizacao');
    const interaction = userEvent.setup();

    renderNavigation(createEmployee(['route-planner:calculate'], true, ['operations']));

    expect(screen.getByRole('link', { name: 'Operação' })).toHaveAttribute('href', '/operacao');
    expect(screen.getByRole('link', { name: 'Operação' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Roteirização' })).toHaveAttribute(
      'href',
      '/operacao/roteirizacao',
    );
    expect(screen.getByRole('link', { name: 'Roteirização' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await interaction.click(screen.getByRole('button', { name: 'Recolher Operação' }));

    expect(screen.queryByRole('link', { name: 'Roteirização' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir Operação' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('renders Users and document management in the People group', () => {
    renderNavigation(
      createEmployee(['users:view', 'documents:manage'], true, ['management'], true),
    );

    expect(screen.getByText('Plataforma')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/users');
    expect(screen.getByRole('link', { name: 'Gestão documental' })).toHaveAttribute(
      'href',
      '/document-management',
    );
  });

  it('marks the filtered employee view without also marking the generic registration list', () => {
    mockedUsePathname.mockReturnValue('/registrations');
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams('roleCodes=employee') as ReturnType<typeof useSearchParams>,
    );
    renderNavigation(createEmployee(['clients:view'], true, ['operations']));
    expect(screen.getByRole('link', { name: 'Funcionários' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Consultar' })).not.toHaveAttribute('aria-current');
  });

  it('marks only the creation destination while creating a registration', () => {
    mockedUsePathname.mockReturnValue('/registrations/new');
    renderNavigation(createEmployee(['clients:view', 'clients:create'], true, ['operations']));
    expect(screen.getByRole('link', { name: 'Criar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Consultar' })).not.toHaveAttribute('aria-current');
  });

  it('marks the requested records tab in the Financial navigation', () => {
    mockedUsePathname.mockReturnValue('/transport');
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams('tab=records') as ReturnType<typeof useSearchParams>,
    );
    renderNavigation(createEmployee(['trips:view'], true, ['operations']));
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registros importados' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Pendências' })).not.toHaveAttribute('aria-current');
  });

  it('does not render navigation for an inactive user', () => {
    renderNavigation(createEmployee(['dashboard:view'], false));

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
