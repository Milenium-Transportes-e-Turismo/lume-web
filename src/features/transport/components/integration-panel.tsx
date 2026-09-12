'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/shared/ui/button';
import type { TransportIntegration } from '../domain/contracts';
import {
  CommandForm,
  ErrorNotice,
  Fields,
  Info,
  errorText,
  transportRequest,
} from './transport-ui';

export function IntegrationPanel({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<TransportIntegration | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try {
      setData(await transportRequest('integration'));
      setError('');
    } catch (err) {
      setError(errorText(err));
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <section className="space-y-4">
      <Info>
        A rotina diária pertence à API do Lume. Importa os veículos com vínculo Avic confirmado e
        revisita pendências anteriores. Segredos e endereço da Avic são configurados somente no
        serviço da API.
      </Info>
      <ErrorNotice message={error} />
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <Button variant="outline" onClick={() => void load()}>
        Atualizar configuração
      </Button>
      {data && (
        <>
          <Fields
            values={[
              ['Integração habilitada', data.enabled],
              ['Requisitos de ativação atendidos', data.configured],
            ]}
          />
          {data.activationRequirements.length > 0 && (
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">Requisitos para ativação</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                {data.activationRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </div>
          )}
          {canManage ? (
            <CommandForm
              key={data.version}
              initial={{
                ...data.settings,
                id: data.id ?? 'integration',
                version: data.version,
                enabled: data.enabled,
              }}
              path="integration"
              method="PATCH"
              fields={[
                { name: 'enabled', label: 'Habilitar integração', type: 'checkbox' },
                { name: 'scheduleTime', label: 'Horário diário', type: 'time', required: true },
                {
                  name: 'timezone',
                  label: 'Fuso da rotina',
                  required: true,
                  hint: 'Exemplo: America/Sao_Paulo.',
                },
                {
                  name: 'lookbackDays',
                  label: 'Janela de revisita recente (dias)',
                  type: 'number',
                  required: true,
                },
                {
                  name: 'externalIdField',
                  label: 'Identificador único da viagem na Avic',
                  hint: 'Identifica cada viagem. O número da frota identifica o veículo.',
                },
                {
                  name: 'sourceUtcOffset',
                  label: 'Fuso confirmado dos horários de origem',
                  placeholder: 'Ex.: -03:00',
                  pattern: '(?:\\+|-)(?:0[0-9]|1[0-4]):[0-5][0-9]',
                  validationMessage:
                    'Informe o fuso confirmado pela Avic com sinal e números, como -03:00 ou +00:00. Se ainda não foi confirmado, deixe o campo em branco.',
                  hint: 'Diferença em relação ao UTC, confirmada pela Avic. Exemplo: -03:00 significa UTC−3; não é um valor padrão. Se ainda não souber, deixe em branco.',
                },
                {
                  name: 'maxGapKm',
                  label: 'Diferença de odômetro entre viagens (KM, opcional)',
                  hint: 'Diferença entre o KM final anterior e o KM inicial seguinte do mesmo veículo.',
                  type: 'decimal',
                },
                {
                  name: 'sequenceComplete',
                  label: 'Cobertura de todos os clientes e deslocamentos confirmada',
                  type: 'checkbox',
                  hint: 'Marque somente após confirmar a cobertura na origem. Sequências incompletas precisam de contexto, não de atribuição de responsabilidade.',
                },
              ]}
              transform={(body) => {
                const { commandId, expectedVersion, enabled, ...settings } = body;
                return {
                  commandId,
                  expectedVersion,
                  enabled,
                  settings: {
                    ...settings,
                    externalIdField: settings.externalIdField ?? '',
                    sourceUtcOffset: settings.sourceUtcOffset ?? '',
                    maxTripKm: null,
                    maxGapKm:
                      settings.maxGapKm == null
                        ? null
                        : Number(String(settings.maxGapKm).replace(',', '.')),
                  },
                };
              }}
              onSaved={() => {
                setNotice('Configuração salva. Os requisitos atuais serão consultados novamente.');
                void load();
              }}
              label="Salvar configuração"
            />
          ) : (
            <Fields
              values={[
                ['Horário diário', data.settings.scheduleTime],
                ['Fuso da rotina', data.settings.timezone],
                ['Janela recente (dias)', data.settings.lookbackDays],
              ]}
            />
          )}
        </>
      )}
    </section>
  );
}
