'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import {
  Archive,
  BookOpen,
  Check,
  Download,
  FilePlus2,
  FileText,
  Lightbulb,
  LoaderCircle,
  Plus,
  Search,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';

import {
  executeKnowledgeMutationAction,
  getKnowledgeDocumentAction,
  uploadKnowledgeOriginalAction,
  type KnowledgeMutationInput,
} from '../actions';
import type {
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeDocumentSummary,
  KnowledgeDepartment,
  KnowledgeGap,
  KnowledgeGapStatus,
  KnowledgePermissions,
  KnowledgeScope,
  KnowledgeSuggestion,
  KnowledgeSuggestionStatus,
  KnowledgeVersion,
  KnowledgeVisibility,
} from '../domain';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
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
import { Textarea } from '@/shared/ui/textarea';

type WorkspaceTab = 'content' | 'suggestions' | 'gaps';
type EditorDialog = 'base' | 'article' | 'file' | 'draft' | null;

interface KnowledgeManagementProps {
  readonly initialDepartments?: readonly KnowledgeDepartment[];
  readonly initialBases: readonly KnowledgeBase[];
  readonly initialDocuments: readonly KnowledgeDocumentSummary[];
  readonly initialSuggestions: readonly KnowledgeSuggestion[];
  readonly initialGaps: readonly KnowledgeGap[];
  readonly initialErrors: {
    readonly bases?: string;
    readonly documents?: string;
    readonly suggestions?: string;
    readonly gaps?: string;
    readonly departments?: string;
  };
  readonly permissions: KnowledgePermissions;
}

interface MetadataDraft {
  knowledgeBaseId: string;
  title: string;
  description: string;
  scope: KnowledgeScope;
  visibility: KnowledgeVisibility;
  departmentIds: string[];
  effectiveFrom: string;
  effectiveUntil: string;
  content: string;
}

const EMPTY_METADATA: MetadataDraft = {
  knowledgeBaseId: '',
  title: '',
  description: '',
  scope: 'tenant',
  visibility: 'customer-safe',
  departmentIds: [],
  effectiveFrom: '',
  effectiveUntil: '',
  content: '',
};

const STATUS_LABELS: Record<KnowledgeVersion['status'], string> = {
  draft: 'Draft',
  published: 'Publicada',
  superseded: 'Substituída',
  archived: 'Arquivada',
};
const SUGGESTION_LABELS: Record<KnowledgeSuggestionStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  published: 'Publicada',
};
const GAP_LABELS: Record<KnowledgeGapStatus, string> = {
  open: 'Aberto',
  acknowledged: 'Reconhecido',
  resolved: 'Resolvido',
  dismissed: 'Descartado',
};

function iso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function localDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function sanitized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/(?:credential|api.?key|secret|token)/iu.test(key))
        .map(([key, entry]) => [key, sanitized(entry)]),
    );
  }
  return value;
}

function compactJson(value: Readonly<Record<string, unknown>>): string {
  const serialized = JSON.stringify(sanitized(value), null, 2);
  return serialized.length > 4_000 ? `${serialized.slice(0, 4_000)}\n…` : serialized;
}

function badgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (['published', 'approved', 'resolved'].includes(status)) return 'default';
  if (['rejected', 'archived', 'dismissed'].includes(status)) return 'destructive';
  if (['pending', 'open', 'draft'].includes(status)) return 'secondary';
  return 'outline';
}

