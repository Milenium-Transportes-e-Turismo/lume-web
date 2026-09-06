import type {
  Registration,
  RegistrationCandidate,
  RegistrationCatalog,
  RegistrationHistory,
  RegistrationImportBatch,
  RegistrationList,
} from '../domain';

export type RegistrationGatewayErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class RegistrationGatewayError extends Error {
  constructor(
    readonly code: RegistrationGatewayErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RegistrationGatewayError';
  }
}

export interface RegistrationGateway {
  catalog(): Promise<RegistrationCatalog>;
  createTag(input: { name: string; color?: string }): Promise<RegistrationCatalog['tags'][number]>;
  list(
    query?: Record<string, string | number | undefined>,
  ): Promise<RegistrationList<Registration>>;
  get(id: string): Promise<Registration>;
  create(input: Record<string, unknown>): Promise<Registration>;
  update(id: string, input: Record<string, unknown>): Promise<Registration>;
  history(id: string): Promise<readonly RegistrationHistory[]>;
  createRelationship(id: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateRelationship(
    id: string,
    relationshipId: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  removeRelationship(
    id: string,
    relationshipId: string,
    expectedVersion: number,
  ): Promise<{ removed: true }>;
  listBatches(): Promise<readonly RegistrationImportBatch[]>;
  listCandidates(
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<
    RegistrationList<RegistrationCandidate> & { counts: Readonly<Record<string, number>> }
  >;
  getCandidate(id: string): Promise<RegistrationCandidate>;
  reviewCandidate(id: string, input: Record<string, unknown>): Promise<RegistrationCandidate>;
  promoteCandidate(id: string, expectedVersion: number): Promise<RegistrationCandidate>;
}
