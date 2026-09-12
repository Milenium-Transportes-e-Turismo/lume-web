'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImportRejections } from './import-rejections';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  CommandForm,
  ErrorNotice,
  Fields,
  Info,
  date,
  errorText,
  transportRequest,
  type Row,
} from './transport-ui';
import type { TransportIssue, TransportRecord } from '../domain/contracts';

export const tripLabels: Record<string, string> = {
  OPEN: 'Aberta',
  RESOLVED: 'Resolvida',
  VERIFIED: 'Verificada',
  PENDING: 'Verificação pendente',
  UNAVAILABLE: 'Verificação indisponível',
  NEGATIVE_DISTANCE: 'KM final menor que inicial',
  SUSPICIOUS_DISTANCE: 'Distância acima do limite configurado',
  ODOMETER_GAP: 'Descontinuidade entre registros',
  SUSPICIOUS_GAP: 'Salto acima do limite configurado',
  INCOMPLETE_READING: 'Leitura incompleta',
  AMBIGUOUS_SEQUENCE: 'Sequência ambígua',
  INCOMPLETE_SEQUENCE: 'Sequência incompleta',
  QUEUED: 'Na fila',
  RUNNING: 'Em andamento',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou',
  DETECTED: 'Divergência detectada',
  CHANGED: 'Dados atualizados',
  RESOLVED_EVENT: 'Divergência resolvida',
  JUSTIFIED: 'Justificativa registrada',
  VERIFICATION_UNAVAILABLE: 'Verificação indisponível',
  UNKNOWN_TIMESTAMPS: 'Horários não informados',
  COVERAGE_NOT_CONFIRMED: 'Cobertura completa ainda não confirmada',
  END_BEFORE_START: 'Retorno anterior à saída',
  TIED_START: 'Horários de saída iguais',
  OVERLAP: 'Registros sobrepostos',
  AMBIGUOUS_NEIGHBOR: 'Registro vizinho ambíguo',
  MAPPED: 'Contrato associado por vigência',
  REVIEW_MAPPING: 'Revisar associação ao contrato',
};
const evidenceLabels: Record<string, string> = {
  startKm: 'KM inicial',
  endKm: 'KM final',
  previousEndKm: 'KM final anterior',
  reportedKm: 'KM registrado',
  distance: 'Distância registrada',
  gapKm: 'Diferença entre registros',
  thresholdKm: 'Limite configurado',
  reason: 'Contexto',
  sequenceComplete: 'Sequência completa confirmada',
  startedAt: 'Saída',
  endedAt: 'Retorno',
  fleet: 'Frota',
  routeName: 'Rota',
  driverName: 'Motorista informado na origem',
  customerName: 'Cliente informado na origem',
  status: 'Situação',
  verificationState: 'Verificação',
};
function evidence(value: unknown): [string, unknown][] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  const context =
    row.context && typeof row.context === 'object' ? (row.context as Record<string, unknown>) : {};
  return Object.entries({ ...row, ...context })
    .filter(([key]) => key in evidenceLabels)
    .map(([key, item]) => [evidenceLabels[key], tripLabels[String(item)] ?? item]);
}
export function History({ history }: { history: Record<string, unknown>[] }) {
  return (
    <div className="space-y-3">
      <h4 className="font-medium">Histórico de detecção, verificação e justificativas</h4>
      {history.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum evento disponível.</p>
      )}
      {history.map((event, index) => (
        <article key={String(event.id ?? index)} className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {tripLabels[String(event.kind)] ?? 'Atualização importada'} · {date(event.createdAt)}
          </p>
          {typeof event.text === 'string' && (
            <p className="whitespace-pre-wrap break-words text-sm">{event.text}</p>
          )}
          {event.actorUserId != null && (
            <p className="break-all text-xs text-muted-foreground">
              Usuário que registrou no Lume: {String(event.actorUserId)}
            </p>
          )}
          {evidence(event.before).length > 0 && (
            <div>
              <h5 className="mb-1 text-xs text-muted-foreground">Antes</h5>
              <Fields values={evidence(event.before)} />
            </div>
          )}
          {evidence(event.after).length > 0 && (
            <div>
              <h5 className="mb-1 text-xs text-muted-foreground">Depois</h5>
              <Fields values={evidence(event.after)} />
            </div>
          )}
        </article>
      ))}
      <p className="text-xs text-muted-foreground">
        Últimos eventos disponíveis. Alterações na Avic não identificam autor ou motivo quando a
        origem não fornece essa informação.
      </p>
    </div>
  );
}
export function TripPanel({
  resource,
  canManage,
}: {
  resource: 'records' | 'issues';
  canManage: boolean;
}) {
  const [vehicle, setVehicle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [filter, setFilter] = useState(resource === 'issues' ? 'status=OPEN' : '');
  const [cursors, setCursors] = useState<string[]>([]);
  const [data, setData] = useState<{
    items: (TransportIssue | TransportRecord)[];
    nextCursor: string | null;
  }>({ items: [], nextCursor: null });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<(TransportIssue | TransportRecord) | null>(null);
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  const command = useRef<{ text: string; version: number; id: string } | null>(null);
  const cursor = cursors.at(-1) ?? '';
  useEffect(() => {
    const abort = new AbortController();
    const loadingTimer = setTimeout(() => {
      setBusy(true);
      void transportRequest<typeof data>(
        resource + '?' + filter + '&limit=25' + (cursor ? '&cursor=' + cursor : ''),
        { signal: abort.signal },
      )
        .then((value) => {
          setData(value);
          setError('');
        })
        .catch((err) => {
          if (!abort.signal.aborted) setError(errorText(err));
        })
        .finally(() => {
          if (!abort.signal.aborted) setBusy(false);
        });
    }, 0);
    return () => {
      clearTimeout(loadingTimer);
      abort.abort();
    };
  }, [resource, filter, cursor, revision]);
  async function inspect(id: string) {
    try {
      setDetail(await transportRequest(resource + '/' + id));
      setError('');
      setConfirmed('');
    } catch (err) {
      setError(errorText(err));
    }
  }
  async function justify() {
    if (!detail || !justification.trim()) return;
    setSaving(true);
    setError('');
    if (
      !command.current ||
      command.current.text !== justification ||
      command.current.version !== detail.version
    )
      command.current = { text: justification, version: detail.version, id: crypto.randomUUID() };
    try {
      await transportRequest('issues/' + detail.id + '/justifications', {
        method: 'POST',
        body: JSON.stringify({
          text: justification,
          expectedVersion: detail.version,
          commandId: command.current.id,
        }),
      });
      await inspect(detail.id);
      setJustification('');
      command.current = null;
      setConfirmed(
        'Justificativa confirmada pela API. A pendência continua sujeita à verificação da origem.',
      );
      setRevision(revision + 1);
    } catch (err) {
      setError(errorText(err));
      if (err && typeof err === 'object' && 'status' in err && err.status === 409) {
        try {
          setDetail(await transportRequest('issues/' + detail.id));
          command.current = null;
        } catch (refreshError) {
          setError(errorText(refreshError));
        }
      }
    } finally {
      setSaving(false);
    }
  }
  const issue = detail && 'guidance' in detail ? (detail as TransportIssue) : null;
  return (
    <section className="space-y-4">
      <Info>
        Os valores são registrados pelo motorista na Avic. Corrija a quilometragem somente na Avic.
        O Lume reconsulta a origem e resolve a pendência quando a divergência desaparece. Uma
        justificativa não altera KM nem confirma correção.
      </Info>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const query = new URLSearchParams();
          if (vehicle) query.set('vehicleId', vehicle.trim());
          if (resource === 'records') {
            if (from) query.set('from', from);
            if (to) query.set('to', to);
          } else if (status) query.set('status', status);
          setFilter(String(query));
          setCursors([]);
          setRevision(revision + 1);
        }}
      >
        <label className="grid gap-1 text-sm">
          Veículo (ID confirmado na Avic)
          <Input value={vehicle} onChange={(event) => setVehicle(event.target.value)} />
        </label>
        {resource === 'records' ? (
          <>
            <label className="grid gap-1 text-sm">
              De
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              Até
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </>
        ) : (
          <label className="grid gap-1 text-sm">
            Situação
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="OPEN">Abertas</option>
              <option value="RESOLVED">Resolvidas</option>
              <option value="">Todas</option>
            </select>
          </label>
        )}
        <Button type="submit" variant="outline">
          Filtrar / atualizar
        </Button>
      </form>
      <ErrorNotice message={error} />
      {confirmed && (
        <p role="status" className="text-sm">
          {confirmed}
        </p>
      )}
      {detail && (
        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {issue ? (tripLabels[issue.code] ?? issue.code) : 'Registro importado'}
            </h3>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Fechar detalhe
            </Button>
          </div>
          {issue ? (
            <>
              <Info>{issue.guidance}</Info>
              <Fields
                values={[
                  ['Situação', tripLabels[issue.status]],
                  ['Verificação', tripLabels[issue.verificationState]],
                  ['Detectada em', date(issue.detectedAt)],
                  ['Última verificação', date(issue.lastVerifiedAt)],
                  ...evidence(issue.context),
                ]}
              />
              {canManage && (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void justify();
                  }}
                >
                  <label className="grid gap-1 text-sm font-medium">
                    Justificativa no Lume
                    <textarea
                      required
                      maxLength={4000}
                      value={justification}
                      onChange={(event) => setJustification(event.target.value)}
                      className="min-h-24 w-full rounded-md border bg-background p-3"
                    />
                  </label>
                  <Button type="submit" disabled={saving || !justification.trim()}>
                    {saving ? 'Salvando…' : 'Registrar justificativa'}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <Fields values={evidence(detail)} />
          )}
          <History
            history={
              Array.isArray(detail.history) ? (detail.history as Record<string, unknown>[]) : []
            }
          />
        </div>
      )}
      {busy && <p role="status">Consultando registros…</p>}
      {!busy && data.items.length === 0 && !error && (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Nenhum registro encontrado para os filtros.
        </p>
      )}
      <div className="grid gap-3">
        {data.items.map((row) => {
          const pending = 'guidance' in row ? (row as TransportIssue) : null;
          const record = row as TransportRecord;
          return (
            <article key={row.id} className="space-y-3 rounded-xl border p-4">
              {pending ? (
                <>
                  <h3 className="font-medium">{tripLabels[pending.code] ?? pending.code}</h3>
                  <Fields
                    values={[
                      ['Veículo Avic', pending.vehicleExternalId],
                      ['Situação', tripLabels[pending.status]],
                      ['Verificação', tripLabels[pending.verificationState]],
                      ...evidence(pending.context),
                    ]}
                  />
                </>
              ) : (
                <Fields
                  values={[
                    ['Frota', record.fleet],
                    ['Registro de origem', record.externalId],
                    ['Veículo Avic', record.vehicleExternalId],
                    ['Rota / Motivo', record.routeName],
                    ['Motorista (origem)', record.driverName],
                    ['Cliente (origem)', record.customerName],
                    ['Saída', date(record.startedAt)],
                    ['Retorno', date(record.endedAt)],
                    ['KM inicial', record.startKm],
                    ['KM final', record.endKm],
                    ['KM registrado pelo motorista', record.reportedKm],
                    [
                      'Contrato',
                      record.mappingStatus === 'MAPPED'
                        ? 'Contrato associado por vigência'
                        : record.mappingStatus === 'AMBIGUOUS'
                          ? 'Associação ambígua: revisar vigências'
                          : 'Associação ao contrato pendente',
                    ],
                  ]}
                />
              )}
              <Button variant="outline" onClick={() => void inspect(row.id)}>
                Ver contexto e histórico
              </Button>
            </article>
          );
        })}
      </div>
      <nav aria-label="Paginação dos registros" className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={!cursors.length || busy}
          onClick={() => setCursors(cursors.slice(0, -1))}
        >
          Anterior
        </Button>
        <span className="text-sm">Página {cursors.length + 1}</span>
        <Button
          variant="outline"
          disabled={!data.nextCursor || busy}
          onClick={() => {
            if (data.nextCursor) setCursors([...cursors, data.nextCursor]);
          }}
        >
          Próxima
        </Button>
      </nav>
    </section>
  );
}

