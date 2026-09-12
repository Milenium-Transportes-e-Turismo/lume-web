jest.mock('server-only', () => ({}));
jest.mock('@/env.server', () => ({
  getTenantApiConfig: () => ({ baseUrl: 'https://tenant.example/api/v1', timeoutMs: 1000 }),
}));

import { TransportGateway } from './transport-gateway';

function response(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe('TransportGateway', () => {
  it('uses only the Tenant API and keeps bearer tokens out of response projections', async () => {
    const fetcher = jest.fn().mockResolvedValue(response(200, { items: [], total: 0 }));
    const value = await new TransportGateway('private-token', fetcher).request(
      'lookups/registrations',
      'GET',
      '?search=Ana&page=2',
    );
    expect(fetcher).toHaveBeenCalledWith(
      'https://tenant.example/api/v1/registrations?search=Ana&page=2',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: 'Bearer private-token' }),
      }),
    );
    expect(value).toEqual({ items: [], total: 0 });
  });
  it('preserves conflict code without pretending a write succeeded', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(response(409, { code: 'VERSION_CONFLICT', message: 'stale' }));
    await expect(
      new TransportGateway('token', fetcher).request('companies/c1', 'PATCH', '', {
        commandId: 'same-command',
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' });
  });
  it('rejects invalid response shapes rather than displaying an empty successful import', async () => {
    const fetcher = jest.fn().mockResolvedValue(response(200, { items: [], total: 0 }));
    await expect(new TransportGateway('token', fetcher).request('imports')).rejects.toMatchObject({
      code: 'TRANSPORT_INVALID_RESPONSE',
    });
  });
  it('never forwards a request to correct Avic odometers', async () => {
    const fetcher = jest.fn();
    await expect(
      new TransportGateway('token', fetcher).request('records/r1', 'PATCH', '', { startKm: '1' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSPORT_OPERATION' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
