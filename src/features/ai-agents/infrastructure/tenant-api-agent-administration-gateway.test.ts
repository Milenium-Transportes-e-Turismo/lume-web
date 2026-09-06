/** @jest-environment node */

import { TenantApiAgentAdministrationGateway } from './tenant-api-agent-administration-gateway';

const agentId = '00000000-0000-4000-8000-000000000101';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function apiAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: agentId,
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
        credentialIdentifier: 'server-secret-reference',
        credentialVersion: '2',
        status: 'active',
        activatedAt: '2026-08-29T10:00:00.000Z',
        deactivatedAt: null,
      },
    ],
    configurationStatus: 'ready',
    technicalConfigurationMutable: false,
    ...overrides,
  };
}

function apiExecution() {
  return {
    id: '00000000-0000-4000-8000-000000000401',
    agentId,
    agentType: 'customer-service',
    serviceSessionId: '00000000-0000-4000-8000-000000000501',
    source: 'service-session',
    provider: 'openai',
    model: 'gpt-5-mini',
    credentialIdentifier: 'execution-secret-reference',
    status: 'completed',
    latencyMs: 890,
    inputTokens: 120,
    outputTokens: 40,
    totalTokens: 160,
    structuredDecision: { privatePrompt: 'must not cross the gateway' },
    result: { answer: 'must not cross the gateway' },
    errorCode: null,
    startedAt: '2026-08-29T11:00:00.000Z',
    completedAt: '2026-08-29T11:00:00.890Z',
    createdAt: '2026-08-29T11:00:00.000Z',
    attempts: [
      {
        id: '00000000-0000-4000-8000-000000000601',
        attemptNumber: 1,
        provider: 'openai',
        model: 'gpt-5-mini',
        credentialIdentifier: 'attempt-secret-reference',
        status: 'completed',
        latencyMs: 890,
        inputTokens: 120,
        outputTokens: 40,
        totalTokens: 160,
        errorCode: null,
        startedAt: '2026-08-29T11:00:00.000Z',
        completedAt: '2026-08-29T11:00:00.890Z',
      },
    ],
    toolCalls: [
      {
        id: '00000000-0000-4000-8000-000000000701',
        toolId: 'quote.lookup',
        sequence: 0,
        status: 'completed',
        inputHash: 'private-input-hash',
        requestMetadata: { authorization: 'private' },
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
  };
}

describe('TenantApiAgentAdministrationGateway', () => {
  it('uses GET /agents and strips any credential reference at the gateway boundary', async () => {
    const fetcher = jest.fn().mockResolvedValue(jsonResponse([apiAgent()]));
    const gateway = new TenantApiAgentAdministrationGateway(
      'https://tenant.example/api/v1/',
      'access-token',
      fetcher,
    );

    const [agent] = await gateway.listAgents();

    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant.example/api/v1/agents',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
    expect(agent.runtimeConfigs[0]).toMatchObject({ provider: 'openai', model: 'gpt-5-mini' });
    expect(agent.runtimeConfigs[0]).not.toHaveProperty('credentialIdentifier');
  });

  it('loads the real executions endpoint and drops sensitive or non-public execution fields', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(jsonResponse({ page: 2, limit: 10, total: 11, items: [apiExecution()] }));
    const gateway = new TenantApiAgentAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );

    const result = await gateway.listExecutions(agentId, 2, 10);
    const execution = result.items[0];

    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/agents/${agentId}/executions?page=2&limit=10`,
      expect.any(Object),
    );
    expect(execution).not.toHaveProperty('credentialIdentifier');
    expect(execution).not.toHaveProperty('structuredDecision');
    expect(execution).not.toHaveProperty('result');
    expect(execution.attempts[0]).not.toHaveProperty('credentialIdentifier');
    expect(execution.toolCalls[0]).not.toHaveProperty('inputHash');
    expect(execution.toolCalls[0]).not.toHaveProperty('requestMetadata');
  });

  it('posts commandId, expectedVersion and content only to tenant-instructions', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        agentId,
        promptVersionId: '00000000-0000-4000-8000-000000000202',
        version: 4,
        contentHash: 'sha256:new-prompt',
        idempotent: false,
      }),
    );
    const gateway = new TenantApiAgentAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    const input = {
      commandId: '00000000-0000-4000-8000-000000000102',
      expectedVersion: 3,
      content: 'Priorize respostas objetivas.',
    };

    await expect(gateway.updateTenantInstructions(agentId, input)).resolves.toMatchObject({
      version: 4,
      idempotent: false,
    });
    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/agents/${agentId}/tenant-instructions`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('loads redacted immutable instruction history and rolls a source version forward', async () => {
    const sourceVersionId = '00000000-0000-4000-8000-000000000211';
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: sourceVersionId,
            version: 2,
            status: 'inactive',
            content: 'Use [REDACTED] para credenciais.',
            contentHash: 'sha256:old',
            activatedAt: '2026-08-28T10:00:00.000Z',
            deactivatedAt: '2026-08-29T10:00:00.000Z',
            createdAt: '2026-08-28T10:00:00.000Z',
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          agentId,
          promptVersionId: '00000000-0000-4000-8000-000000000212',
          version: 4,
          contentHash: 'sha256:restored',
          sourceVersionId,
          idempotent: false,
        }),
      );
    const gateway = new TenantApiAgentAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    const input = {
      commandId: '00000000-0000-4000-8000-000000000213',
      expectedVersion: 3,
    };

    await expect(gateway.listTenantInstructionVersions(agentId)).resolves.toMatchObject([
      { id: sourceVersionId, version: 2, content: 'Use [REDACTED] para credenciais.' },
    ]);
    await expect(
      gateway.rollbackTenantInstructions(agentId, sourceVersionId, input),
    ).resolves.toMatchObject({ version: 4, sourceVersionId });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `https://tenant.example/api/v1/agents/${agentId}/tenant-instructions/${sourceVersionId}/rollback`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('rejects an incompatible success payload instead of fabricating configuration', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(jsonResponse([apiAgent({ technicalConfigurationMutable: true })]));
    const gateway = new TenantApiAgentAdministrationGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.listAgents()).rejects.toMatchObject({
      code: 'invalid-response',
      publicCode: 'INVALID_API_RESPONSE',
    });
  });
});
