'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Loader2, UsersRound } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

interface ContactPreview {
  total: number;
  batch: number;
  batchSize: number;
  totalBatches: number;
  contacts: { id: string; name: string; phones: string[]; emails: string[] }[];
}

async function errorMessage(response: Response): Promise<string> {
  const value = (await response.json().catch(() => null)) as {
    message?: unknown;
    code?: unknown;
  } | null;
  const message =
    typeof value?.message === 'string' ? value.message : 'Não foi possível concluir a operação.';
  const code = typeof value?.code === 'string' ? value.code : 'HTTP_' + response.status;
  return message + ' Código do erro: ' + code + '.';
}

export function WhatsAppContactsPage({ canExport }: { readonly canExport: boolean }) {
  const [data, setData] = useState<ContactPreview | null>(null);
  const [batch, setBatch] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/registration-contact-export?batch=' + batch, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const result = (await response.json()) as ContactPreview;
        if (!controller.signal.aborted) setData(result);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error ? failure.message : 'Não foi possível carregar os contatos.',
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [batch, reload]);

  async function exportContacts() {
    setExporting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/registration-contact-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId: crypto.randomUUID(), batch }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lume-google-contacts-' + batch + '.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Arquivo baixado. No Google Contacts, escolha Importar e selecione o CSV.');
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Não foi possível exportar os contatos.',
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="lume-page flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary-emphasis">Agenda da empresa</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Contatos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Exporte os cadastros aprovados para importar no Google Contacts.
          </p>
        </div>
        <Button
          onClick={() => void exportContacts()}
          disabled={!canExport || loading || exporting || !data?.total || !data.contacts.length}
        >
          {exporting ? <Loader2 className="animate-spin" /> : <Download />}
          {exporting ? 'Exportando…' : 'Exportar para Google Contacts'}
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          {error}
          <Button
            className="ml-2"
            variant="outline"
            disabled={loading || exporting}
            onClick={() => setReload((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-primary-emphasis">
          {notice}
        </p>
      ) : null}
      {!canExport ? (
        <p className="text-sm text-muted-foreground">
          Sua conta não tem permissão para exportar arquivos. Solicite acesso ao administrador.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Cadastros incluídos na exportação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Somente cadastros efetivados e ativos. Registros temporários, inativos e candidatos em
            conciliação não são exportados. O arquivo inclui nomes, telefones vigentes, e-mails,
            endereço cadastral e marcadores disponíveis.
          </p>
          <p className="text-sm">
            Para corrigir os dados, acesse{' '}
            <Link href="/registrations" className="text-primary-emphasis underline">
              Cadastro
            </Link>
            .
          </p>
          {loading ? (
            <p role="status" className="flex items-center gap-2 py-8">
              <Loader2 className="size-4 animate-spin" /> Carregando cadastros…
            </p>
          ) : data?.contacts.length ? (
            <>
              <p className="text-sm font-medium">
                {data.total} {data.total === 1 ? 'cadastro disponível' : 'cadastros disponíveis'}.{' '}
                Prévia de {data.contacts.length}{' '}
                {data.contacts.length === 1 ? 'cadastro' : 'cadastros'} do lote {batch}.
              </p>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefones</TableHead>
                      <TableHead>E-mails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="min-w-40 whitespace-normal font-medium">
                          {contact.name}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {contact.phones.length
                            ? contact.phones.map((phone) => <div key={phone}>{phone}</div>)
                            : 'Não informado'}
                        </TableCell>
                        <TableCell className="max-w-64 break-words whitespace-normal">
                          {contact.emails.length
                            ? contact.emails.map((email) => <div key={email}>{email}</div>)
                            : 'Não informado'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {data.totalBatches > 1 ? (
                <nav
                  aria-label="Lotes de exportação"
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <Button
                    variant="outline"
                    disabled={batch <= 1 || exporting}
                    onClick={() => setBatch((value) => value - 1)}
                  >
                    Lote anterior
                  </Button>
                  <span className="text-sm">
                    Lote {batch} de {data.totalBatches}
                  </span>
                  <Button
                    variant="outline"
                    disabled={batch >= data.totalBatches || exporting}
                    onClick={() => setBatch((value) => value + 1)}
                  >
                    Próximo lote
                  </Button>
                </nav>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Cada arquivo contém até 3.000 cadastros, conforme o limite de importação do Google
                Contacts.
              </p>
            </>
          ) : !error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <UsersRound className="size-8 text-muted-foreground" />
              <p>Nenhum cadastro aprovado e ativo para exportar.</p>
              <p className="text-sm text-muted-foreground">
                Conclua os cadastros no módulo Cadastro para disponibilizá-los aqui.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Após baixar, abra o Google Contacts, clique em Importar e selecione o arquivo CSV.
      </p>
    </main>
  );
}
