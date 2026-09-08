/** @jest-environment node */

import { WhatsAppConversationRepositoryError } from '../application';
import { LumeApiWhatsAppConversationRepository } from './tenant-api-whatsapp-conversation-repository';

const conversationId = '00000000-0000-4000-8000-000000000101';
const messageId = '00000000-0000-4000-8000-000000000501';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function apiQuote() {
  return {
    id: '00000000-0000-4000-8000-000000000401',
    sequence: 2,
    status: 'under-review',
    contactName: 'Ana Paula',
    document: '04252011000110',
    email: 'ana@example.test',
    serviceType: 'Evento',
    origin: 'Belo Horizonte',
    destination: 'Contagem',
    departureDate: '2026-08-01',
    departureAt: '2026-08-01T10:00:00.000Z',
    returnDate: null,
    returnAt: null,
    passengerCount: 20,
    vehicleType: 'Ônibus',
    vehicleAtDisposal: true,
    localTransfers: false,
    notes: 'Resumo confirmado.',
    structuredData: { eventType: 'Congresso' },
    version: 3,
    createdAt: '2026-07-21T13:36:00.000Z',
    updatedAt: '2026-07-21T13:40:00.000Z',
  };
}

function apiConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: conversationId,
    companyId: '00000000-0000-4000-8000-000000000001',
    channel: {
      id: '00000000-0000-4000-8000-000000000201',
      name: 'WhatsApp Comercial',
      phoneNumber: '5531999990000',
    },
    contact: {
      id: '00000000-0000-4000-8000-000000000301',
      phone: '5531999991001',
      displayName: 'Ana Paula',
      profilePictureUrl: null,
    },
    department: 'commercial',
    conversationState: 'sent-to-human',
    flowStep: 'quote-send-pending',
    requestStatus: 'under-review',
    resumeState: null,
    assignedTo: null,
    unreadCount: 2,
    version: 7,
    lastInboundAt: '2026-07-21T13:42:00.000Z',
    lastOutboundAt: '2026-07-21T13:38:00.000Z',
    lastMessagePreview: 'Resumo confirmado.',
    closedAt: null,
    createdAt: '2026-07-21T13:35:00.000Z',
    updatedAt: '2026-07-21T13:42:00.000Z',
    currentQuoteRequest: apiQuote(),
    ...overrides,
  };
}

function apiMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000501',
    conversationId,
    providerMessageId: null,
    direction: 'outbound',
    deliveryStatus: 'failed',
    kind: 'document',
    text: 'Segue a proposta.',
    sentBy: {
      id: '00000000-0000-4000-8000-000000000801',
      name: 'Usuário Comercial',
    },
    media: {
      mimeType: 'application/pdf',
      size: 2048,
      url: 'https://files.example.test/proposta.pdf',
      fileName: 'proposta.pdf',
    },
    correlationId: 'outbound:hash',
    occurredAt: '2026-07-21T13:45:00.000Z',
    attempts: [
      {
        id: '00000000-0000-4000-8000-000000000601',
        attemptNumber: 1,
        status: 'failed',
        providerMessageId: null,
        errorCode: 'PROVIDER_TIMEOUT',
        errorMessage: 'Evolution não respondeu.',
        startedAt: '2026-07-21T13:45:00.000Z',
        completedAt: '2026-07-21T13:45:05.000Z',
      },
    ],
    createdAt: '2026-07-21T13:45:00.000Z',
    updatedAt: '2026-07-21T13:45:05.000Z',
    ...overrides,
  };
}

function apiTransition() {
  return {
    id: '00000000-0000-4000-8000-000000000901',
    commandId: '00000000-0000-4000-8000-000000000902',
    name: 'take-over',
    expectedVersion: 6,
    resultingVersion: 7,
    actorType: 'user',
    actorUserId: '00000000-0000-4000-8000-000000000801',
    from: {
      department: 'commercial',
      conversationState: 'sent-to-human',
      flowStep: 'human-service',
      requestStatus: 'under-review',
    },
    to: {
      department: 'commercial',
      conversationState: 'human-active',
      flowStep: 'human-service',
      requestStatus: 'under-review',
    },
    metadata: {},
    createdAt: '2026-07-21T13:44:00.000Z',
  };
}

