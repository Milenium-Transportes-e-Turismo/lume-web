'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { toast } from '@/shared/ui/toast';

interface Contact {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly nameNeedsReview: boolean;
  readonly profilePictureUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ContactPage {
  readonly contacts: Contact[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly reviewTotal: number;
}

interface ImportResult {
  readonly imported: number;
  readonly created: number;
  readonly updated: number;
  readonly needsReview: number;
  readonly invalidPhones: number;
  readonly duplicatePhones: number;
}

interface ContactForm {
  name: string;
  phone: string;
}

const EMPTY_PAGE: ContactPage = {
  contacts: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1,
  reviewTotal: 0,
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase('pt-BR'))
      .join('') || 'C'
  );
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json().catch(() => null)) as { message?: unknown } | T | null;
  if (!response.ok) {
    const message =
      value && typeof value === 'object' && 'message' in value && typeof value.message === 'string'
        ? value.message
        : 'Não foi possível concluir a operação.';
    throw new Error(message);
  }
  return value as T;
}

function ContactBadge({ contact }: { readonly contact: Contact }) {
  return contact.nameNeedsReview ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-xs font-medium text-warning-emphasis">
      <AlertTriangle aria-hidden="true" className="size-3.5" />
      Revisar nome
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Nome conferido</span>
  );
}

