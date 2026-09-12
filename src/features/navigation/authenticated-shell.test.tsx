import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';

import type { EmployeeUser } from '@/features/auth/domain';

import { AuthenticatedShell } from './authenticated-shell';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/features/auth/components', () => ({
  LogoutButton: () => <button type="button">Sair</button>,
}));
jest.mock('@/features/quote-proposals/actions', () => ({
  getPendingQuoteProposalCountAction: jest.fn(),
}));

const mockedUsePathname = jest.mocked(usePathname);

const employee: EmployeeUser = {
  id: 'employee-001',
  name: 'Maria Silva',
  type: 'employee',
  departments: ['commercial'],
  permissions: ['dashboard:view', 'ai-agents:view'],
  clientCategory: null,
  isActive: true,
};

describe('AuthenticatedShell', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/dashboard');
  });

  afterEach(() => {
    mockedUsePathname.mockReset();
  });

  it('shares the authorized navigation and session actions with internal pages', () => {
    const { container } = render(
      <AuthenticatedShell user={employee}>
        <div>Conteúdo protegido</div>
      </AuthenticatedShell>,
    );

    expect(
      screen.getByRole('navigation', {
        name: 'Navegação da área interna',
      }),
    ).toBeInTheDocument();
    const lumeBrand = screen.getByRole('img', { name: 'Lume' });
    expect(lumeBrand).toBeInTheDocument();
    expect(lumeBrand.closest('button')).toBeNull();
    expect(
      screen
        .getAllByRole('link', { name: 'Dashboard' })
        .some((link) => link.getAttribute('href')?.includes('/dashboard')),
    ).toBe(true);
    expect(screen.queryByRole('link', { name: /Site institucional/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Maria Silva Atendente/ })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelector('[data-slot="sidebar-inset"] > header')).toBeNull();
    expect(container.querySelector('[data-slot="breadcrumb"]')).toBeNull();
  });

  it('supports the official responsive sidebar trigger', async () => {
    const user = userEvent.setup();
    render(
      <AuthenticatedShell user={employee}>
        <div>Conteúdo protegido</div>
      </AuthenticatedShell>,
    );

    const trigger = screen.getByRole('button', { name: 'Alternar menu lateral' });
    await user.click(trigger);
    expect(document.cookie).toContain('sidebar_state=false');
  });
});
