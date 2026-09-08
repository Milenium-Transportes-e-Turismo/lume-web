import { proxyRegistrationContactExport } from './registration-contact-export-gateway';

jest.mock('server-only', () => ({}));
jest.mock('@/env.server', () => ({
  getTenantApiConfig: () => ({ baseUrl: 'https://tenant.test/api/v1' }),
}));

describe('registration contact export API boundary', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  it('validates previews instead of passing an invalid API contract to the page', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(Response.json({ contacts: [] }));
    const response = await proxyRegistrationContactExport(
      'token',
      new Request('https://web.test/api/registration-contact-export'),
    );
    expect(response.status).toBe(502);
  });

  it('forwards a Google CSV from the Tenant API with private download headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('First Name,Phone 1 - Value\r\nJosé,+5534999990000\r\n', {
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename="lume-google-contacts-1.csv"',
        },
      }),
    );
    const response = await proxyRegistrationContactExport(
      'token',
      new Request('https://web.test/api/registration-contact-export', {
        method: 'POST',
        body: JSON.stringify({ commandId: '11111111-1111-4111-8111-111111111111', batch: 1 }),
      }),
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-disposition')).toContain('lume-google-contacts-1.csv');
    expect(await response.text()).toContain('José,+5534999990000');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://tenant.test/api/v1/registrations/contact-export',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('preserves the public API error code for support', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      Response.json({ message: 'A cota foi atingida.', code: 'VALIDATION_ERROR' }, { status: 400 }),
    );
    const response = await proxyRegistrationContactExport(
      'token',
      new Request('https://web.test/api/registration-contact-export'),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'A cota foi atingida.',
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects invalid requests before contacting the API', async () => {
    const response = await proxyRegistrationContactExport(
      'token',
      new Request('https://web.test/api/registration-contact-export?batch=-1'),
    );
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('can replay the same export request after authentication refresh without consuming its body', async () => {
    const incoming = new Request('https://web.test/api/registration-contact-export', {
      method: 'POST',
      body: JSON.stringify({ commandId: '11111111-1111-4111-8111-111111111111', batch: 1 }),
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response('First Name', { headers: { 'content-type': 'text/csv' } }),
      );
    await expect(proxyRegistrationContactExport('expired', incoming)).rejects.toMatchObject({
      code: 'unauthorized',
    });
    expect((await proxyRegistrationContactExport('renewed', incoming)).status).toBe(200);
    expect(incoming.bodyUsed).toBe(false);
  });

  it('allows the shared authentication flow to refresh a revoked token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      proxyRegistrationContactExport(
        'token',
        new Request('https://web.test/api/registration-contact-export'),
      ),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });
});
