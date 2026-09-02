import { fireEvent, render, screen } from '@testing-library/react';

import type { DocumentTypeSummary } from '../domain';
import type { TenantUser } from '@/features/tenant-administration/domain';
import { BatchDocumentRequestForm } from './batch-document-request-form';

jest.mock('@/features/document-management/actions', () => ({
  createBatchDocumentRequestsAction: jest.fn(),
}));

beforeAll(() => {
  window.PointerEvent ??= MouseEvent as typeof PointerEvent;
});

const users = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Ana Silva',
    username: 'ana',
    email: 'ana@example.com',
    isActive: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Ana Souza',
    username: 'anas',
    email: 'ana.souza@example.com',
    isActive: true,
  },
] as TenantUser[];

const documentTypes = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    code: 'cpf',
    name: 'CPF',
    active: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    code: 'child-identification',
    name: 'RG e CPF dos filhos',
    active: true,
  },
] satisfies DocumentTypeSummary[];

describe('BatchDocumentRequestForm', () => {
  it('adiciona vários usuários e seleciona todos os documentos', () => {
    const { container } = render(
      <BatchDocumentRequestForm users={users} documentTypes={documentTypes} />,
    );
    const userSelect = screen.getByLabelText('Usuário a adicionar');

    fireEvent.change(userSelect, {
      target: { value: 'Ana Silva · ana · ana@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar usuário' }));
    fireEvent.change(userSelect, {
      target: { value: 'Ana Souza · anas · ana.souza@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar usuário' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Selecionar todos os documentos/ }));

    expect(container.querySelectorAll('input[name="subjectUserIds"]')).toHaveLength(2);
    expect(container.querySelectorAll('input[name="documentTypeIds"]')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Criar 2 solicitações' })).toBeEnabled();
    expect(screen.getByText(/Ana Silva · ana · ana@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Souza · anas · ana.souza@example.com/)).toBeInTheDocument();
  });
});
