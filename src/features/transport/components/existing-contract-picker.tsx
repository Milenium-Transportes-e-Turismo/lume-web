'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ErrorNotice, Fields, Info, errorText, transportRequest, type Row } from './transport-ui';

export function ExistingContractPicker({
  selected,
  onSelected,
  registrationId,
}: {
  registrationId?: string;
  selected: Row | null;
  onSelected: (row: Row | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Row[]; total: number }>({ items: [], total: 0 });
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void transportRequest<typeof data>(
        'contracts/candidates?' +
          new URLSearchParams({
            search,
            page: String(page),
            ...(registrationId ? { registrationId } : {}),
          }),
        { signal: abort.signal },
      )
        .then((result) => {
          if (
            registrationId &&
            result.items.some((row) => row.clientRegistrationId !== registrationId)
          )
            throw new Error(
              'A API retornou contratos de outro cadastro. Recarregue e informe o suporte.',
            );
          setData(result);
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
  }, [search, page, registrationId]);
  if (selected)
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <Info>
          O contrato existente será reutilizado com seus dados e histórico preservados. Defina a
          empresa prestadora e a modalidade abaixo; depois do vínculo, alterações cadastrais ficam
          disponíveis em Editar.
        </Info>
        <Fields
          values={[
            ['Contrato existente', selected.name],
            ['Código', selected.code],
            ['Vigência inicial', selected.validFrom],
            ['Vigência final', selected.validUntil],
          ]}
        />
        <Button variant="outline" onClick={() => onSelected(null)}>
          Criar um contrato novo
        </Button>
      </div>
    );
  return (
    <details className="space-y-3 rounded-xl border p-4">
      <summary className="cursor-pointer font-medium">
        Reutilizar contrato já existente (opcional)
      </summary>
      <Info>
        Escolha um contrato cadastrado que ainda não possui configuração de transportes. O Lume
        mantém o mesmo contrato e acrescenta a empresa e a modalidade.
      </Info>
      <Input
        aria-label="Pesquisar contratos existentes"
        placeholder="Pesquisar por nome ou código"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <ErrorNotice message={error} />
      {data.items.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
        >
          <span className="min-w-0 break-words text-sm">
            {String(row.code)} · {String(row.name)}
          </span>
          <Button variant="outline" onClick={() => onSelected(row)}>
            Reutilizar
          </Button>
        </div>
      ))}
      <nav aria-label="Paginação dos contratos existentes" className="flex justify-between gap-2">
        <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <span className="text-sm">Página {page}</span>
        <Button
          variant="outline"
          disabled={page * 25 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </Button>
      </nav>
    </details>
  );
}
