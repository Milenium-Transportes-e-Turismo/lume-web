'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { ErrorNotice, Fields, Info, date, errorText, transportRequest } from './transport-ui';

export function ImportRejections({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const [data, setData] = useState<{
    items: {
      id: string;
      vehicleIndex: number;
      pageSkip: number;
      position: number;
      reason: string;
      createdAt: string;
    }[];
    nextCursor: string | null;
  }>({ items: [], nextCursor: null });
  const [error, setError] = useState('');
  const cursor = cursors.at(-1) ?? '';
  useEffect(() => {
    const abort = new AbortController();
    void transportRequest<typeof data>(
      'imports/' + jobId + '/rejections?limit=25' + (cursor ? '&cursor=' + cursor : ''),
      { signal: abort.signal },
    )
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => {
        if (!abort.signal.aborted) setError(errorText(err));
      });
    return () => abort.abort();
  }, [jobId, cursor]);
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Registros que precisam de revisão na importação</h3>
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <Info>
        Uma importação com rejeições não comprova cobertura completa do veículo. Os demais registros
        podem ser importados e analisados independentemente.
      </Info>
      <ErrorNotice message={error} />
      {data.items.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Nenhuma rejeição nesta página.</p>
      )}
      {data.items.map((item) => (
        <article key={item.id} className="space-y-2 rounded-lg border p-3">
          <p className="text-sm">{item.reason}</p>
          <Fields
            values={[
              ['Posição do veículo no lote', item.vehicleIndex + 1],
              ['Posição na página de origem', item.position + 1],
              ['Deslocamento na origem', item.pageSkip],
              ['Detectada em', date(item.createdAt)],
            ]}
          />
        </article>
      ))}
      <nav aria-label="Paginação das rejeições" className="flex justify-between gap-2">
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
          disabled={!data.nextCursor}
          onClick={() => {
            if (data.nextCursor) setCursors([...cursors, data.nextCursor]);
          }}
        >
          Próxima
        </Button>
      </nav>
    </div>
  );
}
