import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getMediaInterpretationAction } from '../actions';
import type { WhatsAppMessage } from '../domain';
import { MessageMediaInterpretation } from './message-media-interpretation';

jest.mock('../actions', () => ({
  analyzeMediaInterpretationAction: jest.fn(),
  correctMediaInterpretationAction: jest.fn(),
  getMediaInterpretationAction: jest.fn(),
}));

const message: WhatsAppMessage = {
  id: '00000000-0000-4000-8000-000000000302',
  direction: 'inbound',
  deliveryStatus: 'received',
  kind: 'audio',
  text: null,
  attachment: {
    mimeType: 'audio/ogg',
    size: 10,
    url: '/media',
    fileName: 'audio.ogg',
    metadata: {},
  },
  occurredAt: '2026-08-29T10:00:00.000Z',
  attempts: [],
};

describe('MessageMediaInterpretation', () => {
  it('loads on demand, renders confidence/provenance and never exposes credentials', async () => {
    const user = userEvent.setup();
    jest.mocked(getMediaInterpretationAction).mockResolvedValue({
      success: true,
      interpretation: {
        mediaAssetId: '00000000-0000-4000-8000-000000000303',
        interpretationId: '00000000-0000-4000-8000-000000000304',
        status: 'succeeded',
        transcription: 'Olá',
        detectedLanguage: 'pt-BR',
        extractedText: null,
        summary: 'Saudação',
        documentType: null,
        structuredData: null,
        confidence: 0.98,
        durationSeconds: 1,
        provenance: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          credentialIdentifier: 'secret-ref',
        },
        errorCode: null,
        correction: null,
        effectiveContext: { value: 'Saudação', source: 'machine' },
        completedAt: '2026-08-29T10:00:01.000Z',
      },
    });
    render(
      <MessageMediaInterpretation
        conversationId="00000000-0000-4000-8000-000000000301"
        message={message}
        canManage
      />,
    );

    expect(screen.queryByText('Saudação')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver interpretação' }));
    expect(await screen.findByText('98% confiança')).toBeInTheDocument();
    expect(screen.getAllByText('Saudação').length).toBeGreaterThan(0);
    expect(screen.queryByText(/credentialIdentifier|secret-ref/iu)).not.toBeInTheDocument();
  });
});
