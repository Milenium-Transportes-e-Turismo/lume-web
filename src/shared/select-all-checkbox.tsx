'use client';
import type { ComponentProps } from 'react';
import { Checkbox } from '@/shared/ui/checkbox';

export function SelectAllCheckbox({
  availableValues,
  selectedValues,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Checkbox>, 'checked' | 'defaultChecked' | 'indeterminate'> & {
  readonly availableValues: readonly string[];
  readonly selectedValues: readonly string[];
}) {
  const checked =
    availableValues.length > 0 && availableValues.every((value) => selectedValues.includes(value));
  return (
    <Checkbox {...props} checked={checked} disabled={disabled || availableValues.length === 0} />
  );
}
