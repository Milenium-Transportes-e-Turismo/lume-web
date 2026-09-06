export interface AiAgentPromptVersion {
  readonly id: string;
  readonly kind: string;
  readonly version: number;
  readonly status: string;
  readonly contentHash: string;
  readonly activatedAt: string | null;
}

export interface AiAgentTenantInstructionVersion {
  readonly id: string;
  readonly version: number;
  readonly status: string;
  readonly content: string;
  readonly contentHash: string;
  readonly activatedAt: string | null;
  readonly deactivatedAt: string | null;
  readonly createdAt: string;
}

export interface AiAgentRuntimeConfiguration {
  readonly id: string;
  readonly version: number;
  readonly provider: string;
  readonly model: string;
  readonly credentialVersion: string | null;
  readonly status: string;
  readonly activatedAt: string | null;
  readonly deactivatedAt: string | null;
}

export interface ManagedAiAgent {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: string;
  readonly status: string;
  readonly contexts: readonly string[];
  readonly customerFacing: boolean;
  readonly platformManaged: boolean;
  readonly promptVersions: readonly AiAgentPromptVersion[];
  readonly runtimeConfigs: readonly AiAgentRuntimeConfiguration[];
  readonly configurationStatus: 'ready' | 'incomplete';
  readonly technicalConfigurationMutable: false;
}

export interface AiAgentExecutionAttempt {
  readonly id: string;
  readonly attemptNumber: number;
  readonly provider: string;
  readonly model: string;
  readonly status: string;
  readonly latencyMs: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly errorCode: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export interface AiAgentToolExecution {
  readonly id: string;
  readonly toolId: string;
  readonly sequence: number;
  readonly status: string;
  readonly resultSummary: unknown;
  readonly authorizationReason: string | null;
  readonly errorCode: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

export interface AiAgentKnowledgeSource {
  readonly documentVersionId: string;
  readonly chunkId: string;
  readonly documentVersionNumber: number;
  readonly chunkOrdinal: number;
  readonly pageNumber: number | null;
  readonly retrievalRank: number;
  readonly confidence: number | null;
  readonly retrievedAt: string;
}

export interface AiAgentExecution {
  readonly id: string;
  readonly agentId: string;
  readonly agentType: string;
  readonly serviceSessionId: string | null;
  readonly source: string;
  readonly provider: string;
  readonly model: string;
  readonly status: string;
  readonly latencyMs: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly errorCode: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly attempts: readonly AiAgentExecutionAttempt[];
  readonly toolCalls: readonly AiAgentToolExecution[];
  readonly knowledgeSources: readonly AiAgentKnowledgeSource[];
}

export interface AiAgentExecutionPage {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly items: readonly AiAgentExecution[];
}

export function getActiveAiAgentRuntime(agent: ManagedAiAgent): AiAgentRuntimeConfiguration | null {
  return agent.runtimeConfigs.find((configuration) => configuration.status === 'active') ?? null;
}

export function getActiveTenantInstructionVersion(agent: ManagedAiAgent): number {
  return (
    agent.promptVersions
      .filter((prompt) => prompt.kind === 'tenant-instructions' && prompt.status === 'active')
      .sort((first, second) => second.version - first.version)[0]?.version ?? 0
  );
}
