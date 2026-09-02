import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getKnowledgeDocumentAction } from '../actions';
import type { KnowledgeBase, KnowledgeDocumentSummary } from '../domain';
import { KnowledgeManagement } from './knowledge-management';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
jest.mock('../actions', () => ({
  executeKnowledgeMutationAction: jest.fn(),
  getKnowledgeDocumentAction: jest.fn(),
  uploadKnowledgeOriginalAction: jest.fn(),
}));

const base: KnowledgeBase = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Operação',
  description: null,
  enabled: true,
  archivedAt: null,
  documentCount: 1,
  createdAt: '2026-08-29T09:00:00.000Z',
  updatedAt: '2026-08-29T09:00:00.000Z',
};
const document: KnowledgeDocumentSummary = {
  id: '00000000-0000-4000-8000-000000000102',
  knowledgeBaseId: base.id,
  title: 'Política de atendimento',
  description: 'Como atender clientes',
  sourceType: 'article',
  scope: 'tenant',
  visibility: 'customer-safe',
  departmentIds: [],
  archivedAt: null,
  latestVersion: null,
  createdAt: '2026-08-29T09:00:00.000Z',
  updatedAt: '2026-08-29T09:00:00.000Z',
};

describe('KnowledgeManagement', () => {
  beforeEach(() => {
    jest.mocked(getKnowledgeDocumentAction).mockResolvedValue({
      success: true,
      document: { ...document, versions: [] },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('filters documents as the operator types without a filter button', async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeManagement
        initialBases={[base]}
        initialDocuments={[document]}
        initialSuggestions={[]}
        initialGaps={[]}
        initialErrors={{}}
        permissions={{ canView: true, canManage: false, canPublish: false }}
      />,
    );

    expect(screen.getByText('Política de atendimento')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar documentos'), 'inexistente');
    expect(screen.getByText('Nenhum documento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Filtrar/iu })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo artigo/iu })).not.toBeInTheDocument();
  });

  it('uses the department catalog instead of asking for UUIDs', async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeManagement
        initialDepartments={[
          {
            id: '00000000-0000-4000-8000-000000000120',
            code: 'commercial',
            name: 'Comercial',
            isDefault: true,
          },
        ]}
        initialBases={[base]}
        initialDocuments={[document]}
        initialSuggestions={[]}
        initialGaps={[]}
        initialErrors={{}}
        permissions={{ canView: true, canManage: true, canPublish: false }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Artigo' }));
    await user.selectOptions(screen.getByLabelText('Escopo'), 'department');
    expect(screen.getByRole('option', { name: 'Comercial (padrão)' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/UUIDs dos departamentos/iu)).not.toBeInTheDocument();
  });
});
