import { requireDocumentSession } from './document-page-security';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';

jest.mock('server-only', () => ({}));
jest.mock('@/features/auth/server', () => ({ getCurrentAuthenticatedSession: jest.fn() }));
jest.mock('@/features/auth/domain', () => ({ hasPermission: () => true }));
jest.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(path);
  },
}));

it('allows an administrator without department assignments', async () => {
  const session = { user: { isAdministrator: true, departments: [] } };
  jest.mocked(getCurrentAuthenticatedSession).mockResolvedValue(session as never);
  await expect(requireDocumentSession(true)).resolves.toBe(session);
});
it('keeps the department boundary for a standard account', async () => {
  jest
    .mocked(getCurrentAuthenticatedSession)
    .mockResolvedValue({ user: { isAdministrator: false, departments: [] } } as never);
  await expect(requireDocumentSession(true)).rejects.toThrow('/dashboard');
});
