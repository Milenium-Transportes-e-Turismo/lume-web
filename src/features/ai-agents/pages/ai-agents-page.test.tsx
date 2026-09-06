import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import { AUTHENTICATED_SESSION_VERSION, type AuthenticatedSession } from '@/features/auth/domain';

import { AiAgentsPage } from './ai-agents-page';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@/features/auth/components', () => ({
  LogoutButton: () => <button type="button">Sair</button>,
}));

const mockedUsePathname = jest.mocked(usePathname);

const session: AuthenticatedSession = {
  version: AUTHENTICATED_SESSION_VERSION,
  id: 'session-employee-001',
  user: {
    id: 'employee-001',
    name: 'Maria Silva',
    type: 'employee',
    departments: ['management'],
    permissions: ['dashboard:view', 'ai-agents:view'],
    clientCategory: null,
    isActive: true,
  },
  issuedAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  rememberDevice: false,
};

describe('AiAgentsPage', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/ai-agents');
  });

  afterEach(() => {
    mockedUsePathname.mockReset();
  });

  it('presents the protected catalog and marks its navigation item as current', () => {
    render(<AiAgentsPage session={session} initialAgents={[]} initialExecutions={null} />);

    expect(document.querySelector('main .lume-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agentes de IA' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Agentes de IA' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });
});
