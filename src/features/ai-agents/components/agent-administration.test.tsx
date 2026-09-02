import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  loadAiAgentExecutionsAction,
  loadAiAgentsAction,
  loadTenantAgentInstructionVersionsAction,
  rollbackTenantAgentInstructionsAction,
  updateTenantAgentInstructionsAction,
} from '../actions';
import type { AiAgentExecutionPage, ManagedAiAgent } from '../domain';
import { AgentAdministration } from './agent-administration';

jest.mock('../actions', () => ({
  loadAiAgentExecutionsAction: jest.fn(),
  loadAiAgentsAction: jest.fn(),
  loadTenantAgentInstructionVersionsAction: jest.fn(),
  rollbackTenantAgentInstructionsAction: jest.fn(),
  updateTenantAgentInstructionsAction: jest.fn(),
}));

const mockedLoadExecutions = jest.mocked(loadAiAgentExecutionsAction);
const mockedLoadAgents = jest.mocked(loadAiAgentsAction);
const mockedUpdateInstructions = jest.mocked(updateTenantAgentInstructionsAction);
const mockedLoadInstructionVersions = jest.mocked(loadTenantAgentInstructionVersionsAction);
const mockedRollbackInstructions = jest.mocked(rollbackTenantAgentInstructionsAction);

const agent: ManagedAiAgent = {
  id: '00000000-0000-4000-8000-000000000101',
  code: 'commercial-assistant',
  name: 'Assistente comercial',
  description: 'Apoia a triagem de oportunidades.',
  type: 'customer-service',
  status: 'active',
  contexts: ['whatsapp'],
  customerFacing: true,
  platformManaged: true,
  promptVersions: [
    {
      id: '00000000-0000-4000-8000-000000000201',
      kind: 'tenant-instructions',
      version: 3,
      status: 'active',
      contentHash: 'sha256:prompt',
      activatedAt: '2026-08-29T10:00:00.000Z',
    },
  ],
  runtimeConfigs: [
    {
      id: '00000000-0000-4000-8000-000000000301',
      version: 4,
      provider: 'openai',
      model: 'gpt-5-mini',
      credentialVersion: 2,
      status: 'active',
      activatedAt: '2026-08-29T10:00:00.000Z',
      deactivatedAt: null,
    },
  ],
  configurationStatus: 'ready',
  technicalConfigurationMutable: false,
};

const executions: AiAgentExecutionPage = {
  page: 1,
  limit: 25,
  total: 1,
  items: [
    {
      id: '00000000-0000-4000-8000-000000000401',
      agentId: agent.id,
      agentType: 'customer-service',
      serviceSessionId: '00000000-0000-4000-8000-000000000501',
      source: 'service-session',
      provider: 'openai',
      model: 'gpt-5-mini',
      status: 'completed',
      latencyMs: 890,
      inputTokens: 120,
      outputTokens: 40,
      totalTokens: 160,
      errorCode: null,
      startedAt: '2026-08-29T11:00:00.000Z',
      completedAt: '2026-08-29T11:00:00.890Z',
      createdAt: '2026-08-29T11:00:00.000Z',
      attempts: [],
      toolCalls: [
        {
          id: '00000000-0000-4000-8000-000000000701',
          toolId: 'quote.lookup',
          sequence: 0,
          status: 'completed',
          resultSummary: { count: 1 },
          authorizationReason: 'approved-policy',
          errorCode: null,
          startedAt: '2026-08-29T11:00:00.100Z',
          completedAt: '2026-08-29T11:00:00.200Z',
          createdAt: '2026-08-29T11:00:00.100Z',
        },
      ],
      knowledgeSources: [
        {
          documentVersionId: '00000000-0000-4000-8000-000000000801',
          chunkId: '00000000-0000-4000-8000-000000000901',
          documentVersionNumber: 2,
          chunkOrdinal: 4,
          pageNumber: 3,
          retrievalRank: 0,
          confidence: 0.89,
          retrievedAt: '2026-08-29T11:00:00.050Z',
        },
      ],
    },
  ],
};

describe('AgentAdministration', () => {
  beforeEach(() => {
    mockedLoadAgents.mockResolvedValue({ success: true, agents: [agent] });
    mockedLoadExecutions.mockResolvedValue({ success: true, executions });
    mockedUpdateInstructions.mockResolvedValue({
      success: true,
      message: 'Instruções publicadas na versão 4.',
      agentId: agent.id,
      promptVersionId: '00000000-0000-4000-8000-000000000202',
      version: 4,
      contentHash: 'sha256:new',
      idempotent: false,
    });
    mockedLoadInstructionVersions.mockResolvedValue({
      success: true,
      versions: [
        {
          id: '00000000-0000-4000-8000-000000000211',
          version: 2,
          status: 'inactive',
          content: 'Atenda em português e seja conciso.',
          contentHash: 'sha256:old',
          activatedAt: '2026-08-28T10:00:00.000Z',
          deactivatedAt: '2026-08-29T10:00:00.000Z',
          createdAt: '2026-08-28T10:00:00.000Z',
        },
      ],
    });
    mockedRollbackInstructions.mockResolvedValue({
      success: true,
      message: 'Conteúdo restaurado como nova versão 4.',
      version: 4,
      versions: [],
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('shows the effective runtime and execution evidence without exposing credentials', () => {
    render(
      <AgentAdministration initialAgents={[agent]} initialExecutions={executions} canManage />,
    );

    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('gpt-5-mini').length).toBeGreaterThan(0);
    expect(screen.getByText('quote.lookup')).toBeInTheDocument();
    expect(screen.getByText(/Documento 00000000-0000-4000-8000-000000000801/u)).toBeInTheDocument();
    expect(screen.queryByText(/credential/iu)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /provider/iu })).not.toBeInTheDocument();
  });

  it('publishes a complete tenant-instruction version with command and expected version', async () => {
    const user = userEvent.setup();
    render(
      <AgentAdministration initialAgents={[agent]} initialExecutions={executions} canManage />,
    );

    await user.click(screen.getByRole('button', { name: 'Nova versão' }));
    await user.type(
      screen.getByLabelText('Instruções completas'),
      'Responda de forma objetiva e encaminhe exceções.',
    );
    await user.click(screen.getByRole('button', { name: 'Publicar nova versão' }));

    await waitFor(() =>
      expect(mockedUpdateInstructions).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: agent.id,
          commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
          expectedVersion: 3,
          content: 'Responda de forma objetiva e encaminhe exceções.',
        }),
      ),
    );
    expect(await screen.findByText('Instruções publicadas na versão 4.')).toBeInTheDocument();
  });

  it('hides instruction mutation when the user only has read permission', () => {
    render(
      <AgentAdministration
        initialAgents={[agent]}
        initialExecutions={executions}
        canManage={false}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Nova versão' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Histórico' })).not.toBeInTheDocument();
  });

  it('filters the immutable history dynamically and restores with expected version', async () => {
    const user = userEvent.setup();
    render(
      <AgentAdministration initialAgents={[agent]} initialExecutions={executions} canManage />,
    );

    await user.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText('Atenda em português e seja conciso.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar no histórico de instruções'), 'inexistente');
    expect(screen.getByText('Nenhuma versão corresponde à busca.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar no histórico de instruções'));
    await user.click(screen.getByRole('button', { name: 'Restaurar versão 2 como nova versão' }));

    await waitFor(() =>
      expect(mockedRollbackInstructions).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: agent.id,
          versionId: '00000000-0000-4000-8000-000000000211',
          commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
          expectedVersion: 3,
        }),
      ),
    );
  });
});
