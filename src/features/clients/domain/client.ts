export type ClientStatus = 'active' | 'inactive' | 'suspended';
export type ClientType = 'pf' | 'pj';

export interface ClientPhone {
  readonly number: string;
  readonly description?: string | null;
}

export interface Client {
  readonly id: string;
  readonly taxId: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly costCenter: string | null;
  readonly clientType: ClientType;
  readonly avicExternalId: string | null;
  readonly individualName: string | null;
  readonly cpf: string | null;
  readonly individualEmail: string | null;
  readonly individualWhatsapp: string | null;
  readonly individualPhones: readonly ClientPhone[];
  readonly cnpj: string | null;
  readonly legalEmail: string | null;
  readonly legalWhatsapp: string | null;
  readonly legalPhones: readonly ClientPhone[];
  readonly status: ClientStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClientComment {
  readonly id: string;
  readonly comment: string;
  readonly authorName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClientHistory {
  readonly id: string;
  readonly action: string;
  readonly actorName: string | null;
  readonly beforeSnapshot: Readonly<Record<string, unknown>> | null;
  readonly afterSnapshot: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface ClientList<T> {
  readonly items: readonly T[];
  readonly total: number;
}
