'use client';

import type { ComponentProps } from 'react';
import { SelectTrigger as BaseTrigger, SelectItem as BaseItem } from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectValue,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from '@/shared/ui/select';

export function SelectTrigger({ className, ...props }: ComponentProps<typeof BaseTrigger>) {
  return (
    <BaseTrigger
      {...props}
      className={cn(
        'min-w-0 max-w-full gap-2 py-1 text-left whitespace-normal data-[size=default]:h-auto data-[size=default]:min-h-8 data-[size=sm]:h-auto data-[size=sm]:min-h-7 *:data-[slot=select-value]:line-clamp-none [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:whitespace-normal [&>span:first-child]:break-words',
        className,
      )}
    />
  );
}
export function SelectItem({ className, ...props }: ComponentProps<typeof BaseItem>) {
  return (
    <BaseItem
      {...props}
      className={cn(
        '[&>span:first-child]:min-w-0 [&>span:first-child]:shrink [&>span:first-child]:whitespace-normal [&>span:first-child]:break-words',
        className,
      )}
    />
  );
}