export function WhatsAppContactsPage({ canManage }: { readonly canManage: boolean }) {
  const [data, setData] = useState<ContactPage>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ContactForm>({ name: '', phone: '' });
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search);
      if (reviewOnly) params.set('needsReview', 'true');
      const response = await fetch(`/api/whatsapp-contacts?${params}`, { cache: 'no-store' });
      setData(await responseJson<ContactPage>(response));
    } catch (error) {
      toast.add({
        title: 'Contatos não carregados',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [page, reviewOnly, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', phone: '' });
    setFormOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setForm({ name: contact.name, phone: contact.phone });
    setFormOpen(true);
  }

  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(
        editing
          ? `/api/whatsapp-contacts/${encodeURIComponent(editing.id)}`
          : '/api/whatsapp-contacts',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      await responseJson<Contact>(response);
      setFormOpen(false);
      toast.add({
        title: editing ? 'Contato atualizado' : 'Contato salvo',
        description: `${form.name.trim()} está disponível na lista de contatos.`,
        type: 'success',
      });
      await load();
    } catch (error) {
      toast.add({
        title: 'Contato não salvo',
        description: error instanceof Error ? error.message : 'Confira os dados informados.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact() {
    if (!deleting) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/whatsapp-contacts/${encodeURIComponent(deleting.id)}`, {
        method: 'DELETE',
      });
      await responseJson<{ deleted: boolean }>(response);
      setDeleting(null);
      toast.add({
        title: 'Contato excluído',
        description: 'O contato foi removido da agenda.',
        type: 'success',
      });
      await load();
    } catch (error) {
      toast.add({
        title: 'Contato não excluído',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/whatsapp-contacts/import', { method: 'POST', body });
      const result = await responseJson<ImportResult>(response);
      toast.add({
        title: 'Contatos importados',
        description: `${countLabel(result.imported, 'contato processado', 'contatos processados')}. ${countLabel(result.needsReview, 'nome precisa', 'nomes precisam')} de revisão. ${countLabel(result.invalidPhones, 'telefone inválido foi ignorado', 'telefones inválidos foram ignorados')}.`,
        type: result.needsReview > 0 ? 'warning' : 'success',
      });
      setPage(1);
      setReviewOnly(result.needsReview > 0);
      await load();
    } catch (error) {
      toast.add({
        title: 'Importação não concluída',
        description: error instanceof Error ? error.message : 'Confira o arquivo CSV.',
        type: 'error',
      });
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const pages = Array.from({ length: data.totalPages }, (_, index) => index + 1).filter(
    (candidate) =>
      candidate === 1 || candidate === data.totalPages || Math.abs(candidate - data.page) <= 2,
  );

  return (
    <main className="lume-page flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary-emphasis">Agenda da empresa</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Contatos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Salve nomes e telefones para identificá-los automaticamente no Painel WhatsApp.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsv(file);
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={importing}
            >
              {importing ? <Loader2 className="animate-spin" /> : <FileUp />}
              Importar CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus /> Novo contato
            </Button>
          </div>
        ) : null}
      </header>

      {data.reviewTotal > 0 ? (
        <Card size="sm" className="border-warning-emphasis/30 bg-warning-soft/40">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 text-warning-emphasis" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  {countLabel(data.reviewTotal, 'nome precisa', 'nomes precisam')} de revisão
                </p>
                <p className="text-sm text-muted-foreground">
                  O arquivo original contém nomes vazios, símbolos isolados ou caracteres
                  indefinidos.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                setReviewOnly(true);
              }}
            >
              Revisar agora
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <form
              className="flex flex-1 flex-col gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
            >
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="pl-9"
                  placeholder="Pesquisar por nome ou telefone"
                  aria-label="Pesquisar contatos"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                A pesquisa é atualizada automaticamente.
              </span>
            </form>
            <div className="flex rounded-lg bg-muted p-1" aria-label="Filtro dos contatos">
              <Button
                size="sm"
                variant={!reviewOnly ? 'secondary' : 'ghost'}
                onClick={() => {
                  setPage(1);
                  setReviewOnly(false);
                }}
              >
                Todos
              </Button>
              <Button
                size="sm"
                variant={reviewOnly ? 'secondary' : 'ghost'}
                onClick={() => {
                  setPage(1);
                  setReviewOnly(true);
                }}
              >
                Revisar nomes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin" /> Carregando contatos
            </div>
          ) : data.contacts.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
              <UserRound className="size-10 text-muted-foreground" aria-hidden="true" />
              <CardTitle>Nenhum contato encontrado</CardTitle>
              <p className="text-sm text-muted-foreground">
                {reviewOnly
                  ? 'Todos os nomes importados já foram conferidos.'
                  : 'Cadastre um contato ou importe uma lista CSV.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Situação do nome</TableHead>
                      {canManage ? <TableHead className="text-right">Ações</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              {contact.profilePictureUrl ? (
                                <AvatarImage src={contact.profilePictureUrl} alt="" />
                              ) : null}
                              <AvatarFallback>{initials(contact.name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{contact.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{contact.phone}</TableCell>
                        <TableCell>
                          <ContactBadge contact={contact} />
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="icon-sm"
                                variant="outline"
                                onClick={() => openEdit(contact)}
                                aria-label={`Editar ${contact.name}`}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                onClick={() => setDeleting(contact)}
                                aria-label={`Excluir ${contact.name}`}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {data.contacts.map((contact) => (
                  <article key={contact.id} className="rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      <Avatar>
                        {contact.profilePictureUrl ? (
                          <AvatarImage src={contact.profilePictureUrl} alt="" />
                        ) : null}
                        <AvatarFallback>{initials(contact.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-medium">{contact.name}</h2>
                        <p className="text-sm text-muted-foreground">{contact.phone}</p>
                        <div className="mt-2">
                          <ContactBadge contact={contact} />
                        </div>
                      </div>
                    </div>
                    {canManage ? (
                      <div className="mt-4 flex gap-2">
                        <Button
                          className="flex-1"
                          variant="outline"
                          onClick={() => openEdit(contact)}
                        >
                          <Pencil /> Editar
                        </Button>
                        <Button
                          className="flex-1"
                          variant="outline"
                          onClick={() => setDeleting(contact)}
                        >
                          <Trash2 /> Excluir
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}
          {data.totalPages > 1 ? (
            <nav
              className="mt-5 flex flex-wrap justify-center gap-1"
              aria-label="Paginação dos contatos"
            >
              {pages.map((candidate, index) => (
                <span key={candidate} className="contents">
                  {index > 0 && candidate - (pages[index - 1] ?? 0) > 1 ? (
                    <span className="px-2 py-1 text-muted-foreground">…</span>
                  ) : null}
                  <Button
                    size="icon-sm"
                    variant={candidate === data.page ? 'default' : 'outline'}
                    onClick={() => setPage(candidate)}
                    aria-current={candidate === data.page ? 'page' : undefined}
                    aria-label={`Página ${candidate}`}
                  >
                    {candidate}
                  </Button>
                </span>
              ))}
            </nav>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={saveContact} className="contents">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar contato' : 'Novo contato'}</DialogTitle>
              <DialogDescription>
                Telefones antigos e atuais são reconhecidos como o mesmo contato.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="contact-name">Nome</Label>
                <Input
                  id="contact-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  maxLength={160}
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-phone">Telefone com DDD</Label>
                <Input
                  id="contact-phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="(34) 99999-9999"
                  inputMode="tel"
                  maxLength={40}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Aceita (XX) XXXX-XXXX e (XX) XXXXX-XXXX.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                Salvar contato
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir contato?</DialogTitle>
            <DialogDescription>
              {deleting?.name} será removido da agenda. O histórico de conversas será preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void deleteContact()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
