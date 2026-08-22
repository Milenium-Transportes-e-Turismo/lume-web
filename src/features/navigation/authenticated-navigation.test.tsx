import { act, render, screen, waitFor } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import type { EmployeeUser } from '@/features/auth/domain';
import { getPendingQuoteProposalCountAction } from '@/features/quote-proposals/actions';
import { SidebarProvider } from '@/shared/ui/sidebar';

import { AuthenticatedNavigation } from './authenticated-navigation';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));
jest.mock('@/features/quote-proposals/actions', () => ({
  getPendingQuoteProposalCountAction: jest.fn(),
}));

const mockedUsePathname = jest.mocked(usePathname);
const mockedPendingCount = jest.mocked(getPendingQuoteProposalCountAction);

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
    mockedPendingCount.mockReset();
    mockedPendingCount.mockResolvedValue({
      success: true,
      pendingTotal: 0,
    });
  });

  afterEach(() => {
    mockedUsePathname.mockReset();
  });

  it('renders authorized destinations and identifies the current page', () => {
    renderNavigation(createEmployee(['dashboard:view']));

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the AI agents module only with its permission', () => {
    mockedUsePathname.mockReturnValue('/ai-agents');

    renderNavigation(createEmployee(['dashboard:view', 'ai-agents:use']));

    expect(screen.getByRole('link', { name: 'Agentes de IA' })).toHaveAttribute(
      'href',
      '/ai-agents',
    );
    expect(screen.getByRole('link', { name: 'Agentes de IA' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the WhatsApp conversations module only with its permission', async () => {
    mockedUsePathname.mockReturnValue('/whatsapp-conversations');

    renderNavigation(createEmployee(['dashboard:view', 'whatsapp-conversations:manage']));

    expect(screen.getByRole('link', { name: 'Painel WhatsApp' })).toHaveAttribute(
      'href',
      '/whatsapp-conversations',
    );
    expect(screen.getByRole('link', { name: 'Painel WhatsApp' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await waitFor(() => expect(mockedPendingCount).toHaveBeenCalledTimes(1));
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

  it('places WhatsApp and budgets in the Commercial group', async () => {
    renderNavigation(
      createEmployee(['dashboard:view', 'ai-agents:use', 'whatsapp-conversations:manage']),
    );

    expect(screen.getByText('Geral')).toBeInTheDocument();
    expect(screen.getByText('Comercial')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Painel WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orçamentos' })).toBeInTheDocument();
    expect(screen.queryByText('Operação')).not.toBeInTheDocument();
    await waitFor(() => expect(mockedPendingCount).toHaveBeenCalledTimes(1));
  });

  it('renders clients in the corporate Records group', () => {
    mockedUsePathname.mockReturnValue('/clients');

    renderNavigation(createEmployee(['clients:view'], true, ['operations']));

    expect(screen.getByText('Cadastros')).toBeInTheDocument();
    expect(screen.queryByText('Operacional')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clients');
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders Users and document management in the People group', () => {
    renderNavigation(
      createEmployee(['users:view', 'documents:manage'], true, ['management'], true),
    );

    expect(screen.getByText('Pessoas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/users');
    expect(screen.getByRole('link', { name: 'Gestão documental' })).toHaveAttribute(
      'href',
      '/document-management',
    );
  });

  it('does not render navigation for an inactive user', () => {
    renderNavigation(createEmployee(['dashboard:view'], false));

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
