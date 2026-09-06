'use client';

import { MapPin, Search } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import type { RouteLocationSuggestion } from '../application/route-planner-gateway';

type SearchState = {
  query: string;
  status: 'loading' | 'success' | 'error';
  items: readonly RouteLocationSuggestion[];
  message?: string;
};

export function RouteLocationInput({
  id,
  name,
  label,
  value,
  selected,
  onChange,
  onSelect,
  onFocus,
  trailingAction,
}: {
  readonly trailingAction?: ReactNode;
  readonly id: string;
  readonly name?: string;
  readonly label: string;
  readonly value: string;
  readonly selected: RouteLocationSuggestion | null;
  readonly onChange: (value: string) => void;
  readonly onSelect: (value: RouteLocationSuggestion) => void;
  readonly onFocus: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<SearchState | null>(null);
  const cache = useRef(new Map<string, readonly RouteLocationSuggestion[]>());
  const query = value.trim();
  const hasSelection = selected !== null && selected.label === value;
  const eligible =
    open &&
    !hasSelection &&
    query.length >= 3 &&
    !/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(query);
  const current = state?.query === query ? state : null;
  const items = eligible ? (current?.items ?? []) : [];
  const listId = id + '-suggestions';

  useEffect(() => {
    if (!eligible) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      const cached = cache.current.get(query);
      if (cached) {
        setState({ query, status: 'success', items: cached });
        return;
      }
      setState({ query, status: 'loading', items: [] });
      try {
        const response = await fetch('/api/routing/locations?q=' + encodeURIComponent(query), {
          signal: abort.signal,
          cache: 'no-store',
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Não foi possível buscar os locais.');
        if (abort.signal.aborted) return;
        if (cache.current.size >= 20) cache.current.clear();
        cache.current.set(query, body);
        setState({ query, status: 'success', items: body });
      } catch (error) {
        if (abort.signal.aborted) return;
        setState({
          query,
          status: 'error',
          items: [],
          message: error instanceof Error ? error.message : 'Busca indisponível.',
        });
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [eligible, query]);

  function choose(item: RouteLocationSuggestion) {
    onSelect(item);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            id={id}
            name={name ?? id}
            value={value}
            maxLength={180}
            required
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={eligible && items.length > 0}
            aria-controls={listId}
            aria-activedescendant={active >= 0 && items[active] ? listId + '-' + active : undefined}
            aria-describedby={id + '-search-status'}
            className="pr-9"
            placeholder="Cidade, endereço ou CEP"
            onFocus={() => {
              onFocus();
              setOpen(true);
            }}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                setActive(-1);
                return;
              }
              if (!items.length) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((index) => (index + 1) % items.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) => (index <= 0 ? items.length - 1 : index - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                choose(items[Math.max(0, active)]);
              }
            }}
          />
          {hasSelection ? (
            <MapPin
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-primary"
            />
          ) : (
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            />
          )}
        </div>
        {trailingAction}
      </div>
      {hasSelection && (
        <>
          <input type="hidden" name={id + 'Lat'} value={selected.lat} />
          <input type="hidden" name={id + 'Lng'} value={selected.lng} />
        </>
      )}
      {eligible && items.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label={'Sugestões de ' + label.toLowerCase()}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              id={listId + '-' + index}
              type="button"
              role="option"
              aria-selected={index === active}
              className={
                'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm whitespace-normal hover:bg-accent ' +
                (index === active ? 'bg-accent' : '')
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      <p id={id + '-search-status'} role="status" className="text-xs text-muted-foreground">
        {hasSelection
          ? 'Local selecionado no mapa.'
          : eligible
            ? current?.status === 'error'
              ? current.message
              : current?.status === 'success'
                ? items.length
                  ? 'Selecione um local da lista.'
                  : 'Nenhum local encontrado. Inclua cidade ou estado.'
                : 'Buscando locais…'
            : open
              ? 'Digite pelo menos 3 caracteres para buscar.'
              : null}
      </p>
    </div>
  );
}
