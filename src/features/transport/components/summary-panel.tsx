'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { TransportSummary } from '../domain/contracts';
import {
  CommandForm,
  ErrorNotice,
  Fields,
  Info,
  Lookup,
  errorText,
  transportRequest,
} from './transport-ui';

const states: Record<string, string> = {
  OPEN: 'Aberto',
  CLOSED: 'Fechado para comparação',
  UNCONFIGURED: 'Estado ainda não definido',
  DAILY: 'Diária',
  MONTHLY: 'Mensal',
  INSUFFICIENT_MEASUREMENTS: 'Medições insuficientes',
  NO_RECORDS: 'Sem registros no período',
  IMPORT_PENDING: 'Importação pendente',
  MAPPING_PENDING: 'Associação de rotas pendente',
  COVERAGE_UNCONFIRMED: 'Cobertura completa não confirmada',
  CONDITION_REQUIRED: 'Condição de KM necessária',
  PARTIAL_PERIOD: 'Consulta contém apenas parte do mês',
  TRANSITION_CONDITION_REQUIRED: 'Condição do mês de transição necessária',
  COMPLETE: 'Completo',
  SUFFICIENT: 'Dados suficientes',
  INSUFFICIENT_DATA: 'Dados insuficientes',
  INSUFFICIENT: 'Dados insuficientes',
  NO_ALLOWANCE: 'Sem franquia configurada',
};
export function SummaryPanel({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<TransportSummary | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(encoded: string) {
    setBusy(true);
    setError('');
    try {
      setData(await transportRequest<TransportSummary>('summary?' + encoded));
      setQuery(encoded);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void load(
      new URLSearchParams({
        contractId: String(form.get('contractId')),
        from: String(form.get('from')),
        to: String(form.get('to')),
      }).toString(),
    );
  }
  return (
    <section className="space-y-4">
      <Info>
        Comparação do KM contratado com o registrado pelo motorista, somando as rotas e veículos do
        contrato. Mês aberto mostra o acumulado. Franquia ausente não é zero. Este comparativo não
        representa cobrança, penalidade, lucro ou perda.
      </Info>
      <form className="grid items-end gap-4 rounded-xl border p-4 md:grid-cols-2" onSubmit={submit}>
        <div className="min-w-0">
          <Lookup
            field={{ name: 'contractId', label: 'Contrato', lookup: 'contracts', required: true }}
            value=""
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            De
            <Input type="date" name="from" required />
          </label>
          <label className="grid gap-1 text-sm">
            Até
            <Input type="date" name="to" required />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Consultando…' : 'Consultar comparação'}
          </Button>
        </div>
      </form>
      <ErrorNotice message={error} />
      {data && (data.unmappedRecords ?? 0) > 0 && (
        <Info>
          Há {data.unmappedRecords} registros sem associação confirmada por vigência no período.
          Revise as rotas de origem para completar a conferência.
        </Info>
      )}
      {data && data.periods.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum período retornado pela API.</p>
      )}
      {data?.periods.map((period) => (
        <article key={period.period} className="space-y-3 rounded-xl border p-4">
          <Fields
            values={[
              ['Período', period.period],
              ['Comparação', states[period.periodicity]],
              ['Estado', states[period.state]],
              ['KM contratado', period.contractedKm ?? 'Sem franquia / condição indisponível'],
              ['KM registrado pelo motorista', period.registeredKm ?? 'Dados insuficientes'],
              [
                'Diferença (registrado − contratado)',
                period.differenceKm ?? 'Comparação ainda indisponível',
              ],
              ['Disponibilidade dos dados', states[period.dataStatus] ?? period.dataStatus],
            ]}
          />
          {canManage && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                Definir estado do período
              </summary>
              <Info>
                O fechamento habilita a comparação do período completo. A reabertura retorna à
                conferência. Não gera cobrança nem lançamento financeiro.
              </Info>
              <CommandForm
                fields={[
                  {
                    name: 'state',
                    label: 'Estado',
                    required: true,
                    choices: [
                      { value: 'OPEN', label: 'Aberto para conferência' },
                      { value: 'CLOSED', label: 'Fechado para comparação' },
                    ],
                  },
                ]}
                initial={{ id: data.contractId, version: period.version ?? 0 }}
                path="summary/period-state"
                reload={async () => {
                  const fresh = await transportRequest<TransportSummary>('summary?' + query);
                  setData(fresh);
                  return {
                    id: fresh.contractId,
                    version:
                      fresh.periods.find((item) => item.period === period.period)?.version ?? 0,
                  };
                }}
                transform={(body) => ({
                  ...body,
                  contractId: data.contractId,
                  period: period.period,
                })}
                label="Salvar estado do período"
                onSaved={() => {
                  void load(query);
                }}
              />
            </details>
          )}
        </article>
      ))}
    </section>
  );
}
