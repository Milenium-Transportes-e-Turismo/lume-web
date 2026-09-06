'use client';

import { Children, isValidElement, useState, type ComponentProps, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { NativeSelect } from '@/shared/ui/native-select';
import { cn } from '@/shared/lib/utils';

function optionLabels(children: ReactNode): Map<string, ReactNode> {
  const labels = new Map<string, ReactNode>();
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string; children?: ReactNode }>(child)) return;
    if (child.props.value !== undefined)
      labels.set(String(child.props.value), child.props.children);
    else for (const [key, label] of optionLabels(child.props.children)) labels.set(key, label);
  });
  return labels;
}

export function ReadableNativeSelect({
  children,
  className,
  onChange,
  ...props
}: ComponentProps<typeof NativeSelect>) {
  const [selected, setSelected] = useState(String(props.defaultValue ?? ''));
  const labels = optionLabels(children);
  const value = String(props.value ?? selected);
  return (
    <div
      className={cn(
        'relative flex min-h-8 min-w-0 items-center rounded-lg border border-input bg-background px-2.5 py-1 text-sm focus-within:ring-3 focus-within:ring-ring/50',
        className,
      )}
    >
      <span aria-hidden="true" className="min-w-0 flex-1 pr-6 whitespace-normal break-words">
        {labels.get(value) ?? labels.values().next().value}
      </span>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground"
      />
      <NativeSelect
        {...props}
        className="absolute inset-0 h-full w-full [&_select]:h-full [&_select]:opacity-0 [&_svg]:hidden"
        onChange={(event) => {
          setSelected(event.target.value);
          onChange?.(event);
        }}
      >
        {children}
      </NativeSelect>
    </div>
  );
}
