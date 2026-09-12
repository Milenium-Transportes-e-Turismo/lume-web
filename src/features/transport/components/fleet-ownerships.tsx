'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { CommandForm, Fields, Info, rowLabel, type Row } from './transport-ui';

export function FleetOwnerships({
  fleet,
  canUpdate,
  onSaved,
}: {
  fleet: Row;
  canUpdate: boolean;
  onSaved: (row: Row) => void;
}) {
  const [adding, setAdding] = useState(false);
  const items = Array.isArray(fleet.ownerships)
    ? (fleet.ownerships as Record<string, unknown>[])
    : [];
  return (
    <div className="space-y-3">
      <h4 className="font-medium">Empresa prestadora por vigência</h4>
      <Info>
        O vínculo cadastral inicial é preservado. Encerre a vigência anterior antes de mudar a
        empresa da frota; registros antigos continuam usando a vigência correspondente.
      </Info>
      {items.map((period) => (
        <article key={String(period.id)} className="space-y-3 rounded-lg border p-3">
          <Fields
            values={[
              [
                'Empresa prestadora',
                period.supplier && typeof period.supplier === 'object'
                  ? rowLabel(
                      ((period.supplier as Record<string, unknown>).registration ??
                        period.supplier) as Record<string, unknown>,
                    )
                  : period.supplierRegistrationId,
              ],
              ['Início', String(period.validFrom).slice(0, 10)],
              [
                'Fim',
                period.validUntil ? String(period.validUntil).slice(0, 10) : 'Sem data final',
              ],
            ]}
          />
          {canUpdate && !period.validUntil && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">Encerrar vínculo</summary>
              <CommandForm
                fields={[
                  { name: 'validUntil', label: 'Fim de vigência', type: 'date', required: true },
                ]}
                initial={{ id: fleet.id, version: fleet.version }}
                path={'fleet/' + fleet.id + '/ownerships/' + period.id}
                method="PATCH"
                onSaved={onSaved}
                label="Encerrar vigência"
              />
            </details>
          )}
        </article>
      ))}
      {canUpdate &&
        (adding ? (
          <CommandForm
            fields={[
              {
                name: 'supplierRegistrationId',
                label: 'Empresa prestadora (nome fantasia)',
                lookup: 'companies',
                required: true,
              },
              { name: 'validFrom', label: 'Início de vigência', required: true, type: 'date' },
              { name: 'validUntil', label: 'Fim de vigência', type: 'date' },
            ]}
            initial={{ id: fleet.id, version: fleet.version }}
            path={'fleet/' + fleet.id + '/ownerships'}
            onSaved={(row) => {
              setAdding(false);
              onSaved(row);
            }}
            onCancel={() => setAdding(false)}
            label="Salvar vínculo"
          />
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            Vincular empresa por vigência
          </Button>
        ))}
    </div>
  );
}
