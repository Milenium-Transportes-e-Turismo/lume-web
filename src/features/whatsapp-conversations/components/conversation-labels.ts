import type {
  WhatsAppConversationDepartment,
  WhatsAppConversationFlowStep,
  WhatsAppConversationState,
  WhatsAppMessageDeliveryStatus,
  WhatsAppMessageKind,
  WhatsAppMessage,
  WhatsAppRequestStatus,
} from '../domain';

export const DEPARTMENT_LABELS: Record<WhatsAppConversationDepartment, string> = {
  'human-resources': 'Recursos Humanos',
  'personnel-department': 'Departamento Pessoal',
  commercial: 'Comercial',
  purchasing: 'Compras',
  controlling: 'Controladoria',
  maintenance: 'Manutenção',
  monitoring: 'Monitoramento',
  management: 'Gerência',
  operations: 'Operacional',
  cleaning: 'Limpeza',
  financial: 'Financeiro',
  'information-technology': 'Tecnologia da Informação',
};

export const CONVERSATION_STATE_LABELS: Record<WhatsAppConversationState, string> = {
  'bot-active': 'Bot ativo',
  'waiting-for-customer': 'Aguardando o cliente',
  'sent-to-human': 'Encaminhada para atendente',
  'human-active': 'Atendente ativo',
  closed: 'Encerrada',
};

export const FLOW_STEP_LABELS: Record<WhatsAppConversationFlowStep, string> = {
  'main-menu': 'Menu principal',
  'commercial-menu': 'Menu comercial',
  'quote-data-collection': 'Coleta de dados do orçamento',
  'quote-summary-confirmation': 'Confirmação do resumo',
  'quote-send-pending': 'Envio da proposta pendente',
  'commercial-follow-up-menu': 'Acompanhamento comercial',
  'human-service': 'Atendimento com atendente',
  closed: 'Fluxo encerrado',
};

export const REQUEST_STATUS_LABELS: Record<WhatsAppRequestStatus, string> = {
  'not-started': 'Não iniciado',
  'collecting-information': 'Coletando informações',
  'waiting-for-customer': 'Aguardando cliente',
  'under-review': 'Em análise',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
};

export const DELIVERY_STATUS_LABELS: Record<WhatsAppMessageDeliveryStatus, string> = {
  received: 'Recebida',
  pending: 'Envio pendente',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falha no envio',
};

export const MESSAGE_KIND_LABELS: Record<WhatsAppMessageKind, string> = {
  text: 'Texto',
  image: 'Imagem',
  document: 'Documento',
  audio: 'Áudio',
  video: 'Vídeo',
  sticker: 'Figurinha',
  location: 'Localização',
  contact: 'Contato',
  unknown: 'Anexo',
};

export type ConversationControl = 'bot' | 'human' | 'paused' | 'closed';
export type RequestStatusTone = 'neutral' | 'progress' | 'waiting' | 'success' | 'danger';

export function getConversationControl(
  conversationState: WhatsAppConversationState,
): ConversationControl {
  if (conversationState === 'bot-active') return 'bot';
  if (conversationState === 'human-active') return 'human';
  if (conversationState === 'closed') return 'closed';
  return 'paused';
}

export function getConversationControlLabel(conversationState: WhatsAppConversationState): string {
  const control = getConversationControl(conversationState);

  return {
    bot: 'Bot ativo',
    human: 'Atendente ativo',
    paused: 'Bot bloqueado',
    closed: 'Encerrada',
  }[control];
}

export function getRequestStatusTone(status: WhatsAppRequestStatus): RequestStatusTone {
  if (status === 'approved') return 'success';
  if (status === 'cancelled' || status === 'rejected') return 'danger';
  if (status === 'waiting-for-customer') return 'waiting';
  if (status === 'collecting-information' || status === 'under-review') return 'progress';
  return 'neutral';
}

export function getWhatsAppMessageActorLabel(
  message: WhatsAppMessage,
  customerName: string,
): string {
  if (message.actor?.type === 'EXTERNAL_HUMAN') {
    return message.actor.name
      ? `${message.actor.name} (externo no WhatsApp)`
      : 'Atendente externo (WhatsApp)';
  }
  if (message.actor?.name) return message.actor.name;

  const actorLabel: Readonly<Record<string, string>> = {
    CUSTOMER: customerName,
    HUMAN_USER: message.sentBy?.name ?? 'Atendente Lume',
    EXTERNAL_HUMAN: 'Atendente externo (WhatsApp)',
    AI_AGENT: 'IA Lume',
    SYSTEM: 'Sistema Lume',
  };

  if (message.actor?.type && actorLabel[message.actor.type]) return actorLabel[message.actor.type];
  if (message.sentBy?.name) return message.sentBy.name;
  if (message.direction === 'inbound') return customerName;
  return 'Autoria não informada';
}

export function getWhatsAppMessageSourceLabel(message: WhatsAppMessage): string | null {
  if (!message.source) return null;

  return (
    {
      LUME_WEB: 'Lume Web',
      WHATSAPP_APP: 'aplicativo WhatsApp',
      AUTOMATION: 'automação',
    }[message.source] ?? message.source
  );
}