function apiServiceSession(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000731',
    companyId: '00000000-0000-4000-8000-000000000001',
    threadId: '00000000-0000-4000-8000-000000000741',
    sourceChannelId: '00000000-0000-4000-8000-000000000201',
    currentDepartmentId: '00000000-0000-4000-8000-000000000751',
    responsibleUserId: null,
    queueId: '00000000-0000-4000-8000-000000000732',
    relatedServiceSessionId: null,
    status: 'waiting-human',
    controlMode: 'human',
    priority: 'normal',
    priorityReason: null,
    prioritySource: 'human-user',
    isForeground: true,
    version: 14,
    responsible: null,
    queue: { id: '00000000-0000-4000-8000-000000000732', name: 'Fila principal' },
    availableActions: ['ASSUME', 'RETURN_TO_QUEUE', 'CHANGE_PRIORITY', 'RETURN_TO_AI', 'CLOSE'],
    publicContinuationCode: null,
    continuationCodeExpiresAt: null,
    closingStartedAt: null,
    closingDeadlineAt: null,
    closedAt: null,
    ...overrides,
  };
}

function canonicalMutationFetcher() {
  return jest.fn(async (request: Parameters<typeof fetch>[0], input?: RequestInit) => {
    const url = String(request);
    if (url.endsWith('/service/sessions/assignment-targets')) {
      return jsonResponse([
        {
          id: '00000000-0000-4000-8000-000000000751',
          code: 'operations',
          name: 'Operações',
          isDefault: false,
          queues: [],
          users: [],
        },
      ]);
    }
    if (url.includes('/service/sessions/') && input?.method === 'POST') {
      const body = JSON.parse(String(input.body)) as { expectedVersion: number };
      return jsonResponse(
        apiServiceSession({
          aiClosingStartedAt: '2026-07-21T13:40:00.000Z',
          closingStartedAt: undefined,
          version: body.expectedVersion + 1,
        }),
      );
    }
    if (url.includes('/messages?') || url.includes('/transitions?')) {
      return jsonResponse({
        data: [],
        meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
      });
    }
    return jsonResponse(apiConversation({ version: 14 }));
  });
}

