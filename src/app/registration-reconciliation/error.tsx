'use client';

import { RegistrationRouteError } from '@/features/registrations/components';

export default function RegistrationReconciliationError({ reset }: { readonly reset: () => void }) {
  return <RegistrationRouteError reset={reset} />;
}
