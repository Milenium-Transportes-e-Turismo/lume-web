import type { Client, ClientComment, ClientHistory, ClientList } from '../domain/client';

export type ClientErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class ClientError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

export interface ClientGateway {
  list(query?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    clientType?: string;
    sort?: string;
  }): Promise<ClientList<Client>>;
  create(input: Record<string, unknown>): Promise<Client>;
  update(id: string, input: Record<string, unknown>): Promise<Client>;
  get(id: string): Promise<Client>;
  listComments(id: string): Promise<readonly ClientComment[]>;
  addComment(id: string, comment: string): Promise<ClientComment>;
  updateComment(id: string, commentId: string, comment: string): Promise<ClientComment>;
  removeComment(id: string, commentId: string): Promise<{ removed: true }>;
  listHistory(id: string): Promise<readonly ClientHistory[]>;
}
