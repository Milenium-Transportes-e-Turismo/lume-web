import { render, screen } from '@testing-library/react';

import type { WhatsAppMessage } from '../domain';
import { createWhatsAppConversationFixture } from '../testing/whatsapp-conversation-fixture';
import { ConversationMessageSheet } from './conversation-message-sheet';

describe('autoria real das mensagens', () => {
  it('labels EXTERNAL_HUMAN and its WhatsApp App source without assigning an internal user', () => {
    const message: WhatsAppMessage = {
      id: '00000000-0000-4000-8000-000000000799',
      direction: 'outbound',
      deliveryStatus: 'sent',
      kind: 'text',
      text: 'Resposta enviada diretamente no aparelho.',
      attachment: null,
      sentBy: null,
      actor: { type: 'EXTERNAL_HUMAN', id: null, name: null },
      source: 'WHATSAPP_APP',
      occurredAt: '2026-08-29T12:00:00.000Z',
      attempts: [],
    };

    render(
      <ConversationMessageSheet
        conversation={createWhatsAppConversationFixture({ messages: [message] })}
        isLoading={false}
        isLoaded
        detailError=""
        onRetry={jest.fn()}
        onLoadOlder={jest.fn()}
        isLoadingOlder={false}
        searchOpen={false}
        onSearchOpenChange={jest.fn()}
        messageDraft=""
        onMessageDraftChange={jest.fn()}
        selectedAttachment={null}
        onSelectedAttachmentChange={jest.fn()}
        canSendMessage={false}
        isSendingMessage={false}
        onSendMessage={jest.fn()}
        feedbackMessage=""
        feedbackTone="neutral"
      />,
    );

    expect(
      screen.getByText(/Enviada por Atendente externo \(WhatsApp\) via aplicativo WhatsApp/),
    ).toBeInTheDocument();
  });
});