export function ImportPanel({ canManage }: { canManage: boolean }) {
  const [rejectedJob, setRejectedJob] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [analyses, setAnalyses] = useState<Row[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [cursors, setCursors] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [fleet, setFleet] = useState<{ items: Row[]; total: number }>({ items: [], total: 0 });
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetPage, setFleetPage] = useState(1);
  const [vehicles, setVehicles] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const cursor = cursors.at(-1);
  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      transportRequest<{ items: Row[]; nextCursor: string | null }>(
        'imports?limit=25' + (cursor ? '&cursor=' + cursor : ''),
      ),
      transportRequest<{ items: Row[]; nextCursor: string | null }>('analysis?limit=25'),
    ]);
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status === 'rejected') setError(errorText(result.reason));
      else if (index === 0) {
        setJobs(result.value.items);
        setNext(result.value.nextCursor);
      } else setAnalyses(result.value.items);
    }
  }, [cursor]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void transportRequest<{ items: Row[]; total: number }>(
        'fleet?' + new URLSearchParams({ search: fleetSearch, page: String(fleetPage) }),
        { signal: abort.signal },
      )
        .then(setFleet)
        .catch((err) => {
          if (!abort.signal.aborted) setError(errorText(err));
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [fleetSearch, fleetPage]);
  return (
    <section className="space-y-4">
      <Info>
        A importação recebe dados inconsistentes e não depende de análise. Selecione as frotas com
        vínculo Avic confirmado; o período inclui todos os clientes e modalidades desses veículos. A
        análise é solicitada separadamente.
      </Info>
      <ErrorNotice message={error} />
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {canManage && (
        <details open className="space-y-3 rounded-xl border p-4">
          <summary className="cursor-pointer font-semibold">Nova importação por frota</summary>
          <Input
            aria-label="Pesquisar frota para importar"
            placeholder="Pesquisar frota"
            value={fleetSearch}
            onChange={(event) => {
              setFleetSearch(event.target.value);
              setFleetPage(1);
            }}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {fleet.items.map((row) => (
              <label key={row.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <input
                  type="checkbox"
                  disabled={
                    !row.externalVehicleId || row.active === false || row.provider !== 'avic'
                  }
                  checked={!!vehicles[String(row.externalVehicleId)]}
                  onChange={(event) =>
                    setVehicles((previous) => {
                      const value = { ...previous };
                      if (event.target.checked)
                        value[String(row.externalVehicleId)] = String(row.fleetCode);
                      else delete value[String(row.externalVehicleId)];
                      return value;
                    })
                  }
                />
                Frota {String(row.fleetCode)} ·{' '}
                {row.externalVehicleId
                  ? 'Avic ' + String(row.externalVehicleId)
                  : 'Vínculo Avic pendente'}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={fleetPage === 1}
              onClick={() => setFleetPage(fleetPage - 1)}
            >
              Frotas anteriores
            </Button>
            <span className="text-sm">Página {fleetPage}</span>
            <Button
              type="button"
              variant="ghost"
              disabled={fleetPage * 25 >= fleet.total}
              onClick={() => setFleetPage(fleetPage + 1)}
            >
              Mais frotas
            </Button>
          </div>
          <p className="text-sm">
            {Object.values(vehicles).length} frotas selecionadas
            {Object.values(vehicles).length > 0 ? ': ' + Object.values(vehicles).join(', ') : ''}
          </p>
          <CommandForm
            fields={[
              { name: 'from', label: 'De', type: 'date', required: true },
              { name: 'to', label: 'Até', type: 'date', required: true },
            ]}
            path="imports"
            submitDisabled={Object.keys(vehicles).length === 0}
            includeVersion={false}
            transform={(body) => ({ ...body, vehicleIds: Object.keys(vehicles) })}
            label="Solicitar importação"
            onSaved={() => {
              setNotice('Importação registrada na fila da API. Acompanhe o resultado abaixo.');
              void load();
            }}
          />
        </details>
      )}
      {canManage && (
        <details className="space-y-3 rounded-xl border p-4">
          <summary className="cursor-pointer font-semibold">
            Analisar ou reanalisar dados importados
          </summary>
          <CommandForm
            fields={[
              { name: 'vehicleId', label: 'ID confirmado do veículo na Avic', required: true },
              { name: 'from', label: 'De', type: 'date', required: true },
              { name: 'to', label: 'Até', type: 'date', required: true },
            ]}
            path="analysis"
            includeVersion={false}
            label="Solicitar análise"
            onSaved={() => {
              setNotice('Análise registrada na fila da API.');
              void load();
            }}
          />
        </details>
      )}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Importações</h3>
        <Button
          variant="outline"
          onClick={() => {
            setError('');
            void load();
          }}
        >
          Atualizar andamento
        </Button>
      </div>
      {jobs.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma importação nesta página.</p>
      )}
      {jobs.map((job) => (
        <article key={job.id} className="space-y-3 rounded-xl border p-4">
          <Fields
            values={[
              ['Situação', tripLabels[String(job.status)] ?? job.status],
              ['De', job.from],
              ['Até', job.to],
              ['Registros importados', job.imported],
              ['Registros rejeitados', job.rejected],
              ['Veículos', Array.isArray(job.vehicleIds) ? job.vehicleIds.join(', ') : null],
              ['Última atualização', date(job.updatedAt)],
            ]}
          />
          {typeof job.lastError === 'string' && <ErrorNotice message={job.lastError} />}
          <Button variant="outline" onClick={() => setRejectedJob(job.id)}>
            Ver rejeições
          </Button>
          {canManage && job.status === 'FAILED' && (
            <CommandForm
              fields={[]}
              initial={job}
              path={'imports/' + job.id + '/resume'}
              label="Retomar importação"
              onSaved={() => {
                setNotice('Retomada confirmada pela API.');
                void load();
              }}
            />
          )}
        </article>
      ))}
      {rejectedJob && (
        <ImportRejections
          key={rejectedJob}
          jobId={rejectedJob}
          onClose={() => setRejectedJob(null)}
        />
      )}
      <nav aria-label="Paginação das importações" className="flex justify-between gap-2">
        <Button
          variant="outline"
          disabled={!cursors.length}
          onClick={() => setCursors(cursors.slice(0, -1))}
        >
          Anterior
        </Button>
        <span className="text-sm">Página {cursors.length + 1}</span>
        <Button
          variant="outline"
          disabled={!next}
          onClick={() => {
            if (next) setCursors([...cursors, next]);
          }}
        >
          Próxima
        </Button>
      </nav>
      <h3 className="font-semibold">Últimas análises</h3>
      {analyses.map((job) => (
        <article key={job.id} className="space-y-2 rounded-xl border p-4">
          <Fields
            values={[
              ['Situação', tripLabels[String(job.status)] ?? job.status],
              ['Registros analisados', job.processed],
              ['Solicitada em', date(job.createdAt)],
            ]}
          />
          {typeof job.lastError === 'string' && <ErrorNotice message={job.lastError} />}
        </article>
      ))}
    </section>
  );
}
