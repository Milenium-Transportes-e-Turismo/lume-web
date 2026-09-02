/** @jest-environment node */

import {
  AUTHENTICATED_SESSION_VERSION,
  type AuthenticatedSession,
  type Permission,
} from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { WhatsAppConversationRepositoryError } from '@/features/whatsapp-conversations/application';
import { downloadWhatsAppMessageContentForDashboard } from '@/features/whatsapp-conversations/server';

import { GET } from './route';

jest.mock('@/features/auth/server', () => ({
  getCurrentAuthenticatedSession: jest.fn(),
}));
jest.mock('@/features/whatsapp-conversations/server', () => ({
  downloadWhatsAppMessageContentForDashboard: jest.fn(),
}));

const conversationId = '00000000-0000-4000-8000-000000000101';
const messageId = '00000000-0000-4000-8000-000000000501';
const mockedSession = jest.mocked(getCurrentAuthenticatedSession);
const mockedDownload = jest.mocked(downloadWhatsAppMessageContentForDashboard);

function session(permissions: readonly Permission[] = ['service:view']): AuthenticatedSession {
  return {
    version: AUTHENTICATED_SESSION_VERSION,
    id: 'session-001',
    user: {
      id: 'employee-001',
      name: 'Usuário Comercial',
      type: 'employee',
      departments: ['commercial'],
      permissions,
      clientCategory: null,
      isActive: true,
    },
    issuedAt: '2026-08-06T12:00:00.000Z',
    expiresAt: '2026-08-07T20:00:00.000Z',
    rememberDevice: false,
  };
}

function context() {
  return {
    params: Promise.resolve({ conversationId, messageId }),
  };
}

describe('rota protegida de conteúdo de mídia do WhatsApp', () => {
  afterEach(() => jest.clearAllMocks());

  it('entrega a mídia pela mesma origem sem permitir cache', async () => {
    mockedSession.mockResolvedValue(session());
    mockedDownload.mockResolvedValue({
      fileName: 'audio.m4a',
      mimeType: 'audio/mp4',
      bytes: Uint8Array.from([1, 2, 3, 4]),
    });

    const response = await GET(new Request('http://localhost/api/whatsapp-media'), context());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mp4');
    expect(response.headers.get('content-disposition')).toContain('inline');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(mockedDownload).toHaveBeenCalledWith(conversationId, messageId);
  });

  it('bloqueia usuário sem permissão para consultar conversas', async () => {
    mockedSession.mockResolvedValue(session([]));

    const response = await GET(new Request('http://localhost/api/whatsapp-media'), context());

    expect(response.status).toBe(403);
    expect(mockedDownload).not.toHaveBeenCalled();
  });

  it('marca o conteúdo como anexo quando o download é solicitado', async () => {
    mockedSession.mockResolvedValue(session(['service:view']));
    mockedDownload.mockResolvedValue({
      fileName: 'proposta.pdf',
      mimeType: 'application/pdf',
      bytes: Uint8Array.from([37, 80, 68, 70]),
    });

    const response = await GET(
      new Request('http://localhost/api/whatsapp-media?download=1'),
      context(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
  });

  it('não expõe detalhes internos quando a mídia não existe', async () => {
    mockedSession.mockResolvedValue(session(['service:view']));
    mockedDownload.mockRejectedValue(
      new WhatsAppConversationRepositoryError(
        'not-found',
        'Detalhe técnico que não deve chegar à interface.',
      ),
    );

    const response = await GET(new Request('http://localhost/api/whatsapp-media'), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      message: 'Este arquivo não está mais disponível.',
    });
  });
});