describe('LumeApiWhatsAppConversationRepository', () => {
  it('downloads a valid media response and normalizes its filename safely', async () => {
    const bytes = Uint8Array.from([37, 80, 68, 70]);
    const fetcher = jest.fn().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: {
          'Content-Length': String(bytes.byteLength),
          'Content-Type': 'application/pdf; charset=binary',
          'X-WhatsApp-Media-Filename': encodeURIComponent('../orçamento\r\nfinal.pdf'),
        },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(repository.downloadMessageContent(conversationId, messageId)).resolves.toEqual({
      bytes,
      fileName: 'orçamento__final.pdf',
      mimeType: 'application/pdf',
    });
    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/whatsapp/conversations/${conversationId}/messages/${messageId}/content`,
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('rejects declared and actual zero-byte media responses', async () => {
    const declaredEmpty = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          'Content-Length': '0',
          'Content-Type': 'image/jpeg',
        },
      }),
    );
    const actualEmpty = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    );

    for (const fetcher of [declaredEmpty, actualEmpty]) {
      const repository = new LumeApiWhatsAppConversationRepository(
        'https://tenant.example/api/v1',
        'token',
        fetcher,
      );

      await expect(
        repository.downloadMessageContent(conversationId, messageId),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });

  it('rejects declared and actual media content above the 50 MiB ceiling', async () => {
    const oversizedLength = 50 * 1024 * 1024 + 1;
    const declaredOversized = jest.fn().mockResolvedValue(
      new Response(Uint8Array.from([1]), {
        status: 200,
        headers: {
          'Content-Length': String(oversizedLength),
          'Content-Type': 'image/jpeg',
        },
      }),
    );
    const actualOversized = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(oversizedLength)),
    } as unknown as Response);

    for (const fetcher of [declaredOversized, actualOversized]) {
      const repository = new LumeApiWhatsAppConversationRepository(
        'https://tenant.example/api/v1',
        'token',
        fetcher,
      );

      await expect(
        repository.downloadMessageContent(conversationId, messageId),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    }
  });

  it('rejects a media body that does not match Content-Length', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(Uint8Array.from([1, 2]), {
        status: 200,
        headers: {
          'Content-Length': '5',
          'Content-Type': 'image/jpeg',
        },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(
      repository.downloadMessageContent(conversationId, messageId),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('rejects media without an explicit MIME type', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(Uint8Array.from([1, 2]), {
        status: 200,
        headers: { 'Content-Length': '2' },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(
      repository.downloadMessageContent(conversationId, messageId),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('maps a binary read failure to an invalid Tenant API response', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'Content-Length': '2',
        'Content-Type': 'image/jpeg',
      }),
      arrayBuffer: jest.fn().mockRejectedValue(new Error('stream interrupted')),
    } as unknown as Response);
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(
      repository.downloadMessageContent(conversationId, messageId),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('loads assignment targets from the canonical ServiceSession catalog', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse([
        {
          id: '00000000-0000-4000-8000-000000000751',
          code: 'operations',
          name: 'Operações',
          isDefault: false,
          queues: [
            {
              id: '00000000-0000-4000-8000-000000000761',
              name: 'Fila operacional',
              assignmentStrategy: 'least-load',
              maxConcurrentAttendances: 12,
            },
          ],
          users: [{ id: '00000000-0000-4000-8000-000000000771', name: 'Ana Operadora' }],
        },
      ]),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(repository.getServiceAssignmentTargets()).resolves.toEqual([
      expect.objectContaining({
        code: 'operations',
        queues: [expect.objectContaining({ assignmentStrategy: 'least-load' })],
        users: [expect.objectContaining({ name: 'Ana Operadora' })],
      }),
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant.example/api/v1/service/sessions/assignment-targets',
      expect.any(Object),
    );
  });

  it('maps and validates the paginated list returned by the Tenant API', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [apiConversation()],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
        summary: {
          total: 1,
          botActive: 0,
          attendantActive: 0,
          automationPaused: 1,
          unreadMessages: 2,
          unreadConversations: 1,
        },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'http://localhost:3333/api/v1/',
      'access-token',
      fetcher,
      1_500,
    );

    const [conversation] = await repository.getConversations({
      search: 'Ana',
      department: 'commercial',
      state: 'sent-to-human',
      control: 'paused',
      requestStatus: 'under-review',
    });

    expect(conversation).toMatchObject({
      id: conversationId,
      version: 7,
      contact: { name: 'Ana Paula', phone: '5531999991001' },
      flowStep: 'quote-send-pending',
      currentQuoteRequest: { sequence: 2, status: 'under-review' },
      messages: [],
    });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/whatsapp/conversations?page=1&pageSize=100&search=Ana&department=commercial&state=sent-to-human&control=paused&requestStatus=under-review',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('does not present a telephone number as the contact name', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [
          apiConversation({
            contact: {
              id: '00000000-0000-4000-8000-000000000301',
              phone: '+91 94126-76488',
              displayName: '+919412676488',
              profilePictureUrl: null,
            },
            currentQuoteRequest: null,
          }),
        ],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'http://localhost:3333/api/v1/',
      'access-token',
      fetcher,
      1_500,
    );

    const [conversation] = await repository.getConversations();

    expect(conversation?.contact).toEqual(
      expect.objectContaining({
        name: 'Contato não identificado',
        phone: '+91 94126-76488',
      }),
    );
  });

  it('uses the confirmed quote contact when the imported contact has no real name', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [
          apiConversation({
            contact: {
              id: '00000000-0000-4000-8000-000000000301',
              phone: '(34) 99999-1001',
              displayName: '5534999991001',
              profilePictureUrl: null,
            },
            currentQuoteRequest: apiQuote(),
          }),
        ],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'http://localhost:3333/api/v1/',
      'access-token',
      fetcher,
      1_500,
    );

    const [conversation] = await repository.getConversations();

    expect(conversation?.contact.name).toBe('Ana Paula');
  });

  it('loads only the requested page even when the tenant has thousands of conversations', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [apiConversation()],
        meta: { page: 3, pageSize: 25, total: 12_560, totalPages: 503 },
        summary: {
          total: 12_560,
          botActive: 10,
          attendantActive: 20,
          automationPaused: 30,
          unreadMessages: 40,
          unreadConversations: 5,
        },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'http://localhost:3333/api/v1/',
      'access-token',
      fetcher,
      1_500,
    );

    await expect(
      repository.getConversationPage({ page: 3, pageSize: 25, department: 'controlling' }),
    ).resolves.toMatchObject({
      conversations: [{ id: conversationId }],
      page: 3,
      pageSize: 25,
      total: 12_560,
      totalPages: 503,
      metrics: {
        botActive: 10,
        attendantActive: 20,
        automationPaused: 30,
        unreadMessages: 40,
        unreadConversations: 5,
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/whatsapp/conversations?page=3&pageSize=25&department=controlling',
      expect.any(Object),
    );
  });

  it('uses the dedicated server-scoped endpoint for dashboard indicators', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [apiConversation({ department: 'operations' })],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'http://localhost:3333/api/v1/',
      'access-token',
      fetcher,
      1_500,
    );

    await repository.getDashboardConversations({ department: 'operations' });

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/whatsapp/conversations/dashboard?page=1&pageSize=100&department=operations',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('loads one message page and the transition history with delivery attempts', async () => {
    const historicalRecoveryTransition = {
      ...apiTransition(),
      commandId: 'local-recovery-20382581-b462-4373-a288-e265aea0dca3',
      name: 'repair-retry-routing',
    };
    const automaticInboundTransition = {
      ...apiTransition(),
      id: '00000000-0000-4000-8000-000000000903',
      commandId: `inbound:${'9c'.repeat(32)}`,
      name: 'resume-awaited-reply',
      expectedVersion: 7,
      resultingVersion: 8,
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(apiConversation()))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [apiMessage()],
          meta: { page: 3, pageSize: 100, total: 250, totalPages: 3 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [historicalRecoveryTransition, automaticInboundTransition],
          meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
        }),
      );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    const conversation = await repository.getConversationById(conversationId, 3);

    expect(conversation?.messages).toEqual([
      expect.objectContaining({
        deliveryStatus: 'failed',
        sentBy: {
          id: '00000000-0000-4000-8000-000000000801',
          name: 'Usuário Comercial',
        },
        attachment: expect.objectContaining({
          fileName: 'proposta.pdf',
          url: `/api/whatsapp-conversations/${conversationId}/messages/00000000-0000-4000-8000-000000000501/content`,
        }),
        attempts: [
          expect.objectContaining({
            status: 'failed',
            errorCode: 'PROVIDER_TIMEOUT',
          }),
        ],
      }),
    ]);
    expect(conversation?.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'repair-retry-routing',
          commandId: 'local-recovery-20382581-b462-4373-a288-e265aea0dca3',
          expectedVersion: 6,
          resultingVersion: 7,
          actorType: 'user',
        }),
        expect.objectContaining({
          name: 'resume-awaited-reply',
          commandId: `inbound:${'9c'.repeat(32)}`,
          expectedVersion: 7,
          resultingVersion: 8,
        }),
      ]),
    );
    expect(conversation?.messageHistory).toEqual({
      page: 3,
      pageSize: 100,
      total: 250,
      totalPages: 3,
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `https://tenant.example/api/v1/whatsapp/conversations/${conversationId}/messages?page=3&pageSize=100`,
      expect.any(Object),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      `https://tenant.example/api/v1/whatsapp/conversations/${conversationId}/transitions?page=1&pageSize=100`,
      expect.any(Object),
    );
  });

  it('maps an oversized retained message without exposing a broken content URL', async () => {
    const oversizedVideo = apiMessage({
      direction: 'inbound',
      deliveryStatus: 'received',
      kind: 'video',
      text: null,
      media: {
        mimeType: 'video/mp4',
        size: 52_428_801,
        fileName: 'video-grande.mp4',
        retentionStatus: 'too-large',
      },
      attempts: [],
    });
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(apiConversation()))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [oversizedVideo],
          meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [],
          meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        }),
      );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    const conversation = await repository.getConversationById(conversationId);

    expect(conversation?.messages[0]?.attachment).toMatchObject({
      fileName: 'video-grande.mp4',
      retentionStatus: 'too-large',
      url: null,
    });
  });

  it('does not expose internal dispatch claims or transition persistence fields', async () => {
    const message = apiMessage();
    const transition = apiTransition();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(apiConversation()))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              ...message,
              attempts: message.attempts.map((attempt) => ({
                ...attempt,
                dispatchClaimId: '00000000-0000-4000-8000-000000000699',
                dispatchFingerprint: 'internal-dispatch-fingerprint',
                dispatchClaimedAt: '2026-07-21T13:45:01.000Z',
                dispatchState: 'leased',
                dispatchOwnerId: 'n8n-worker-01',
                dispatchLeaseUntil: '2026-07-21T13:50:01.000Z',
              })),
            },
          ],
          meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              ...transition,
              companyId: '00000000-0000-4000-8000-000000000001',
              payloadHash: 'internal-hash',
              from: { ...transition.from, resumeState: 'bot-active' },
              to: { ...transition.to, resumeState: null },
            },
          ],
          meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
        }),
      );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    const conversation = await repository.getConversationById(conversationId);
    const attempt = conversation?.messages[0]?.attempts[0];
    const mappedTransition = conversation?.transitions[0];

    expect(attempt).toBeDefined();
    expect(attempt).not.toHaveProperty('dispatchClaimId');
    expect(attempt).not.toHaveProperty('dispatchFingerprint');
    expect(attempt).not.toHaveProperty('dispatchClaimedAt');
    expect(attempt).not.toHaveProperty('dispatchState');
    expect(attempt).not.toHaveProperty('dispatchOwnerId');
    expect(attempt).not.toHaveProperty('dispatchLeaseUntil');
    expect(mappedTransition).toBeDefined();
    expect(mappedTransition).not.toHaveProperty('companyId');
    expect(mappedTransition).not.toHaveProperty('payloadHash');
    expect(mappedTransition?.from).not.toHaveProperty('resumeState');
    expect(mappedTransition?.to).not.toHaveProperty('resumeState');
  });

  it('sends expectedVersion and a unique commandId in every real panel action', async () => {
    const fetcher = canonicalMutationFetcher();
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await repository.takeOverConversation(conversationId, 7);
    await repository.returnConversationToBot(conversationId, 8);
    await repository.forwardConversation(conversationId, 'operations', 9);
    await repository.markConversationAsRead(conversationId, 10);
    await repository.closeConversationAfterRejection(conversationId, 11);
    await repository.closeConversation(conversationId, 12, 'Solicitação concluída.');

    const requests = fetcher.mock.calls
      .filter(([, init]) => (init as RequestInit).method === 'POST')
      .map(([url, init]) => [url, JSON.parse((init as RequestInit).body as string)] as const);
    expect(requests.map(([url]) => url)).toEqual([
      expect.stringContaining('/service/sessions/'),
      expect.stringContaining('/actions/return-to-ai'),
      expect.stringContaining('/actions/transfer'),
      expect.stringContaining('/actions/mark-read'),
      expect.stringContaining('/actions/close-after-rejection'),
      expect.stringContaining('/service/sessions/'),
    ]);
    expect(requests.map(([, body]) => body.expectedVersion)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(requests[0][0]).toContain('/actions/assume');
    expect(requests[2][1]).toMatchObject({
      departmentId: '00000000-0000-4000-8000-000000000751',
    });
    expect(requests[5][1]).toMatchObject({ reason: 'Solicitação concluída.' });
    expect(requests.every(([, body]) => /^[0-9a-f-]{36}$/.test(body.commandId))).toBe(true);
  });

  it('confirms a transfer even when the source account loses access to the target department', async () => {
    let transferred = false;
    const fetcher = jest.fn(async (_url: Parameters<typeof fetch>[0], input?: RequestInit) => {
      if (input?.method === 'POST') {
        transferred = true;
        return jsonResponse(apiServiceSession({ version: 15, queueId: null, queue: null }));
      }
      if (transferred) return new Response(null, { status: 403 });
      return jsonResponse(apiConversation({ version: 14 }));
    });
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    const result = await repository.transferServiceSession(conversationId, {
      serviceSessionId: apiServiceSession().id,
      commandId: '00000000-0000-4000-8000-000000000904',
      expectedVersion: 14,
      departmentId: apiServiceSession().currentDepartmentId,
    });

    expect(result.currentServiceSession).toMatchObject({
      version: 15,
      controlMode: 'HUMAN',
      status: 'WAITING_HUMAN',
      queueId: null,
    });
    expect(fetcher.mock.calls.map(([, input]) => input?.method)).toEqual(['GET', 'POST']);
  });

  it('starts a canonical human conversation by phone', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse(
        apiConversation({
          conversationState: 'human-active',
          flowStep: 'human-service',
          assignedTo: {
            id: '00000000-0000-4000-8000-000000000801',
            name: 'Atendente Comercial',
          },
        }),
      ),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(repository.startConversation('5534987654321')).resolves.toMatchObject({
      id: conversationId,
      conversationState: 'human-active',
      assignedTo: { name: 'Atendente Comercial' },
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant.example/api/v1/whatsapp/conversations',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const requestBody = JSON.parse(
      (fetcher.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(requestBody).toMatchObject({ phone: '5534987654321' });
    expect(requestBody.commandId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('maps HTTP 409 and details.currentVersion to a typed conflict', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          code: 'CONFLICT',
          message: 'A conversa foi alterada por outro comando.',
          details: { currentVersion: 12 },
        },
        409,
      ),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(repository.takeOverConversation(conversationId, 7)).rejects.toEqual(
      expect.objectContaining<Partial<WhatsAppConversationRepositoryError>>({
        code: 'conflict',
        currentVersion: 12,
      }),
    );
  });

  it('maps HTTP 429 without converting throttling into service unavailability', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ message: 'Aguarde alguns instantes antes de atualizar novamente.' }, 429),
      );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(repository.getConversationPage()).rejects.toMatchObject({
      code: 'too-many-requests',
    });
  });

  it('posts an idempotent human message to the JWT panel endpoint', async () => {
    const message = apiMessage({
      kind: 'text',
      text: 'O seu orçamento está em análise.',
      media: null,
      deliveryStatus: 'pending',
      attempts: [],
    });
    const conversation = apiConversation({
      conversationState: 'human-active',
      flowStep: 'human-service',
      assignedTo: {
        id: '00000000-0000-4000-8000-000000000801',
        name: 'Atendente Comercial',
      },
      version: 8,
    });
    const fetcher = jest.fn().mockResolvedValue(jsonResponse({ message, conversation }));
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );
    const command = {
      commandId: '00000000-0000-4000-8000-000000000701',
      idempotencyKey: '00000000-0000-4000-8000-000000000702',
      expectedVersion: 7,
      text: 'O seu orçamento está em análise.',
    };

    await expect(repository.sendHumanMessage(conversationId, command)).resolves.toMatchObject({
      conversation: { id: conversationId, version: 8 },
      message: { deliveryStatus: 'pending', text: command.text },
    });
    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/whatsapp/conversations/${conversationId}/messages`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(command),
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('rejects a success payload outside the real DTO contract', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [{ ...apiConversation(), version: '7' }],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await expect(repository.getConversations()).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('maps the native ServiceSession and operational evidence without merging lifecycle and control', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [
          apiConversation({
            sourceChannel: {
              id: 'channel-whatsapp-1',
              name: 'WhatsApp Matriz',
              type: 'WHATSAPP',
              address: '5531999990000',
            },
            currentServiceSession: {
              id: 'service-session-1',
              companyId: '00000000-0000-4000-8000-000000000001',
              threadId: 'thread-1',
              sourceChannelId: 'channel-whatsapp-1',
              currentDepartmentId: 'commercial',
              responsibleUserId: 'user-1',
              queueId: 'queue-1',
              relatedServiceSessionId: null,
              status: 'WAITING_CUSTOMER',
              controlMode: 'HUMAN',
              priority: 'HIGH',
              priorityReason: 'Prazo próximo',
              prioritySource: 'HUMAN_USER',
              isForeground: true,
              version: 13,
              responsible: { id: 'user-1', name: 'Maria Souza' },
              queue: { id: 'queue-1', name: 'Comercial prioritário' },
              availableActions: [
                'TRANSFER_DEPARTMENT',
                'RETURN_TO_QUEUE',
                'CHANGE_PRIORITY',
                'RETURN_TO_AI',
              ],
              closingStartedAt: null,
              closingDeadlineAt: null,
              closedAt: null,
            },
            evidence: {
              agentExecutions: [
                {
                  id: 'execution-1',
                  name: 'Agente comercial',
                  status: 'SUCCEEDED',
                  summary: 'Classificou intenção comercial.',
                  createdAt: '2026-07-21T13:41:00.000Z',
                  metadata: {
                    decision: { route: 'commercial' },
                    apiKey: 'must-not-reach-the-browser',
                  },
                },
              ],
              knowledgeSources: [
                {
                  id: 'source-1',
                  title: 'Política comercial v4',
                  url: 'https://docs.example.test/politica-v4',
                },
              ],
              toolExecutions: [
                { id: 'tool-1', name: 'consultar_disponibilidade', status: 'SUCCEEDED' },
              ],
              mediaInterpretations: [],
              registrationDataReviews: [],
            },
          }),
        ],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    const [conversation] = await repository.getConversations();

    expect(conversation.currentServiceSession).toMatchObject({
      id: 'service-session-1',
      status: 'WAITING_CUSTOMER',
      controlMode: 'HUMAN',
      priority: 'HIGH',
      projection: 'NATIVE',
      responsible: { name: 'Maria Souza' },
      queue: { name: 'Comercial prioritário' },
    });
    expect(conversation.sourceChannel).toMatchObject({ name: 'WhatsApp Matriz' });
    expect(conversation.evidence?.knowledgeSources[0]).toMatchObject({
      name: 'Política comercial v4',
    });
    expect(conversation.evidence?.toolExecutions[0]).toMatchObject({
      name: 'consultar_disponibilidade',
      status: 'SUCCEEDED',
    });
    expect(conversation.evidence?.agentExecutions[0].metadata).toEqual({
      decision: { route: 'commercial' },
    });
  });

  it('preserves real message actor and source when the provider reports external human activity', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [
          apiMessage({
            actor: { type: 'EXTERNAL_HUMAN', id: null, name: null },
            source: 'WHATSAPP_APP',
          }),
        ],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
    );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    const result = await repository.searchMessages(conversationId, 'proposta');

    expect(result.messages[0]).toMatchObject({
      actor: { type: 'EXTERNAL_HUMAN', id: null, name: null },
      source: 'WHATSAPP_APP',
    });
  });

  it('forwards caller commandId and expectedVersion for the future queue and priority commands', async () => {
    const fetcher = canonicalMutationFetcher();
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    await repository.returnConversationToQueue(conversationId, {
      serviceSessionId: '00000000-0000-4000-8000-000000000731',
      commandId: '00000000-0000-4000-8000-000000000711',
      expectedVersion: 12,
      queueId: '00000000-0000-4000-8000-000000000732',
    });
    await repository.changeConversationPriority(conversationId, {
      serviceSessionId: '00000000-0000-4000-8000-000000000731',
      commandId: '00000000-0000-4000-8000-000000000712',
      expectedVersion: 13,
      priority: 'URGENT',
      reason: 'Risco operacional',
    });

    const requests = fetcher.mock.calls
      .filter(([, input]) => (input as RequestInit).method === 'POST')
      .map(([url, input]) => [url, JSON.parse((input as RequestInit).body as string)]);
    expect(requests).toEqual([
      [
        expect.stringContaining('/actions/return-to-queue'),
        {
          commandId: '00000000-0000-4000-8000-000000000711',
          expectedVersion: 12,
          queueId: '00000000-0000-4000-8000-000000000732',
        },
      ],
      [
        expect.stringContaining('/actions/change-priority'),
        {
          commandId: '00000000-0000-4000-8000-000000000712',
          expectedVersion: 13,
          priority: 'urgent',
          reason: 'Risco operacional',
        },
      ],
    ]);
  });

  it('reconciles a canonical ServiceSession action envelope with the authoritative conversation', async () => {
    const serviceSession = {
      id: 'service-session-1',
      companyId: '00000000-0000-4000-8000-000000000001',
      threadId: 'thread-1',
      sourceChannelId: '00000000-0000-4000-8000-000000000201',
      currentDepartmentId: 'commercial',
      responsibleUserId: null,
      queueId: 'queue-1',
      relatedServiceSessionId: null,
      status: 'waiting-human',
      controlMode: 'human',
      priority: 'urgent',
      priorityReason: 'Risco operacional',
      prioritySource: 'HUMAN_USER',
      isForeground: true,
      version: 22,
      responsible: null,
      queue: { id: 'queue-1', name: 'Fila urgente' },
      availableActions: ['ASSUME', 'RETURN_TO_QUEUE', 'CHANGE_PRIORITY', 'CLOSE'],
      closingStartedAt: null,
      closingDeadlineAt: null,
      closedAt: null,
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ snapshot: serviceSession, resultingVersion: 22 }))
      .mockResolvedValueOnce(jsonResponse(apiConversation({ version: 22 })))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [],
          meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [],
          meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        }),
      );
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    const conversation = await repository.changeConversationPriority(conversationId, {
      serviceSessionId: '00000000-0000-4000-8000-000000000731',
      commandId: '00000000-0000-4000-8000-000000000713',
      expectedVersion: 21,
      priority: 'URGENT',
      reason: 'Risco operacional',
    });

    expect(conversation.currentServiceSession).toMatchObject({
      status: 'WAITING_HUMAN',
      controlMode: 'HUMAN',
      priority: 'URGENT',
      version: 22,
      projection: 'NATIVE',
      queue: { name: 'Fila urgente' },
    });
  });

  it('accepts the direct ServiceSession returned by the current canonical controller', async () => {
    const fetcher = canonicalMutationFetcher();
    const repository = new LumeApiWhatsAppConversationRepository(
      'https://tenant.example/api/v1',
      'token',
      fetcher,
    );

    const conversation = await repository.takeOverConversation(
      conversationId,
      14,
      '00000000-0000-4000-8000-000000000714',
      '00000000-0000-4000-8000-000000000731',
    );

    expect(conversation.currentServiceSession).toMatchObject({
      status: 'WAITING_HUMAN',
      controlMode: 'HUMAN',
      version: 15,
      projection: 'NATIVE',
      closingStartedAt: '2026-07-21T13:40:00.000Z',
    });
  });
});
