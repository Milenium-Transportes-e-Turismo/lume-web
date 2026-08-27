'use client';

import { useCallback, useEffect, useRef, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface DynamicFilterFormProps extends Omit<
  React.ComponentProps<'form'>,
  'onChange' | 'onSubmit'
> {
  readonly debounceMs?: number;
}

export function DynamicFilterForm({
  children,
  debounceMs = 400,
  ...props
}: DynamicFilterFormProps) {
  const pathname = usePathname();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const apply = useCallback(
    (form: HTMLFormElement) => {
      if (timer.current) clearTimeout(timer.current);
      const query = new URLSearchParams();
      new FormData(form).forEach((rawValue, name) => {
        if (typeof rawValue !== 'string') return;
        const value = rawValue.trim();
        if (value) query.append(name, value);
      });
      const queryString = query.toString();
      const href = queryString ? `${pathname}?${queryString}` : pathname;
      startTransition(() => router.replace(href, { scroll: false }));
    },
    [pathname, router],
  );

  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
      onChange={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
        if (!target.name) return;
        const form = event.currentTarget;
        const waitsForTyping =
          target instanceof HTMLInputElement &&
          ['search', 'text', 'email', 'tel'].includes(target.type);
        if (timer.current) clearTimeout(timer.current);
        if (waitsForTyping) {
          timer.current = setTimeout(() => apply(form), debounceMs);
          return;
        }
        apply(form);
      }}
    >
      {children}
    </form>
  );
}
