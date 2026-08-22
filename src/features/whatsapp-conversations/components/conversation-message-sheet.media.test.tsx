import { fireEvent, render, screen } from '@testing-library/react';

import type { WhatsAppMessage, WhatsAppMessageKind } from '../domain';
import { createWhatsAppConversationFixture } from '../testing/whatsapp-conversation-fixture';
import { ConversationMessageSheet } from './conversation-message-sheet';

const conversationId = '00000000-0000-4000-8000-000000000101';

function mediaMessage(
  id: string,
  kind: Exclude<WhatsAppMessageKind, 'text'>,
  mimeType: string,
  fileName: string,
): WhatsAppMessage {
  return {
    id,
    direction: 'inbound',
    deliveryStatus: 'received',
    kind,
    text: null,
    attachment: {
      mimeType,
      size: 2_048,
      url: `/api/whatsapp-conversations/${conversationId}/messages/${id}/content`,
      fileName,
      metadata: {},
    },
    sentBy: null,
    occurredAt: '2026-08-06T12:00:00.000Z',
    attempts: [],
  };
}

function oversizedVideoMessage(): WhatsAppMessage {
  return {
    ...mediaMessage(
      '00000000-0000-4000-8000-000000000516',
      'video',
      'video/mp4',
      'video-grande.mp4',
    ),
    attachment: {
      mimeType: 'video/mp4',
      size: 52_428_801,
      url: null,
      fileName: 'video-grande.mp4',
      retentionStatus: 'too-large',
      metadata: { retentionStatus: 'too-large' },
    },
  };
}

function renderSheet() {
  const messages: readonly WhatsAppMessage[] = [
    {
      id: '00000000-0000-4000-8000-000000000510',
      direction: 'inbound',
      deliveryStatus: 'received',
      kind: 'text',
      text: 'Mensagem de texto legível.',
      attachment: null,
      sentBy: null,
      occurredAt: '2026-08-06T11:59:00.000Z',
      attempts: [],
    },
    mediaMessage('00000000-0000-4000-8000-000000000511', 'image', 'image/jpeg', 'foto.jpg'),
    mediaMessage('00000000-0000-4000-8000-000000000512', 'audio', 'audio/mp4', 'audio.m4a'),
    mediaMessage('00000000-0000-4000-8000-000000000513', 'video', 'video/mp4', 'video.mp4'),
    mediaMessage('00000000-0000-4000-8000-000000000514', 'sticker', 'image/webp', 'figurinha.webp'),
    mediaMessage(
      '00000000-0000-4000-8000-000000000515',
      'document',
      'application/pdf',
      'proposta.pdf.enc',
    ),
    oversizedVideoMessage(),
  ];

  render(
    <ConversationMessageSheet
      conversation={createWhatsAppConversationFixture({ id: conversationId, messages })}
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
}

describe('pré-visualização de mídias no chat', () => {
  it('renderiza texto, imagem, áudio, vídeo, figurinha e PDF com nomes claros', () => {
    renderSheet();

    expect(screen.getByText('Mensagem de texto legível.')).toBeInTheDocument();
    expect(screen.queryByAltText('foto.jpg')).not.toBeInTheDocument();
    screen.getAllByRole('button', { name: 'Carregar mídia' }).forEach((button) => {
      fireEvent.click(button);
    });
    expect(screen.queryByTitle('Visualização de proposta.pdf')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar PDF' }));
    expect(screen.getByAltText('foto.jpg')).toBeInTheDocument();
    expect(screen.getByLabelText('audio.m4a')).toBeInTheDocument();
    expect(screen.getByLabelText('video.mp4')).toBeInTheDocument();
    expect(screen.getByAltText('Figurinha recebida')).toBeInTheDocument();
    expect(screen.getByText('proposta.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Documento PDF/)).toBeInTheDocument();
    expect(screen.getByTitle('Visualização de proposta.pdf')).toHaveAttribute(
      'src',
      expect.stringContaining('/content#toolbar=1&navpanes=0'),
    );
    expect(screen.getAllByRole('link', { name: 'Baixar' })).toHaveLength(5);
    expect(document.body).not.toHaveTextContent('.enc');
    expect(document.body).not.toHaveTextContent('[vídeo]');
    expect(document.body).not.toHaveTextContent('[documento]');
  });

  it('informa claramente quando uma mídia histórica não pode mais ser carregada', () => {
    renderSheet();

    fireEvent.click(screen.getAllByRole('button', { name: 'Carregar mídia' })[0]);
    fireEvent.error(screen.getByAltText('foto.jpg'));

    expect(screen.getByText(/arquivo não está mais disponível/i)).toBeInTheDocument();
    expect(screen.queryByAltText('foto.jpg')).not.toBeInTheDocument();
  });

  it('mantém a mensagem visível quando a mídia excede o limite de retenção', () => {
    renderSheet();

    expect(screen.getByText('video-grande.mp4')).toBeInTheDocument();
    expect(screen.getByText(/arquivo acima do limite permitido/i)).toBeInTheDocument();
  });

  it('insere emoji e identifica figurinha WebP antes do envio', async () => {
    const onMessageDraftChange = jest.fn();
    const onSelectedAttachmentChange = jest.fn();
    render(
      <ConversationMessageSheet
        conversation={createWhatsAppConversationFixture({ id: conversationId })}
        isLoading={false}
        isLoaded
        detailError=""
        onRetry={jest.fn()}
        onLoadOlder={jest.fn()}
        isLoadingOlder={false}
        searchOpen={false}
        onSearchOpenChange={jest.fn()}
        messageDraft="Olá "
        onMessageDraftChange={onMessageDraftChange}
        selectedAttachment={null}
        onSelectedAttachmentChange={onSelectedAttachmentChange}
        canSendMessage
        isSendingMessage={false}
        onSendMessage={jest.fn()}
        feedbackMessage=""
        feedbackTone="neutral"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar emoji' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Inserir sorriso feliz' }));
    expect(onMessageDraftChange).toHaveBeenCalledWith('Olá 😀');

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar anexo' }));
    fireEvent.click(await screen.findByText('Figurinha WebP'));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input?.accept).toBe('image/webp,.webp');
    const sticker = new File(['webp'], 'figurinha.webp', { type: 'image/webp' });
    fireEvent.change(input!, { target: { files: [sticker] } });
    expect(onSelectedAttachmentChange).toHaveBeenCalledWith(sticker, 'sticker');
  });
});
