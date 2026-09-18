import 'server-only';

import { createAuthenticatedSession } from '../domain';
import { SIMULATED_EMPLOYEE_USERS } from './simulated-users';

export function createLocalDemoSession() {
  return createAuthenticatedSession({
    sessionId: 'local-demo-session',
    userId: 'local-demo-user',
    name: 'Demonstração local',
    type: 'employee',
    departments: [...new Set(SIMULATED_EMPLOYEE_USERS.flatMap((user) => user.departments))],
    isActive: true,
    rememberDevice: false,
  });
}
