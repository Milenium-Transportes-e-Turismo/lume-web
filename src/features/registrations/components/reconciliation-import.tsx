'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, Upload } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Spinner } from '@/shared/ui/spinner';

export function ReconciliationImport() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/registration-reconciliation/imports', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string | string[];
        duplicateFile?: boolean;
        importedRows?: number;
        errorRows?: number;
      } | null;
      if (!response.ok) {
        const detail = Array.isArray(payload?.message)
          ? payload.message.join(' ')
          : payload?.message;
        throw new Error(detail || 'A importação não foi concluída.');
      }
      setMessage({
        kind: 'success',
        text: payload?.duplicateFile
          ? 'Este arquivo já havia sido importado; nenhum registro foi duplicado.'
          : `Importação concluída: ${payload?.importedRows ?? 0} fontes novas e ${payload?.errorRows ?? 0} erros de linha.`,
      });
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Falha ao importar a planilha.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {message ? (
        <Alert variant={message.kind === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>
            {message.kind === 'error' ? 'Importação não concluída' : 'Planilha processada'}
          </AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}
      <form
        ref={formRef}
        onSubmit={submit}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="reconciliation-workbook">Planilha de análise do WhatsApp</Label>
          <div className="relative">
            <FileSpreadsheet
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="reconciliation-workbook"
              name="file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              disabled={busy}
              className="pl-9"
            />
          </div>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner aria-hidden="true" /> : <Upload aria-hidden="true" />}
          {busy ? 'Processando…' : 'Importar e preparar fila'}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        A importação preserva dados brutos e normalizados. Nenhuma identidade é aprovada
        automaticamente.
      </p>
    </div>
  );
}
