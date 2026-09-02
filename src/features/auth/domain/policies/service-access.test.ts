import type { EmployeeUser } from '../entities';
import {
  hasLegacyWhatsAppManagement,
  hasServiceCapability,
  SERVICE_CAPABILITIES,
} from './service-access';

function user(permissions: EmployeeUser['permissions'], isActive = true): EmployeeUser {
  return {
    id: 'employee-001',
    name: 'Atendente',
    type: 'employee',
    departments: ['operations'],
    permissions,
    clientCategory: null,
    isActive,
  };
}

describe('service access policy', () => {
  it.each(SERVICE_CAPABILITIES)(
    'accepts the exact canonical service:%s permission',
    (capability) => {
      expect(hasServiceCapability(user([`service:${capability}`]), capability)).toBe(true);
    },
  );

  it('does not infer sibling capabilities from a canonical permission', () => {
    const attendant = user(['service:respond']);

    expect(hasServiceCapability(attendant, 'respond')).toBe(true);
    expect(hasServiceCapability(attendant, 'assume')).toBe(false);
    expect(hasServiceCapability(attendant, 'transfer')).toBe(false);
    expect(hasServiceCapability(attendant, 'priority')).toBe(false);
    expect(hasServiceCapability(attendant, 'close')).toBe(false);
  });

  it('keeps the legacy permissions as explicit compatibility aliases', () => {
    const viewer = user(['whatsapp-conversations:view']);
    const manager = user(['whatsapp-conversations:manage']);

    expect(hasServiceCapability(viewer, 'view')).toBe(true);
    expect(hasServiceCapability(viewer, 'respond')).toBe(false);
    for (const capability of SERVICE_CAPABILITIES) {
      expect(hasServiceCapability(manager, capability)).toBe(true);
    }
    expect(hasLegacyWhatsAppManagement(manager)).toBe(true);
  });

  it('never grants access to inactive users or users without a matching permission', () => {
    expect(hasServiceCapability(user([]), 'view')).toBe(false);
    expect(hasServiceCapability(user(['service:view'], false), 'view')).toBe(false);
    expect(hasLegacyWhatsAppManagement(user([]))).toBe(false);
  });
});
