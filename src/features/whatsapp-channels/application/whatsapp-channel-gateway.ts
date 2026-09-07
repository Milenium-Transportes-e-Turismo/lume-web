import type {
  ManagedWhatsAppChannel,
  WhatsAppChannelPairingStatus,
  WhatsAppChannelAction,
  WhatsAppChannelOperationResult,
  WhatsAppChannelRoutingMode,
} from '../domain';

export type WhatsAppChannelGatewayErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class WhatsAppChannelGatewayError extends Error {
  constructor(
    readonly code: WhatsAppChannelGatewayErrorCode,
    message: string,
    readonly publicCode: string,
    readonly currentVersion: number | null = null,
  ) {
    super(message);
    this.name = 'WhatsAppChannelGatewayError';
  }
}

export interface CreateWhatsAppChannelInput {
  readonly agentsEnabled?: boolean;
  readonly commandId: string;
  readonly displayName: string;
  readonly phoneNumber: string;
  readonly departmentId: string | null;
  readonly routingMode: WhatsAppChannelRoutingMode;
  readonly allowedAutomaticTargetDepartmentIds: readonly string[];
}

export interface UpdateWhatsAppChannelInput extends Omit<
  CreateWhatsAppChannelInput,
  'phoneNumber'
> {
  readonly expectedVersion: number;
}

export interface ExecuteWhatsAppChannelActionInput {
  readonly commandId: string;
  readonly expectedVersion: number;
}

export interface WhatsAppChannelGateway {
  pairing(channelId: string): Promise<WhatsAppChannelPairingStatus>;
  listDepartments(): Promise<readonly { id: string; name: string }[]>;
  list(): Promise<readonly ManagedWhatsAppChannel[]>;
  get(channelId: string): Promise<ManagedWhatsAppChannel>;
  create(input: CreateWhatsAppChannelInput): Promise<WhatsAppChannelOperationResult>;
  update(channelId: string, input: UpdateWhatsAppChannelInput): Promise<ManagedWhatsAppChannel>;
  executeAction(
    channelId: string,
    action: WhatsAppChannelAction,
    input: ExecuteWhatsAppChannelActionInput,
  ): Promise<WhatsAppChannelOperationResult>;
}
