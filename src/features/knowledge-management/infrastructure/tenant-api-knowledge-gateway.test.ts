/** @jest-environment node */

import { TenantApiKnowledgeGateway } from './tenant-api-knowledge-gateway';

const baseId = '00000000-0000-4000-8000-000000000101';
const documentId = '00000000-0000-4000-8000-000000000102';
const versionId = '00000000-0000-4000-8000-000000000103';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const version = {
  id: versionId,
  version: 2,
  status: 'draft',
  content: 'Conteúdo seguro',
  original: null,
  contentHash: 'a'.repeat(64),
  provenance: { source: 'article' },
  effectiveFrom: null,
  effectiveUntil: null,
  publishedAt: null,
  createdAt: '2026-08-29T10:00:00.000Z',
  chunks: [],
};

describe('TenantApiKnowledgeGateway', () => {
  it('loads the knowledge-scoped department catalog', async () => {
    const department = {
      id: '00000000-0000-4000-8000-000000000110',
      code: 'commercial',
      name: 'Comercial',
      isDefault: true,
    };
    const fetcher = jest.fn().mockResolvedValue(jsonResponse([department]));
    const gateway = new TenantApiKnowledgeGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );

    await expect(gateway.listDepartments()).resolves.toEqual([department]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant.example/api/v1/knowledge/departments',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('lists bases and documents through the published routes', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: baseId,
            name: 'Operação',
            description: null,
            enabled: true,
            archivedAt: null,
            documentCount: 1,
            createdAt: '2026-08-29T09:00:00.000Z',
            updatedAt: '2026-08-29T09:00:00.000Z',
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: documentId,
            knowledgeBaseId: baseId,
            title: 'Política de atendimento',
            description: null,
            sourceType: 'article',
            scope: 'tenant',
            visibility: 'customer-safe',
            departmentIds: [],
            archivedAt: null,
            latestVersion: version,
            createdAt: '2026-08-29T09:00:00.000Z',
            updatedAt: '2026-08-29T10:00:00.000Z',
          },
        ]),
      );
    const gateway = new TenantApiKnowledgeGateway(
      'https://tenant.example/api/v1/',
      'access-token',
      fetcher,
    );

    await expect(gateway.listBases()).resolves.toHaveLength(1);
    await expect(gateway.listDocuments(baseId)).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://tenant.example/api/v1/knowledge/bases',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `https://tenant.example/api/v1/knowledge/documents?knowledgeBaseId=${baseId}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends commandId, expectedVersion and content hash to the draft route', async () => {
    const fetcher = jest.fn().mockResolvedValue(jsonResponse({ versionId }));
    const gateway = new TenantApiKnowledgeGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    const input = {
      commandId: '00000000-0000-4000-8000-000000000104',
      expectedVersion: 2,
      expectedContentHash: 'a'.repeat(64),
      content: 'Conteúdo revisado',
    };

    await gateway.updateDraft(documentId, versionId, input);

    expect(fetcher).toHaveBeenCalledWith(
      `https://tenant.example/api/v1/knowledge/documents/${documentId}/versions/${versionId}/draft`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }),
    );
  });

  it('uploads the original as multipart without setting a JSON content type', async () => {
    const fetcher = jest.fn().mockResolvedValue(jsonResponse({ documentId, versionId }));
    const gateway = new TenantApiKnowledgeGateway(
      'https://tenant.example/api/v1',
      'access-token',
      fetcher,
    );
    const file = new File(['conteudo'], 'manual.txt', { type: 'text/plain' });

    await gateway.uploadOriginal({
      commandId: '00000000-0000-4000-8000-000000000104',
      knowledgeBaseId: baseId,
      title: 'Manual',
      scope: 'tenant',
      visibility: 'internal',
      departmentIds: [],
      file,
    });

    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.headers).toEqual(
      expect.not.objectContaining({ 'Content-Type': expect.anything() }),
    );
  });
});
