/** @jest-environment node */

import { TenantApiWhatsAppConversationRepository } from './tenant-api-whatsapp-conversation-repository';

const conversationId = '00000000-0000-4000-8000-000000000301';
const messageId = '00000000-0000-4000-8000-000000000302';
const mediaAssetId = '00000000-0000-4000-8000-000000000303';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(body) } as unknown as Response;
}

const interpretation = {
  mediaAssetId,
  interpretationId: '00000000-0000-4000-8000-000000000304',
  status: 'succeeded',
  transcription: 'Olá',
  detectedLanguage: 'pt-BR',
  extractedText: null,
  summary: 'Saudação',
  documentType: null,
  structuredData: null,
  confidence: 0.98,
  durationSeconds: 1.2,
  provenance: { provider: 'openai', model: 'gpt-4.1-mini' },
  errorCode: null,
  correction: null,
  effectiveContext: { value: 'Saudação', source: 'machine' },
  completedAt: '2026-08-29T10:00:00.000Z',
};

describe('WhatsApp media interpretation routes', () => {
  it('uses only the controller paths published by the Tenant API', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(interpretation))
      .mockResolvedValueOnce(jsonResponse(interpretation))
      .mockResolvedValueOnce(
        jsonResponse({
          ...interpretation,
          correction: {
            correction: 'Contexto correto',
            feedback: null,
            correctedByUserId: '00000000-0000-4000-8000-000000000305',
            createdAt: '2026-08-29T10:02:00.000Z',
          },
          effectiveContext: { value: 'Contexto correto', source: 'human' },
        }),
      );
    const repository = new TenantApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );

    await repository.getMediaInterpretation(conversationId, messageId);
    await repository.analyzeMedia(conversationId, messageId);
    await repository.correctMediaInterpretation(conversationId, messageId, 'Contexto correto');

    const base = `https://tenant.example/api/v1/whatsapp/conversations/${conversationId}/messages/${messageId}`;
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `${base}/media-interpretation`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `${base}/actions/analyze-media`,
      expect.objectContaining({ method: 'POST', body: undefined }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      `${base}/media-interpretation/correction`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ correction: 'Contexto correto' }),
      }),
    );
  });
});
