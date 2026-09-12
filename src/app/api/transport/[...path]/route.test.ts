/** @jest-environment node */
import { GET } from './route';
import { executeTransport } from '@/features/transport/server/execute-transport';
jest.mock('@/features/transport/server/execute-transport', () => ({ executeTransport: jest.fn() }));
const mockExecute = jest.mocked(executeTransport);
const request = jest.fn();
const profile = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  request.mockReset().mockResolvedValue({ items: [], total: 0 });
  mockExecute.mockReset().mockImplementation(async (operation) => operation({ request } as never));
});
it.each(['affiliations', 'contracts', 'contracts/candidates'])(
  'forwards the profile filter and bounded pagination for %s',
  async (path) => {
    const response = await GET(
      new Request(
        'http://localhost/api/transport/' +
          path +
          '?registrationId=' +
          profile +
          '&page=2&pageSize=100',
      ),
      { params: Promise.resolve({ path: path.split('/') }) },
    );
    expect(response.status).toBe(200);
    expect(request).toHaveBeenCalledWith(
      path,
      'GET',
      '?registrationId=' + profile + '&page=2&pageSize=25',
      undefined,
    );
  },
);
it.each(['invalid', profile + '&registrationId=' + profile])(
  'rejects invalid or duplicate profile filters',
  async (value) => {
    const response = await GET(
      new Request('http://localhost/api/transport/contracts?registrationId=' + value),
      { params: Promise.resolve({ path: ['contracts'] }) },
    );
    expect(response.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  },
);