function MetadataFields({
  draft,
  onChange,
  bases,
  departments,
  includeContent,
}: {
  readonly draft: MetadataDraft;
  readonly onChange: (value: MetadataDraft) => void;
  readonly bases: readonly KnowledgeBase[];
  readonly departments: readonly KnowledgeDepartment[];
  readonly includeContent: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="knowledge-base">Base</Label>
        <select
          id="knowledge-base"
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          required
          value={draft.knowledgeBaseId}
          onChange={(event) => onChange({ ...draft, knowledgeBaseId: event.target.value })}
        >
          <option value="">Selecione</option>
          {bases
            .filter((base) => base.enabled && !base.archivedAt)
            .map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
        </select>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="knowledge-title">Título</Label>
        <Input
          id="knowledge-title"
          required
          maxLength={240}
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="knowledge-description">Descrição</Label>
        <Textarea
          id="knowledge-description"
          maxLength={4_000}
          className="min-h-16"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="knowledge-scope">Escopo</Label>
        <select
          id="knowledge-scope"
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          value={draft.scope}
          onChange={(event) => {
            const scope = event.target.value as KnowledgeScope;
            onChange({
              ...draft,
              scope,
              departmentIds:
                scope === 'tenant'
                  ? []
                  : scope === 'department'
                    ? draft.departmentIds.slice(0, 1)
                    : draft.departmentIds,
            });
          }}
        >
          <option value="tenant">Tenant inteiro</option>
          <option value="department">Um departamento</option>
          <option value="multi-department">Múltiplos departamentos</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="knowledge-visibility">Visibilidade</Label>
        <select
          id="knowledge-visibility"
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          value={draft.visibility}
          onChange={(event) =>
            onChange({ ...draft, visibility: event.target.value as KnowledgeVisibility })
          }
        >
          <option value="customer-safe">Segura para cliente</option>
          <option value="internal">Uso interno</option>
        </select>
      </div>
      {draft.scope !== 'tenant' ? (
        <div className="grid gap-1.5 sm:col-span-2">
          {draft.scope === 'department' ? (
            <>
              <Label htmlFor="knowledge-department">Departamento</Label>
              <select
                id="knowledge-department"
                className="h-8 rounded-lg border bg-background px-2 text-sm"
                required
                value={draft.departmentIds[0] ?? ''}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    departmentIds: event.target.value ? [event.target.value] : [],
                  })
                }
              >
                <option value="">Selecione</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                    {department.isDefault ? ' (padrão)' : ''}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <fieldset className="grid gap-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Departamentos</legend>
              {departments.map((department) => {
                const id = `knowledge-department-${department.id}`;
                return (
                  <div key={department.id} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={draft.departmentIds.includes(department.id)}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...draft,
                          departmentIds: checked
                            ? [...new Set([...draft.departmentIds, department.id])]
                            : draft.departmentIds.filter((value) => value !== department.id),
                        })
                      }
                    />
                    <Label htmlFor={id} className="font-normal">
                      {department.name}
                      {department.isDefault ? ' (padrão)' : ''}
                    </Label>
                  </div>
                );
              })}
              {departments.length === 0 ? (
                <p className="text-xs text-destructive">Catálogo de departamentos indisponível.</p>
              ) : null}
            </fieldset>
          )}
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="knowledge-from">Vigente a partir de</Label>
        <Input
          id="knowledge-from"
          type="datetime-local"
          value={draft.effectiveFrom}
          onChange={(event) => onChange({ ...draft, effectiveFrom: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="knowledge-until">Vigente até</Label>
        <Input
          id="knowledge-until"
          type="datetime-local"
          value={draft.effectiveUntil}
          onChange={(event) => onChange({ ...draft, effectiveUntil: event.target.value })}
        />
      </div>
      {includeContent ? (
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="knowledge-content">Conteúdo</Label>
          <Textarea
            id="knowledge-content"
            required
            className="min-h-48 font-mono text-xs"
            maxLength={2_097_152}
            value={draft.content}
            onChange={(event) => onChange({ ...draft, content: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

function EmptyPanel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center">
      <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function KnowledgeManagement({
  initialDepartments = [],
  initialBases,
  initialDocuments,
  initialSuggestions,
  initialGaps,
  initialErrors,
  permissions,
}: KnowledgeManagementProps) {
  const router = useRouter();
  const [tab, setTab] = useState<WorkspaceTab>('content');
  const [selectedBaseId, setSelectedBaseId] = useState<string>('all');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    initialDocuments[0]?.id ?? null,
  );
  const [document, setDocument] = useState<KnowledgeDocument | null>(null);
  const [detailError, setDetailError] = useState('');
  const [query, setQuery] = useState('');
  const [suggestionStatus, setSuggestionStatus] = useState<'all' | KnowledgeSuggestionStatus>(
    'all',
  );
  const [gapStatus, setGapStatus] = useState<'all' | KnowledgeGapStatus>('all');
  const [dialog, setDialog] = useState<EditorDialog>(null);
  const [metadata, setMetadata] = useState<MetadataDraft>({
    ...EMPTY_METADATA,
    knowledgeBaseId: initialBases[0]?.id ?? '',
  });
  const [baseName, setBaseName] = useState('');
  const [baseDescription, setBaseDescription] = useState('');
  const [draftVersion, setDraftVersion] = useState<KnowledgeVersion | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftEffectiveFrom, setDraftEffectiveFrom] = useState('');
  const [draftEffectiveUntil, setDraftEffectiveUntil] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedDocumentId) return;
    let active = true;
    startTransition(async () => {
      const result = await getKnowledgeDocumentAction(selectedDocumentId);
      if (!active) return;
      if (result.success) setDocument(result.document);
      else {
        setDocument(null);
        setDetailError(`${result.message} Código: ${result.publicCode}.`);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedDocumentId]);

  const documents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return initialDocuments.filter(
      (item) =>
        (selectedBaseId === 'all' || item.knowledgeBaseId === selectedBaseId) &&
        (!normalized ||
          `${item.title} ${item.description ?? ''}`
            .toLocaleLowerCase('pt-BR')
            .includes(normalized)),
    );
  }, [initialDocuments, query, selectedBaseId]);
  const suggestions = initialSuggestions.filter(
    (item) => suggestionStatus === 'all' || item.status === suggestionStatus,
  );
  const gaps = initialGaps.filter((item) => gapStatus === 'all' || item.status === gapStatus);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 6_000);
  }

  function execute(input: KnowledgeMutationInput, onSuccess?: () => void) {
    setFeedback('');
    startTransition(async () => {
      const result = await executeKnowledgeMutationAction(input);
      notify(result.success ? result.message : `${result.message} Código: ${result.publicCode}.`);
      if (result.success) {
        onSuccess?.();
        router.refresh();
        if (selectedDocumentId) {
          const current = await getKnowledgeDocumentAction(selectedDocumentId);
          if (current.success) setDocument(current.document);
        }
      } else if (result.currentDocument) {
        setDocument(result.currentDocument);
      }
    });
  }

  function metadataPayload() {
    return {
      knowledgeBaseId: metadata.knowledgeBaseId,
      title: metadata.title.trim(),
      description: metadata.description.trim() || undefined,
      scope: metadata.scope,
      visibility: metadata.visibility,
      departmentIds: metadata.scope === 'tenant' ? [] : metadata.departmentIds,
      effectiveFrom: iso(metadata.effectiveFrom),
      effectiveUntil: iso(metadata.effectiveUntil),
    };
  }

  function submitBase(event: FormEvent) {
    event.preventDefault();
    execute(
      {
        kind: 'create-base',
        commandId: crypto.randomUUID(),
        name: baseName,
        description: baseDescription || undefined,
      },
      () => {
        setDialog(null);
        setBaseName('');
        setBaseDescription('');
      },
    );
  }

  function submitArticle(event: FormEvent) {
    event.preventDefault();
    execute(
      {
        kind: 'create-article',
        commandId: crypto.randomUUID(),
        ...metadataPayload(),
        content: metadata.content,
      },
      () => {
        setDialog(null);
        setMetadata({ ...EMPTY_METADATA, knowledgeBaseId: metadata.knowledgeBaseId });
      },
    );
  }

  function submitFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = metadataPayload();
    form.set('commandId', crypto.randomUUID());
    form.set('knowledgeBaseId', values.knowledgeBaseId);
    form.set('title', values.title);
    form.set('description', values.description ?? '');
    form.set('scope', values.scope);
    form.set('visibility', values.visibility);
    form.set('departmentIds', values.departmentIds.join(','));
    form.set('effectiveFrom', values.effectiveFrom ?? '');
    form.set('effectiveUntil', values.effectiveUntil ?? '');
    startTransition(async () => {
      const result = await uploadKnowledgeOriginalAction(form);
      notify(result.success ? result.message : `${result.message} Código: ${result.publicCode}.`);
      if (result.success) {
        setDialog(null);
        router.refresh();
      }
    });
  }

  function openDraft(version?: KnowledgeVersion) {
    const target = version ?? document?.versions.find((item) => item.status === 'draft') ?? null;
    const source = target ?? document?.versions[0];
    setDraftVersion(target);
    setDraftContent(source?.content ?? '');
    setDraftEffectiveFrom(localDateTime(source?.effectiveFrom));
    setDraftEffectiveUntil(localDateTime(source?.effectiveUntil));
    setDialog('draft');
  }

  function submitDraft(event: FormEvent) {
    event.preventDefault();
    if (!document || !document.versions[0]) return;
    if (draftVersion) {
      if (!draftVersion.contentHash) {
        notify('O draft não possui hash de conteúdo válido para edição segura.');
        return;
      }
      execute(
        {
          kind: 'update-draft',
          commandId: crypto.randomUUID(),
          documentId: document.id,
          versionId: draftVersion.id,
          expectedVersion: draftVersion.version,
          expectedContentHash: draftVersion.contentHash,
          content: draftContent,
          effectiveFrom: iso(draftEffectiveFrom),
          effectiveUntil: iso(draftEffectiveUntil),
        },
        () => setDialog(null),
      );
      return;
    }
    execute(
      {
        kind: 'create-next-draft',
        commandId: crypto.randomUUID(),
        documentId: document.id,
        expectedVersion: document.versions[0].version,
        content: draftContent || undefined,
        effectiveFrom: iso(draftEffectiveFrom),
        effectiveUntil: iso(draftEffectiveUntil),
      },
      () => setDialog(null),
    );
  }

  return (
    <section className="grid gap-3" aria-labelledby="knowledge-title">
      <header className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
            Operação assistida
          </p>
          <h1 id="knowledge-title" className="text-xl font-semibold tracking-tight">
            Conhecimento
          </h1>
          <p className="text-sm text-muted-foreground">
            Conteúdo versionado, revisão de evidências e lacunas observadas pelos agentes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{initialBases.length} bases</Badge>
          <Badge variant="outline">{initialDocuments.length} documentos</Badge>
          <Badge variant="outline">
            {initialSuggestions.filter((item) => item.status === 'pending').length} sugestões
          </Badge>
          {permissions.canManage ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialog('base')}>
                <Plus aria-hidden="true" /> Base
              </Button>
              <Button
                size="sm"
                onClick={() => setDialog('article')}
                disabled={!initialBases.length}
              >
                <FilePlus2 aria-hidden="true" /> Artigo
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDialog('file')}
                disabled={!initialBases.length}
              >
                <Upload aria-hidden="true" /> Arquivo
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <div
        className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
        role="tablist"
        aria-label="Áreas de knowledge"
      >
        {(
          [
            ['content', 'Conteúdo', BookOpen],
            ['suggestions', 'Sugestões', Lightbulb],
            ['gaps', 'Lacunas', ShieldAlert],
          ] as const
        ).map(([value, label, Icon]) => (
          <Button
            key={value}
            role="tab"
            aria-selected={tab === value}
            size="sm"
            variant={tab === value ? 'default' : 'ghost'}
            onClick={() => setTab(value)}
          >
            <Icon aria-hidden="true" /> {label}
          </Button>
        ))}
      </div>

      <div className="min-h-6 text-sm" aria-live="polite">
        {isPending ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Processando…
          </span>
        ) : (
          feedback
        )}
      </div>

      {tab === 'content' ? (
        <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[15rem_minmax(19rem,0.8fr)_minmax(28rem,1.4fr)]">
          <aside className="rounded-xl border bg-card p-2" aria-label="Bases de knowledge">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bases
            </p>
            <button
              type="button"
              onClick={() => setSelectedBaseId('all')}
              className={`w-full rounded-lg px-2 py-2 text-left text-sm ${selectedBaseId === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Todas <span className="float-right tabular-nums">{initialDocuments.length}</span>
            </button>
            {initialBases.map((base) => (
              <button
                key={base.id}
                type="button"
                onClick={() => setSelectedBaseId(base.id)}
                className={`mt-1 w-full rounded-lg px-2 py-2 text-left text-sm ${selectedBaseId === base.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <span className="block truncate font-medium">{base.name}</span>
                <span className="text-xs opacity-75">{base.documentCount} documentos</span>
              </button>
            ))}
            {initialErrors.bases ? (
              <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                {initialErrors.bases}
              </p>
            ) : null}
            {initialErrors.departments ? (
              <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                {initialErrors.departments}
              </p>
            ) : null}
          </aside>

          <section className="rounded-xl border bg-card p-2" aria-label="Documentos">
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Buscar documentos"
                className="pl-8"
                placeholder="Buscar enquanto digita…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {initialErrors.documents ? (
              <Alert variant="destructive">
                <AlertTitle>Falha ao carregar</AlertTitle>
                <AlertDescription>{initialErrors.documents}</AlertDescription>
              </Alert>
            ) : documents.length ? (
              <div className="grid gap-1">
                {documents.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDetailError('');
                      setSelectedDocumentId(item.id);
                    }}
                    className={`rounded-lg border p-2 text-left transition-colors ${selectedDocumentId === item.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.description || 'Sem descrição'}
                        </span>
                      </span>
                      {item.latestVersion ? (
                        <Badge variant={badgeVariant(item.latestVersion.status)}>
                          {STATUS_LABELS[item.latestVersion.status]}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-1 flex gap-2 text-[0.7rem] text-muted-foreground">
                      <span>{item.sourceType === 'article' ? 'Artigo' : 'Arquivo'}</span>
                      <span>v{item.latestVersion?.version ?? '—'}</span>
                      {item.archivedAt ? <span>Arquivado</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="Nenhum documento"
                description="Ajuste a busca ou crie um artigo/arquivo nesta base."
              />
            )}
          </section>

          <section
            className="min-w-0 rounded-xl border bg-card p-3"
            aria-label="Detalhes do documento"
          >
            {detailError ? (
              <Alert variant="destructive">
                <AlertTitle>Detalhe indisponível</AlertTitle>
                <AlertDescription>{detailError}</AlertDescription>
              </Alert>
            ) : null}
            {!document ? (
              <EmptyPanel
                title={isPending ? 'Carregando documento…' : 'Selecione um documento'}
                description="Versões, vigência e evidências aparecerão aqui."
              />
            ) : (
              <div className="grid gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{document.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {document.description || 'Sem descrição'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline">{document.scope}</Badge>
                      <Badge variant="outline">{document.visibility}</Badge>
                      <Badge variant="outline">{document.sourceType}</Badge>
                    </div>
                  </div>
                  {permissions.canManage && !document.archivedAt && document.versions[0] ? (
                    <div className="flex flex-wrap gap-1">
                      {document.sourceType === 'article' ? (
                        <Button size="xs" variant="outline" onClick={() => openDraft()}>
                          <FileText aria-hidden="true" />
                          {document.versions.some((item) => item.status === 'draft')
                            ? 'Editar draft'
                            : 'Novo draft'}
                        </Button>
                      ) : null}
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() =>
                          execute({
                            kind: 'archive-document',
                            commandId: crypto.randomUUID(),
                            documentId: document.id,
                            expectedVersion: document.versions[0]!.version,
                          })
                        }
                      >
                        <Archive aria-hidden="true" /> Arquivar documento
                      </Button>
                    </div>
                  ) : null}
                </div>
                {document.departmentIds.length ? (
                  <details className="rounded-lg border p-2 text-xs">
                    <summary className="cursor-pointer font-medium">
                      Departamentos ({document.departmentIds.length})
                    </summary>
                    <div className="mt-2 break-all text-muted-foreground">
                      {document.departmentIds
                        .map(
                          (id) =>
                            initialDepartments.find((department) => department.id === id)?.name ??
                            id,
                        )
                        .join(', ')}
                    </div>
                  </details>
                ) : null}
                <div className="grid gap-2">
                  {document.versions.map((version) => (
                    <article key={version.id} className="rounded-lg border p-2">
                      <header className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">Versão {version.version}</span>
                          <Badge variant={badgeVariant(version.status)}>
                            {STATUS_LABELS[version.status]}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {version.original ? (
                            <Button
                              size="xs"
                              variant="outline"
                              render={
                                <a
                                  href={`/api/knowledge/documents/${document.id}/versions/${version.id}/original`}
                                />
                              }
                            >
                              <Download aria-hidden="true" /> Original
                            </Button>
                          ) : null}
                          {permissions.canPublish && version.status === 'draft' ? (
                            <Button
                              size="xs"
                              onClick={() =>
                                execute({
                                  kind: 'publish-version',
                                  commandId: crypto.randomUUID(),
                                  documentId: document.id,
                                  versionId: version.id,
                                  expectedVersion: version.version,
                                })
                              }
                            >
                              <Check aria-hidden="true" /> Publicar
                            </Button>
                          ) : null}
                          {(permissions.canManage || permissions.canPublish) &&
                          !['archived', 'superseded'].includes(version.status) ? (
                            <Button
                              size="xs"
                              variant="destructive"
                              onClick={() =>
                                execute({
                                  kind: 'archive-version',
                                  commandId: crypto.randomUUID(),
                                  documentId: document.id,
                                  versionId: version.id,
                                  expectedVersion: version.version,
                                })
                              }
                            >
                              <Archive aria-hidden="true" /> Arquivar
                            </Button>
                          ) : null}
                        </div>
                      </header>
                      <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <div>
                          <dt className="inline font-medium text-foreground">Vigência: </dt>
                          <dd className="inline">
                            {formatDate(version.effectiveFrom)} →{' '}
                            {formatDate(version.effectiveUntil)}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-foreground">Publicada: </dt>
                          <dd className="inline">{formatDate(version.publishedAt)}</dd>
                        </div>
                      </dl>
                      {version.content ? (
                        <p className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
                          {version.content}
                        </p>
                      ) : null}
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          Proveniência e extração
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2">
                          {compactJson(version.provenance)}
                        </pre>
                      </details>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'suggestions' ? (
        <section
          className="grid gap-3 rounded-xl border bg-card p-3"
          aria-label="Sugestões de knowledge"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Sugestões dos agentes</h2>
              <p className="text-xs text-muted-foreground">
                Aprovar uma sugestão não publica conteúdo automaticamente.
              </p>
            </div>
            <Label className="flex items-center gap-2 text-xs">
              Status
              <select
                className="h-8 rounded-lg border bg-background px-2"
                value={suggestionStatus}
                onChange={(event) =>
                  setSuggestionStatus(event.target.value as typeof suggestionStatus)
                }
              >
                <option value="all">Todos</option>
                {Object.entries(SUGGESTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Label>
          </div>
          {initialErrors.suggestions ? (
            <Alert variant="destructive">
              <AlertTitle>Fila indisponível</AlertTitle>
              <AlertDescription>{initialErrors.suggestions}</AlertDescription>
            </Alert>
          ) : null}
          {suggestions.length ? (
            suggestions.map((item) => (
              <article key={item.id} className="grid gap-2 rounded-lg border p-3">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Sessão {item.serviceSessionId ?? 'não vinculada'} · execução{' '}
                      {item.agentExecutionId ?? 'não vinculada'}
                    </p>
                  </div>
                  <Badge variant={badgeVariant(item.status)}>
                    {SUGGESTION_LABELS[item.status]}
                  </Badge>
                </header>
                <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-sm">
                  {item.proposedContent}
                </p>
                <details className="text-xs">
                  <summary className="cursor-pointer">Evidências</summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2">
                    {compactJson(item.evidence)}
                  </pre>
                </details>
                {permissions.canManage && item.status === 'pending' ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        execute({
                          kind: 'review-suggestion',
                          commandId: crypto.randomUUID(),
                          suggestionId: item.id,
                          decision: 'rejected',
                        })
                      }
                    >
                      <X /> Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        execute({
                          kind: 'review-suggestion',
                          commandId: crypto.randomUUID(),
                          suggestionId: item.id,
                          decision: 'approved',
                        })
                      }
                    >
                      <Check /> Aprovar
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyPanel
              title="Nenhuma sugestão"
              description="Não há itens com o status selecionado."
            />
          )}
        </section>
      ) : null}

      {tab === 'gaps' ? (
        <section
          className="grid gap-3 rounded-xl border bg-card p-3"
          aria-label="Lacunas de knowledge"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Lacunas observadas</h2>
              <p className="text-xs text-muted-foreground">
                Ocorrências sem cobertura suficiente na base publicada.
              </p>
            </div>
            <Label className="flex items-center gap-2 text-xs">
              Status
              <select
                className="h-8 rounded-lg border bg-background px-2"
                value={gapStatus}
                onChange={(event) => setGapStatus(event.target.value as typeof gapStatus)}
              >
                <option value="all">Todos</option>
                {Object.entries(GAP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Label>
          </div>
          {initialErrors.gaps ? (
            <Alert variant="destructive">
              <AlertTitle>Fila indisponível</AlertTitle>
              <AlertDescription>{initialErrors.gaps}</AlertDescription>
            </Alert>
          ) : null}
          {gaps.length ? (
            gaps.map((item) => (
              <article key={item.id} className="grid gap-2 rounded-lg border p-3">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{item.topic}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.occurrenceCount} ocorrência(s) · última em{' '}
                      {formatDate(item.lastObservedAt)}
                    </p>
                  </div>
                  <Badge variant={badgeVariant(item.status)}>{GAP_LABELS[item.status]}</Badge>
                </header>
                <details className="text-xs">
                  <summary className="cursor-pointer">Evidências e origem</summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2">
                    {compactJson(item.evidence)}
                  </pre>
                  <p className="mt-1 break-all text-muted-foreground">
                    Sessão: {item.serviceSessionId ?? '—'} · execução:{' '}
                    {item.agentExecutionId ?? '—'}
                  </p>
                </details>
                {permissions.canManage && !['resolved', 'dismissed'].includes(item.status) ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {item.status === 'open' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          execute({
                            kind: 'review-gap',
                            commandId: crypto.randomUUID(),
                            gapId: item.id,
                            decision: 'acknowledged',
                          })
                        }
                      >
                        Reconhecer
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        execute({
                          kind: 'review-gap',
                          commandId: crypto.randomUUID(),
                          gapId: item.id,
                          decision: 'dismissed',
                        })
                      }
                    >
                      Descartar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        execute({
                          kind: 'review-gap',
                          commandId: crypto.randomUUID(),
                          gapId: item.id,
                          decision: 'resolved',
                        })
                      }
                    >
                      Resolver
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyPanel
              title="Nenhuma lacuna"
              description="Não há itens com o status selecionado."
            />
          )}
        </section>
      ) : null}

      <Dialog open={dialog === 'base'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <form onSubmit={submitBase} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Nova base</DialogTitle>
              <DialogDescription>Organize documentos por contexto de negócio.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Label htmlFor="base-name">Nome</Label>
              <Input
                id="base-name"
                required
                maxLength={120}
                value={baseName}
                onChange={(event) => setBaseName(event.target.value)}
              />
              <Label htmlFor="base-description">Descrição</Label>
              <Textarea
                id="base-description"
                maxLength={4_000}
                value={baseDescription}
                onChange={(event) => setBaseDescription(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                Criar base
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'article'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={submitArticle} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Novo artigo</DialogTitle>
              <DialogDescription>
                O conteúdo nasce como draft e exige publicação explícita.
              </DialogDescription>
            </DialogHeader>
            <MetadataFields
              draft={metadata}
              onChange={setMetadata}
              bases={initialBases}
              departments={initialDepartments}
              includeContent
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                Criar draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'file'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={submitFile} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Enviar original</DialogTitle>
              <DialogDescription>
                A API extrai PDF textual. PDFs formados somente por imagens exigem OCR antes do
                envio para produzir conteúdo pesquisável.
              </DialogDescription>
            </DialogHeader>
            <MetadataFields
              draft={metadata}
              onChange={setMetadata}
              bases={initialBases}
              departments={initialDepartments}
              includeContent={false}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="knowledge-file">Arquivo (até 10 MiB)</Label>
              <Input id="knowledge-file" name="file" type="file" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                Enviar arquivo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'draft'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={submitDraft} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {draftVersion ? `Editar draft v${draftVersion.version}` : 'Criar próxima versão'}
              </DialogTitle>
              <DialogDescription>
                O hash e a versão atuais serão usados para impedir sobrescrita concorrente.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="draft-content">Conteúdo</Label>
            <Textarea
              id="draft-content"
              required
              className="min-h-72 font-mono text-xs"
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="draft-effective-from">Vigente a partir de</Label>
                <Input
                  id="draft-effective-from"
                  type="datetime-local"
                  value={draftEffectiveFrom}
                  onChange={(event) => setDraftEffectiveFrom(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="draft-effective-until">Vigente até</Label>
                <Input
                  id="draft-effective-until"
                  type="datetime-local"
                  value={draftEffectiveUntil}
                  onChange={(event) => setDraftEffectiveUntil(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                Salvar draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
