'use client';

import { SelectValue } from '@/shared/form-select';

export function HumanizedSelectValue({
  labels,
  placeholder = 'Selecione',
}: {
  readonly labels: Readonly<Record<string, string>>;
  readonly placeholder?: string;
}) {
  return (
    <SelectValue placeholder={placeholder}>
      {(value) => labels[String(value)] ?? placeholder}
    </SelectValue>
  );
}
