'use client';

import { RegistrationRouteError } from '@/features/registrations/components';

export default function RegistrationsError({ reset }: { readonly reset: () => void }) {
  return <RegistrationRouteError reset={reset} />;
}
