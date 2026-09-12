'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { CatalogResource } from '../domain/contracts';
import { ExistingContractPicker } from './existing-contract-picker';
import { FleetOwnerships } from './fleet-ownerships';
import { catalogs, fieldsFor, conditionFields, assignmentFields, labels } from './catalog-config';
import {
  CommandForm,
  ErrorNotice,
  Fields,
  Info,
  date,
  display,
  errorText,
  rowLabel,
  transportRequest,
  type Row,
} from './transport-ui';

function reference(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const value = row as Record<string, unknown>;
  return value.registration
    ? reference(value.registration)
    : value.contract
      ? reference(value.contract)
      : rowLabel(value);
}
export function CatalogPanel({
  resource,
  canCreate,
  canUpdate,
  canDeactivate,
  registrationId,
  catalogKind,
}: {
  resource: CatalogResource;
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
  registrationId?: string;
  catalogKind?: string;
}) {
  const config = catalogs[resource];
  const registrationField = resource === 'affiliations' ? 'registrationId' : 'clientRegistrationId';
  const [candidate, setCandidate] = useState<Row | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [data, setData] = useState<{ items: Row[]; total: number }>({ items: [], total: 0 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Row | 'new' | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [periodForm, setPeriodForm] = useState(false);
  const [deactivate, setDeactivate] = useState<Row | null>(null);
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const result = await transportRequest<{ items: Row[]; total: number }>(
        resource +
          '?' +
          new URLSearchParams({
            page: String(page),
            search: submitted,
            ...(registrationId ? { registrationId } : {}),
            ...(catalogKind ? { kind: catalogKind } : {}),
          }),
      );
      if (registrationId && result.items.some((row) => row[registrationField] !== registrationId))
        throw new Error(
          'A API retornou registros de outro cadastro. Recarregue e informe o suporte.',
        );
      setData(result);
      setError('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, [resource, page, submitted, registrationId, registrationField, catalogKind]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function inspect(row: Row, edit = false) {
    setError('');
    try {
      const fresh = await transportRequest<Row>(resource + '/' + row.id);
      if (registrationId && fresh[registrationField] !== registrationId)
        throw new Error('Este registro não pertence ao cadastro aberto.');
      if (edit) setEditor(fresh);
      else {
        setDetail(fresh);
        setPeriodForm(false);
      }
    } catch (err) {
      setError(errorText(err));
    }
  }
  function saved(row?: Row) {
    setEditor(null);
    setCandidate(null);
    setDeactivate(null);
    setPeriodForm(false);
    setSuccess('Alteração salva.');
    if (row && detail?.id === row.id) setDetail(row);
    void load();
  }
  const periods = (detail?.[resource === 'contracts' ? 'conditions' : 'assignments'] ??
    []) as Record<string, unknown>[];
  return (
    <section className="space-y-4" aria-label={config.label}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSubmitted(search);
          }}
        >
          <Input
            aria-label="Pesquisar cadastros"
            placeholder="Pesquisar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-72"
          />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <Button
              onClick={() => {
                setEditor('new');
                setDetail(null);
                setSuccess('');
              }}
            >
              Novo cadastro
            </Button>
          )}
          {resource === 'catalogs' && canCreate && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await transportRequest('catalogs/initialize', {
                    method: 'POST',
                    body: JSON.stringify({ commandId: crypto.randomUUID(), expectedVersion: 0 }),
                  });
                  saved();
                } catch (err) {
                  setError(errorText(err));
                }
              }}
            >
              Adicionar tipos iniciais
            </Button>
          )}
        </div>
      </div>
      {success && (
        <p role="status" className="text-sm">
          {success}
        </p>
      )}
      <ErrorNotice message={error} />
      {editor === 'new' && resource === 'contracts' && (
        <ExistingContractPicker
          registrationId={registrationId}
          selected={candidate}
          onSelected={setCandidate}
        />
      )}
      {editor && (
        <CommandForm
          key={typeof editor === 'string' ? (candidate?.id ?? 'new') : editor.id}
          fields={(candidate && editor === 'new'
            ? fieldsFor(resource).filter((field) =>
                ['supplierRegistrationId', 'modality'].includes(field.name),
              )
            : fieldsFor(resource, editor === 'new' ? undefined : editor)
          ).filter(
            (field) =>
              (!registrationId || field.name !== registrationField) &&
              (!catalogKind || field.name !== 'kind'),
          )}
          initial={editor === 'new' ? undefined : editor}
          path={resource + (editor === 'new' ? '' : '/' + editor.id)}
          method={editor === 'new' ? 'POST' : 'PATCH'}
          transform={(body) => ({
            ...body,
            ...(candidate && editor === 'new'
              ? {
                  existingContractId: candidate.id,
                  ...Object.fromEntries(
                    [
                      'clientRegistrationId',
                      'code',
                      'name',
                      'status',
                      'validFrom',
                      'validUntil',
                    ].map((key) => [key, candidate[key]]),
                  ),
                }
              : {}),
            ...(registrationId ? { [registrationField]: registrationId } : {}),
            ...(catalogKind ? { kind: catalogKind } : {}),
          })}
          onSaved={saved}
          onCancel={() => setEditor(null)}
          label={editor === 'new' ? 'Criar cadastro' : 'Salvar alterações'}
        />
      )}
      {deactivate && (
        <div className="space-y-3 border-y py-4">
          <h3 className="font-semibold">Inativar {rowLabel(deactivate)}</h3>
          <p className="text-sm">
            O histórico será preservado. A empresa deixará de estar disponível para novos vínculos.
          </p>
          <CommandForm
            fields={[]}
            initial={deactivate}
            path={'companies/' + deactivate.id}
            method="DELETE"
            onSaved={saved}
            onCancel={() => setDeactivate(null)}
            label="Confirmar inativação"
          />
        </div>
      )}
      {detail && (
        <div className="space-y-4 border-y py-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{rowLabel(detail)}</h3>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Fechar detalhe
            </Button>
          </div>
          <Fields
            values={config.columns.map(([key, label]) => [
              label,
              labels[String(detail[key])] ?? detail[key],
            ])}
          />
          {resource === 'fleet' && (
            <FleetOwnerships fleet={detail} canUpdate={canUpdate} onSaved={saved} />
          )}
          {(resource === 'contracts' || resource === 'routes') && (
            <>
              <h4 className="font-medium">
                {resource === 'contracts' ? 'Condições por vigência' : 'Contratos por vigência'}
              </h4>
              <Info>
                {resource === 'contracts'
                  ? 'A franquia é opcional. Um contrato mensal não vira meta diária. Sem medições separadas de garagem, o comparativo indicará dados insuficientes quando necessário. Encerre a vigência anterior antes de criar a próxima.'
                  : 'Cada rota pertence a um contrato por vez. Encerre o vínculo anterior antes de associar um novo contrato.'}
              </Info>
              {periods.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma vigência cadastrada.</p>
              )}
              {periods.map((period) => (
                <div key={String(period.id)} className="space-y-3 rounded-lg border p-3">
                  <Fields
                    values={
                      resource === 'contracts'
                        ? [
                            ['Início', String(period.validFrom).slice(0, 10)],
                            [
                              'Fim',
                              period.validUntil
                                ? String(period.validUntil).slice(0, 10)
                                : 'Sem data final',
                            ],
                            ['Comparação', labels[String(period.period)]],
                            ['KM contratado', period.allowanceKm ?? 'Sem franquia'],
                            ['Garagem incluída', period.includeGarage],
                            ['Mês de transição', period.transitionMonth],
                            ['KM de transição', period.transitionAllowanceKm],
                          ]
                        : [
                            ['Contrato', reference(period.contract) || period.contractId],
                            ['Início', String(period.validFrom).slice(0, 10)],
                            [
                              'Fim',
                              period.validUntil
                                ? String(period.validUntil).slice(0, 10)
                                : 'Sem data final',
                            ],
                          ]
                    }
                  />
                  {canUpdate && !period.validUntil && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">
                        Encerrar esta vigência
                      </summary>
                      <div className="mt-3">
                        <CommandForm
                          fields={[
                            {
                              name: 'validUntil',
                              label: 'Fim de vigência',
                              type: 'date',
                              required: true,
                            },
                          ]}
                          initial={{ id: detail.id, version: detail.version }}
                          path={
                            resource +
                            '/' +
                            detail.id +
                            (resource === 'contracts' ? '/conditions/' : '/assignments/') +
                            period.id
                          }
                          method="PATCH"
                          onSaved={saved}
                          label="Salvar fim de vigência"
                        />
                      </div>
                    </details>
                  )}
                </div>
              ))}
              {canUpdate && !periodForm && (
                <Button variant="outline" onClick={() => setPeriodForm(true)}>
                  {resource === 'contracts' ? 'Nova condição de KM' : 'Associar a contrato'}
                </Button>
              )}
              {periodForm && (
                <CommandForm
                  fields={resource === 'contracts' ? conditionFields : assignmentFields}
                  initial={{ id: detail.id, version: detail.version }}
                  path={
                    resource +
                    '/' +
                    detail.id +
                    (resource === 'contracts' ? '/conditions' : '/assignments')
                  }
                  onSaved={saved}
                  onCancel={() => setPeriodForm(false)}
                  label="Salvar nova vigência"
                />
              )}
            </>
          )}
        </div>
      )}
      {busy && <p role="status">Carregando cadastros…</p>}
      {!busy && data.items.length === 0 && !error && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nenhum cadastro encontrado.
        </p>
      )}
      <div className="grid min-w-0 gap-3">
        {data.items.map((row) => (
          <article key={row.id} className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
            <Fields
              values={[
                ...config.columns.map(([key, label]): [string, unknown] => [
                  label,
                  labels[String(row[key])] ??
                    (key.startsWith('valid') && row[key] ? date(row[key]).split(',')[0] : row[key]),
                ]),
                ...(['fleet', 'affiliations', 'contracts'].includes(resource)
                  ? [
                      [
                        'Empresa do cadastro inicial',
                        reference(row.supplier) || display(row.supplierRegistrationId),
                      ] as [string, unknown],
                    ]
                  : []),
                ...(resource === 'affiliations'
                  ? [
                      ['Pessoa', reference(row.registration) || row.registrationId] as [
                        string,
                        unknown,
                      ],
                    ]
                  : []),
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void inspect(row)}>
                Ver detalhes
              </Button>
              {canUpdate && (
                <Button variant="outline" onClick={() => void inspect(row, true)}>
                  Editar
                </Button>
              )}
              {resource === 'companies' && canDeactivate && row.active !== false && (
                <Button variant="destructive" onClick={() => setDeactivate(row)}>
                  Inativar
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      <nav
        aria-label="Paginação de cadastros"
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <Button variant="outline" disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <span className="text-sm">
          Página {page} · {data.total} registros
        </span>
        <Button
          variant="outline"
          disabled={page * 25 >= data.total || busy}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </Button>
      </nav>
    </section>
  );
}
