import type {
  AiAgentExecutionPage,
  AiAgentTenantInstructionVersion,
  ManagedAiAgent,
} from '../../domain';

export type AgentAdministrationErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class AgentAdministrationError extends Error {
  constructor(
    readonly code: AgentAdministrationErrorCode,
    message: string,
    readonly publicCode: string,
  ) {
    super(message);
    this.name = 'AgentAdministrationError';
  }
}

export interface AgentAdministrationGateway {
  listAgents(): Promise<readonly ManagedAiAgent[]>;
  listExecutions(agentId: string, page?: number, limit?: number): Promise<AiAgentExecutionPage>;
  listTenantInstructionVersions(
    agentId: string,
  ): Promise<readonly AiAgentTenantInstructionVersion[]>;
  updateTenantInstructions(
    agentId: string,
    input: {
      readonly commandId: string;
      readonly expectedVersion: number;
      readonly content: string;
    },
  ): Promise<{
    readonly agentId: string;
    readonly promptVersionId: string;
    readonly version: number;
    readonly contentHash: string;
    readonly idempotent: boolean;
  }>;
  rollbackTenantInstructions(
    agentId: string,
    versionId: string,
    input: { readonly commandId: string; readonly expectedVersion: number },
  ): Promise<{
    readonly agentId: string;
    readonly promptVersionId: string;
    readonly version: number;
    readonly contentHash: string;
    readonly sourceVersionId: string;
    readonly idempotent: boolean;
  }>;
}
