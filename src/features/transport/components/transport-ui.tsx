'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

export type Row = Record<string, unknown> & { id: string; version: number };
export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}
export async function transportRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api/transport/' + path, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const value = await response.json().catch(() => null);
  if (!response.ok)
    throw new RequestError(
      value?.message ?? 'Não foi possível consultar a API.',
      response.status,
      value?.code ?? 'HTTP_' + response.status,
    );
  return value as T;
}
export function errorText(error: unknown) {
  return error instanceof RequestError
    ? error.message + ' Código do erro: ' + error.code
    : 'Não foi possível concluir a operação. Tente novamente.';
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      {message}
    </p>
  ) : null;
}
export function Info({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
export function display(value: unknown): string {
  return value === null || value === undefined || value === ''
    ? 'Não informado'
    : typeof value === 'boolean'
      ? value
        ? 'Sim'
        : 'Não'
      : typeof value === 'object'
        ? ''
        : String(value);
}
export function date(value: unknown): string {
  return typeof value === 'string' && value
    ? new Date(value).toLocaleString('pt-BR')
    : 'Não informado';
}
export function Fields({ values }: { values: [string, unknown][] }) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
      {values.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words font-medium">{display(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

type Choice = { value: string; label: string };
export type Field = {
  name: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'date' | 'month' | 'number' | 'decimal' | 'checkbox' | 'time';
  choices?: Choice[];
  lookup?: string;
  completeLookup?: boolean;
  hint?: string;
  placeholder?: string;
  pattern?: string;
  validationMessage?: string;
  immutable?: boolean;
};
export function rowLabel(row: Record<string, unknown>): string {
  return String(
    row.tradeName ||
      row.legalName ||
      row.displayName ||
      row.individualName ||
      row.name ||
      row.fleetCode ||
      row.code ||
      row.id ||
      '',
  );
}
export function Lookup({ field, value }: { field: Field; value: unknown }) {
  const id = useId();
  const [selected, setSelected] = useState(typeof value === 'string' ? value : '');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: Row[]; total: number }>({ items: [], total: 0 });
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const separator = field.lookup?.includes('?') ? '&' : '?';
      void transportRequest<{ items: Row[]; total: number }>(
        field.lookup +
          separator +
          new URLSearchParams({ search, page: String(page), pageSize: '25' }),
        { signal: abort.signal },
      )
        .then((rows) => {
          setResult(rows);
          setError('');
        })
        .catch((err) => {
          if (!abort.signal.aborted) setError(errorText(err));
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [search, page, field.lookup]);
  useEffect(() => {
    if (!selected || selectedLabel) return;
    const path = field.lookup?.split('?')[0];

    let cancelled = false;
    void transportRequest<Row>(path + '/' + encodeURIComponent(selected))
      .then((row) => {
        if (!cancelled) setSelectedLabel(rowLabel(row));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected, selectedLabel, field.lookup]);
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground" htmlFor={id}>
        Pesquisar {field.label.toLocaleLowerCase()}
      </label>
      <Input
        id={id}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Nome ou documento"
      />
      <select
        aria-label={field.label}
        name={field.name}
        required={field.required}
        value={selected}
        onChange={(event) => {
          setSelected(event.target.value);
          setSelectedLabel(
            rowLabel(
              result.items.find((item) => item.id === event.target.value) ?? {
                id: event.target.value,
              },
            ),
          );
        }}
        className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
      >
        <option value="">Selecione</option>
        {selected && !result.items.some((item) => item.id === selected) && (
          <option value={selected}>{selectedLabel || 'Vínculo atual (' + selected + ')'}</option>
        )}
        {result.items.map((row) => (
          <option key={row.id} value={row.id}>
            {rowLabel(row)}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2 text-xs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </Button>
        <span>Página {page}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page * 25 >= result.total}
          onClick={() => setPage(page + 1)}
        >
          Mais opções
        </Button>
      </div>
      <ErrorNotice message={error} />
    </div>
  );
}

export function CompleteLookup({ field, value }: { field: Field; value: unknown }) {
  const [selected, setSelected] = useState(typeof value === 'string' ? value : '');
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      const rows = new Map<string, Row>();
      const separator = field.lookup?.includes('?') ? '&' : '?';
      try {
        for (let page = 1; ; page++) {
          const result = await transportRequest<{ items: Row[]; total: number }>(
            field.lookup + separator + new URLSearchParams({ page: String(page), pageSize: '25' }),
            { signal: abort.signal },
          );
          if (abort.signal.aborted) return;
          for (const row of result.items) rows.set(row.id, row);
          if (page * 25 >= result.total) break;
          if (!result.items.length || page >= 400)
            throw new Error('Não foi possível carregar todas as opções.');
        }
        if (typeof value === 'string' && value && !rows.has(value)) {
          const current = await transportRequest<Row>(
            field.lookup?.split('?')[0] + '/' + encodeURIComponent(value),
            { signal: abort.signal },
          );
          rows.set(current.id, current);
        }
        if (!abort.signal.aborted) {
          setItems([...rows.values()]);
          setError('');
        }
      } catch (err) {
        if (!abort.signal.aborted) setError(errorText(err));
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => abort.abort();
  }, [field.lookup, value]);
  return (
    <div className="space-y-2">
      <select
        aria-label={field.label}
        aria-busy={loading}
        name={field.name}
        required={field.required}
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
      >
        <option value="">
          {loading ? 'Carregando…' : error ? 'Opções indisponíveis' : 'Selecione'}
        </option>
        {selected && !items.some((row) => row.id === selected) && (
          <option value={selected}>Seleção atual</option>
        )}
        {items
          .filter((row) => row.active !== false || row.id === selected)
          .map((row) => (
            <option key={row.id} value={row.id}>
              {rowLabel(row)}
            </option>
          ))}
      </select>
      <ErrorNotice message={error} />
    </div>
  );
}

export function CommandForm({
  fields,
  initial,
  path,
  method = 'POST',
  onSaved,
  onCancel,
  label = 'Salvar',
  includeVersion = true,
  transform,
  reload,
  submitDisabled = false,
}: {
  fields: Field[];
  initial?: Row;
  path: string;
  method?: string;
  onSaved: (row: Row) => void;
  onCancel?: () => void;
  label?: string;
  includeVersion?: boolean;
  reload?: () => Promise<Row>;
  submitDisabled?: boolean;
  transform?: (body: Record<string, unknown>) => Record<string, unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(initial);
  const command = useRef<{ signature: string; id: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    let body: Record<string, unknown> = includeVersion
      ? { expectedVersion: snapshot?.version ?? 0 }
      : {};
    for (const field of fields) {
      const raw = data.get(field.name);
      if (field.immutable && snapshot) continue;
      if (field.type === 'checkbox') body[field.name] = raw === 'on';
      else if (raw !== null && String(raw).trim() !== '')
        body[field.name] =
          field.type === 'number'
            ? Number(raw)
            : field.type === 'decimal'
              ? String(raw).trim().replace(',', '.')
              : String(raw).trim();
      else if (snapshot && !field.required) body[field.name] = null;
    }
    if (transform) body = transform(body);
    const signature = JSON.stringify(body);
    if (command.current?.signature !== signature)
      command.current = { signature, id: crypto.randomUUID() };
    body.commandId = command.current.id;
    try {
      onSaved(await transportRequest<Row>(path, { method, body: JSON.stringify(body) }));
    } catch (err) {
      setError(errorText(err));
      if (err instanceof RequestError && err.status === 409 && snapshot) {
        try {
          const refreshed = reload
            ? await reload()
            : await transportRequest<Row>(path.split('/').slice(0, 2).join('/'));
          setSnapshot(
            path === 'integration'
              ? { ...refreshed, ...(refreshed.settings as Record<string, unknown>) }
              : refreshed,
          );
          command.current = null;
        } catch (refreshError) {
          setError(errorText(refreshError));
        }
      }
    } finally {
      setBusy(false);
    }
  }
  const formKey = String(snapshot?.version ?? 'new');
  return (
    <form onSubmit={submit} className="space-y-4 border-y py-4" aria-label={label}>
      <fieldset key={formKey} disabled={busy} className="grid min-w-0 gap-4 md:grid-cols-2">
        {fields
          .filter((field) => !(field.immutable && snapshot))
          .map((field) => {
            const value = snapshot?.[field.name];
            return (
              <div key={field.name} className="min-w-0 space-y-1">
                {field.lookup ? (
                  <>
                    <p className="text-sm font-medium">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </p>
                    {field.completeLookup ? (
                      <CompleteLookup field={field} value={value} />
                    ) : (
                      <Lookup field={field} value={value} />
                    )}
                  </>
                ) : (
                  <label className="grid gap-1 text-sm font-medium">
                    {field.label}
                    {field.required ? ' *' : ''}
                    {field.choices ? (
                      <select
                        name={field.name}
                        required={field.required}
                        defaultValue={typeof value === 'string' ? value : ''}
                        className="h-9 w-full rounded-md border bg-background px-2"
                      >
                        <option value="">Selecione</option>
                        {field.choices.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        name={field.name}
                        defaultChecked={value === true}
                        className="size-4"
                      />
                    ) : (
                      <Input
                        name={field.name}
                        required={field.required}
                        type={field.type === 'decimal' ? 'text' : (field.type ?? 'text')}
                        inputMode={field.type === 'decimal' ? 'decimal' : undefined}
                        placeholder={field.placeholder}
                        pattern={
                          field.pattern ??
                          (field.type === 'decimal' ? '[0-9]+([.,][0-9]{1,3})?' : undefined)
                        }
                        onInvalid={(event) => {
                          if (
                            field.validationMessage &&
                            event.currentTarget.validity.patternMismatch
                          ) {
                            event.currentTarget.setCustomValidity(field.validationMessage);
                            setError(field.validationMessage);
                          }
                        }}
                        onInput={(event) => {
                          if (field.validationMessage && event.currentTarget.validity.customError) {
                            event.currentTarget.setCustomValidity('');
                            setError('');
                          }
                        }}
                        min={field.type === 'number' ? 0 : undefined}
                        step={field.type === 'number' ? 1 : undefined}
                        defaultValue={
                          value == null
                            ? ''
                            : field.type === 'date'
                              ? String(value).slice(0, 10)
                              : String(value)
                        }
                      />
                    )}
                  </label>
                )}
                {field.hint && (
                  <p className="text-xs font-normal text-muted-foreground">{field.hint}</p>
                )}
              </div>
            );
          })}
      </fieldset>
      <ErrorNotice message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || submitDisabled}>
          {busy ? 'Salvando…' : label}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
