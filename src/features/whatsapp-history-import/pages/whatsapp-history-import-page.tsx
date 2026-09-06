'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  LoaderCircle,
  MessageSquareWarning,
  Paperclip,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { z } from 'zod';

import { cn } from '@/shared/lib/utils';
import { Button, buttonVariants } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Progress } from '@/shared/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/form-select';
import { toast } from '@/shared/ui/toast';

import {
  buildPaginationItems,
  WHATSAPP_HISTORY_DEPARTMENTS,
  WHATSAPP_HISTORY_DEPARTMENT_LABELS,
  WHATSAPP_HISTORY_REVIEW_FILTER_LABELS,
  WHATSAPP_HISTORY_STATES,
  WHATSAPP_HISTORY_STATE_LABELS,
  WHATSAPP_IMPORT_MESSAGE_KIND_LABELS,
  type WhatsAppHistoryArchive,
  type WhatsAppHistoryDepartment,
  type WhatsAppHistoryDivergence,
  type WhatsAppHistoryImportBatch,
  type WhatsAppHistoryReviewFilter,
  type WhatsAppHistoryState,
  whatsAppHistoryChannelSchema,
  whatsAppHistoryDivergenceListSchema,
  whatsAppHistoryDivergenceResolutionSchema,
  whatsAppHistoryImportBatchSchema,
} from '../domain';

const channelsSchema = z.array(whatsAppHistoryChannelSchema);
const appliedAndroidBackupsSchema = z.array(whatsAppHistoryImportBatchSchema);
const resumableUploadSchema = z.object({
  schemaVersion: z.literal('1.0'),
  uploadId: z.string().uuid(),
  fileName: z.string().min(1),
  totalBytes: z.number().int().positive(),
  uploadedBytes: z.number().int().nonnegative(),
  chunkSizeBytes: z.number().int().positive().optional(),
  status: z.enum([
    'uploading',
    'validating',
    'ready',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'expired',
  ]),
  fingerprint: z.string().min(1).optional(),
  checksumSha256: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});
const PAGE_SIZE = 20;
const ACTIVE_BATCH_STORAGE_KEY = 'lume.whatsapp-history-import.active-batch';
const FILE_FINGERPRINT_SAMPLE_BYTES = 64 * 1024;

function plural(value: number, singular: string, pluralForm: string): string {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unit}`;
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === 'string' && body.message.trim() ? body.message : fallback;
  } catch {
    return fallback;
  }
}

async function responseJson(response: Response): Promise<unknown | null> {
  const content = await response.text();
  if (!content.trim()) return null;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error('O servidor retornou uma resposta incompleta. Tente novamente.');
  }
}

const TRANSIENT_UPLOAD_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

async function uploadFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  maximumAttempts = 5,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!TRANSIENT_UPLOAD_STATUSES.has(response.status) || attempt === maximumAttempts) {
        return response;
      }
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
      if (attempt === maximumAttempts) throw error;
    }
    const delay = Math.min(8_000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
    await new Promise((resolve) => window.setTimeout(resolve, delay));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('A conexão foi interrompida durante o envio. Tente novamente.');
}

async function parseBatch(response: Response): Promise<WhatsAppHistoryImportBatch> {
  if (!response.ok) {
    throw new Error(await responseMessage(response, 'Não foi possível processar a importação.'));
  }
  const payload = await responseJson(response);
  if (!payload) {
    throw new Error('O servidor não confirmou o estado da importação. Tente novamente.');
  }
  return whatsAppHistoryImportBatchSchema.parse(payload);
}

async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fileFingerprint(file: File): Promise<string> {
  const sample = FILE_FINGERPRINT_SAMPLE_BYTES;
  const first = file.slice(0, Math.min(sample, file.size));
  const last = file.slice(Math.max(0, file.size - sample), file.size);
  const metadata = new TextEncoder().encode(
    `${file.name}\u0000${file.size}\u0000${file.lastModified}\u0000${file.type}`,
  );
  const payload = new Uint8Array(metadata.byteLength + first.size + last.size);
  payload.set(metadata, 0);
  payload.set(new Uint8Array(await first.arrayBuffer()), metadata.byteLength);
  payload.set(new Uint8Array(await last.arrayBuffer()), metadata.byteLength + first.size);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

type ResumableUpload = z.infer<typeof resumableUploadSchema>;

async function sendResumableChunk(input: {
  batchId: string;
  upload: ResumableUpload;
  offset: number;
  chunk: Blob;
  fileName: string;
  kind: 'android-database-uploads' | 'android-media-uploads';
}): Promise<ResumableUpload> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const formData = new FormData();
    formData.set('offsetBytes', String(input.offset));
    formData.set('checksumSha256', await sha256Blob(input.chunk));
    formData.set('chunk', input.chunk, `${input.fileName}.part`);
    try {
      const response = await fetch(
        `/api/whatsapp-history-import/batches/${input.batchId}/${input.kind}/${input.upload.uploadId}/chunks`,
        { method: 'POST', body: formData },
      );
      if (response.ok) {
        const updated = resumableUploadSchema.parse(await response.json());
        return {
          ...updated,
          chunkSizeBytes: updated.chunkSizeBytes ?? input.upload.chunkSizeBytes,
        };
      }
      if (!TRANSIENT_UPLOAD_STATUSES.has(response.status) && response.status !== 409) {
        throw new Error(
          await responseMessage(response, 'Não foi possível continuar o envio do arquivo.'),
        );
      }
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
    }

    try {
      const statusResponse = await fetch(
        `/api/whatsapp-history-import/batches/${input.batchId}/uploads/${input.upload.uploadId}`,
        { cache: 'no-store' },
      );
      if (statusResponse.ok) {
        const status = resumableUploadSchema.parse(await statusResponse.json());
        if (status.uploadedBytes > input.offset) {
          return { ...status, chunkSizeBytes: input.upload.chunkSizeBytes };
        }
        if (['cancelled', 'expired'].includes(status.status)) {
          throw new Error('Este envio foi cancelado ou expirou. Selecione o arquivo novamente.');
        }
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) =>
      window.setTimeout(resolve, Math.min(8_000, 500 * 2 ** (attempt - 1))),
    );
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('A conexão foi interrompida durante o envio. Tente novamente.');
}

function localDateTimeValue(value = new Date()): string {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function importPhaseLabel(phase: string): string {
  if (phase.startsWith('processing-media:')) {
    const mediaPhase = phase.split(':')[1];
    return mediaPhase === 'storing' ? 'Armazenamento das mídias' : 'Leitura das mídias';
  }
  return (
    {
      draft: 'Preparação',
      uploading: 'Envio dos arquivos',
      'uploading-database': 'Envio do banco de mensagens',
      'uploading-media': 'Envio das mídias',
      validating: 'Validação do backup',
      'validating-database': 'Validação do banco de mensagens',
      'validating-media': 'Validação do arquivo de mídias',
      ready: 'Pronto para aplicar',
      applying: 'Importação das mensagens',
      'applying-messages': 'Importação das mensagens',
      'finalizing-import': 'Finalização da importação',
      'processing-preview': 'Comparação das mensagens',
      'comparing-messages': 'Comparação das mensagens',
      'processing-media': 'Vinculação das mídias',
      'awaiting-divergence-resolution': 'Revisão das mensagens divergentes',
      completed: 'Concluída',
      failed: 'Aguardando nova tentativa',
      cancelled: 'Cancelada',
      expired: 'Expirada',
    }[phase] ?? 'Processamento'
  );
}

function importPollDelay(phase: string): number {
  if (phase === 'ready' || phase === 'awaiting-divergence-resolution') return 15_000;
  if (phase.startsWith('uploading-')) return 10_000;
  return 5_000;
}

function divergenceMessageText(message: WhatsAppHistoryDivergence['existing']): string {
  const text = message.text?.trim();
  if (text) return text;
  if (message.hasMedia) return `${WHATSAPP_IMPORT_MESSAGE_KIND_LABELS[message.kind]} anexado`;
  return 'Mensagem sem texto';
}

interface DivergenceReviewCardProps {
  readonly divergence: WhatsAppHistoryDivergence;
  readonly saving: boolean;
  readonly onResolve: (
    externalMessageId: string,
    resolution: 'keep-existing' | 'use-backup',
  ) => void;
}

function DivergenceReviewCard({ divergence, saving, onResolve }: DivergenceReviewCardProps) {
  const contact = divergence.contactName?.trim() || divergence.phoneE164 || 'Contato não informado';
  return (
    <article className="grid gap-4 rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{contact}</p>
          <p className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(divergence.occurredAt))}
            {divergence.senderName ? ` · Enviada por ${divergence.senderName}` : ''}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-1 text-xs font-semibold',
            divergence.resolution
              ? 'bg-success/15 text-success-emphasis'
              : 'bg-warning/15 text-warning-emphasis',
          )}
        >
          {divergence.resolution ? 'Decisão registrada' : 'Decisão necessária'}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="grid content-start gap-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mensagem que já está no Lume
          </p>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            {divergenceMessageText(divergence.existing)}
          </p>
          <p className="text-xs text-muted-foreground">
            {WHATSAPP_IMPORT_MESSAGE_KIND_LABELS[divergence.existing.kind]}
          </p>
        </div>
        <div className="grid content-start gap-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mensagem encontrada no backup
          </p>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            {divergenceMessageText(divergence.backup)}
          </p>
          <p className="text-xs text-muted-foreground">
            {WHATSAPP_IMPORT_MESSAGE_KIND_LABELS[divergence.backup.kind]}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={divergence.resolution === 'keep-existing' ? 'default' : 'outline'}
          disabled={saving}
          onClick={() => onResolve(divergence.externalMessageId, 'keep-existing')}
        >
          {saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
          Manter mensagem do Lume
        </Button>
        <Button
          type="button"
          size="sm"
          variant={divergence.resolution === 'use-backup' ? 'default' : 'outline'}
          disabled={saving}
          onClick={() => onResolve(divergence.externalMessageId, 'use-backup')}
        >
          Usar mensagem do backup
        </Button>
      </div>
      {divergence.decidedByUsername ? (
        <p className="text-xs text-muted-foreground">
          Revisada por {divergence.decidedByUsername}.
        </p>
      ) : null}
    </article>
  );
}

interface ArchiveReviewCardProps {
  readonly batchId: string;
  readonly archive: WhatsAppHistoryArchive;
  readonly onSaved: (batch: WhatsAppHistoryImportBatch) => void;
}

function ArchiveReviewCard({ batchId, archive, onSaved }: ArchiveReviewCardProps) {
  const [contactName, setContactName] = useState(archive.contactName ?? '');
  const [phoneE164, setPhoneE164] = useState(archive.phoneE164 ?? '');
  const [companySenderName, setCompanySenderName] = useState(archive.companySenderName ?? '');
  const [state, setState] = useState<WhatsAppHistoryState | ''>(archive.state ?? '');
  const [department, setDepartment] = useState<WhatsAppHistoryDepartment>(archive.departmentCode);
  const [ownerUsername, setOwnerUsername] = useState(archive.ownerUsername ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/whatsapp-history-import/batches/${batchId}/archives/${encodeURIComponent(archive.archiveId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactName,
            phoneE164,
            companySenderName,
            state,
            departmentCode: department,
            ownerUsername: state === 'human-active' ? ownerUsername : null,
          }),
        },
      );
      const updated = await parseBatch(response);
      onSaved(updated);
      toast.add({
        title: 'Conversa revisada',
        description: 'Os dados foram salvos neste lote.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Não foi possível salvar',
        description: error instanceof Error ? error.message : 'Revise os campos e tente novamente.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={archive.status === 'ready' ? 'ring-success/30' : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <FileArchive aria-hidden="true" className="size-4 text-primary-emphasis" />
          <span className="min-w-0 truncate">{archive.archiveName}</span>
          <span
            className={cn(
              'ml-auto rounded-full px-2 py-1 text-xs font-semibold',
              archive.status === 'ready'
                ? 'bg-success/15 text-success-emphasis'
                : 'bg-warning/15 text-warning-emphasis',
            )}
          >
            {archive.status === 'ready' ? 'Revisado' : 'Revisão necessária'}
          </span>
        </CardTitle>
        <CardDescription>
          {plural(archive.messageCount, 'mensagem', 'mensagens')} ·{' '}
          {plural(archive.attachmentCount, 'anexo', 'anexos')}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {archive.issues.length > 0 ? (
          <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning-emphasis">
            {archive.issues.join(' ')}
          </div>
        ) : null}
        {archive.missingAttachmentCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            {plural(
              archive.missingAttachmentCount,
              'anexo citado não está no ZIP',
              'anexos citados não estão no ZIP',
            )}
            . O histórico textual poderá ser importado mesmo assim.
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Nome do contato
            <Input value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Número do WhatsApp com DDD
            <Input
              inputMode="tel"
              placeholder="5534999999999"
              value={phoneE164}
              onChange={(event) => setPhoneE164(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Remetente que representa a empresa
            <Select
              value={companySenderName}
              onValueChange={(value) => setCompanySenderName(value ?? '')}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Selecione o remetente" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {archive.senders.map((sender) => (
                  <SelectItem key={sender.name} value={sender.name}>
                    {sender.name} · {plural(sender.messageCount, 'mensagem', 'mensagens')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Situação atual da conversa
            <Select
              value={state}
              onValueChange={(value) => setState(value as WhatsAppHistoryState)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Selecione a situação">
                  {state ? WHATSAPP_HISTORY_STATE_LABELS[state] : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {WHATSAPP_HISTORY_STATES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {WHATSAPP_HISTORY_STATE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Departamento responsável
            <Select
              value={department}
              onValueChange={(value) => setDepartment(value as WhatsAppHistoryDepartment)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue>{WHATSAPP_HISTORY_DEPARTMENT_LABELS[department]}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {WHATSAPP_HISTORY_DEPARTMENTS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {WHATSAPP_HISTORY_DEPARTMENT_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {state === 'human-active' ? (
            <label className="grid gap-1.5 text-sm font-medium">
              Usuário do atendente ativo
              <Input
                value={ownerUsername}
                onChange={(event) => setOwnerUsername(event.target.value)}
              />
            </label>
          ) : null}
        </div>
        <div>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
            {saving ? 'Salvando' : 'Salvar revisão'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WhatsAppHistoryImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const historicalMediaInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'zip-exports' | 'android-backup'>('android-backup');
  const [channels, setChannels] = useState<z.infer<typeof channelsSchema>>([]);
  const [channelId, setChannelId] = useState('');
  const [batch, setBatch] = useState<WhatsAppHistoryImportBatch | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [databaseUploadBytes, setDatabaseUploadBytes] = useState(0);
  const [databaseUploadBytesTotal, setDatabaseUploadBytesTotal] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<
    readonly { fileName: string; message: string }[]
  >([]);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState<WhatsAppHistoryReviewFilter>('needs-review');
  const [page, setPage] = useState(1);
  const [cutoffAt, setCutoffAt] = useState(localDateTimeValue);
  const [applying, setApplying] = useState(false);
  const [rootKey, setRootKey] = useState('');
  const [androidState, setAndroidState] = useState<WhatsAppHistoryState>('closed');
  const [androidDepartment, setAndroidDepartment] =
    useState<WhatsAppHistoryDepartment>('commercial');
  const [androidOwnerUsername, setAndroidOwnerUsername] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaUploadCurrent, setMediaUploadCurrent] = useState(0);
  const [mediaUploadTotal, setMediaUploadTotal] = useState(0);
  const [mediaUploadBytes, setMediaUploadBytes] = useState(0);
  const [mediaUploadBytesTotal, setMediaUploadBytesTotal] = useState(0);
  const [mediaUploadErrors, setMediaUploadErrors] = useState<
    readonly { fileName: string; message: string }[]
  >([]);
  const [mediaUploadTargetId, setMediaUploadTargetId] = useState('');
  const [appliedAndroidBackups, setAppliedAndroidBackups] = useState<
    readonly WhatsAppHistoryImportBatch[]
  >([]);
  const [selectedMediaBatchId, setSelectedMediaBatchId] = useState('');
  const [loadingAppliedBackups, setLoadingAppliedBackups] = useState(true);
  const [appliedBackupsError, setAppliedBackupsError] = useState('');
  const [divergences, setDivergences] = useState<readonly WhatsAppHistoryDivergence[]>([]);
  const [loadedDivergencesBatchId, setLoadedDivergencesBatchId] = useState('');
  const [divergencesError, setDivergencesError] = useState('');
  const [savingDivergenceId, setSavingDivergenceId] = useState<string | null>(null);
  const [recoveringBatch, setRecoveringBatch] = useState(true);
  const [connectionState, setConnectionState] = useState<'connected' | 'recovering' | 'offline'>(
    'connected',
  );
  const [lastSynchronizedAt, setLastSynchronizedAt] = useState<Date | null>(null);

  const rememberAppliedBackup = useCallback((updated: WhatsAppHistoryImportBatch) => {
    if (updated.status !== 'applied' || !updated.androidBackup) return;
    setAppliedAndroidBackups((current) => {
      const withoutUpdated = current.filter((item) => item.id !== updated.id);
      return [updated, ...withoutUpdated];
    });
    setSelectedMediaBatchId((current) => current || updated.id);
  }, []);

  useEffect(() => {
    let active = true;
    const recover = async () => {
      const queryBatchId = new URL(window.location.href).searchParams.get('batch');
      const storedBatchId = window.localStorage.getItem(ACTIVE_BATCH_STORAGE_KEY);
      const requestedBatchId = queryBatchId || storedBatchId;
      const path = requestedBatchId
        ? `/api/whatsapp-history-import/batches/${requestedBatchId}`
        : '/api/whatsapp-history-import/batches/active';
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
          if (response.status === 404 && requestedBatchId) {
            window.localStorage.removeItem(ACTIVE_BATCH_STORAGE_KEY);
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }
          throw new Error(
            await responseMessage(
              response,
              'Não foi possível recuperar a importação em andamento.',
            ),
          );
        }
        const payload = await responseJson(response);
        if (!payload || !active) return;
        const recovered = whatsAppHistoryImportBatchSchema.parse(payload);
        setBatch(recovered);
        setChannelId(recovered.channel.id);
        setImportMode(recovered.mode);
        const savedCutoffAt = recovered.androidBackup?.cutoffAt;
        if (savedCutoffAt) {
          const savedCutoffDate = new Date(savedCutoffAt);
          if (!Number.isNaN(savedCutoffDate.getTime())) {
            setCutoffAt(localDateTimeValue(savedCutoffDate));
          }
        }
        setLastSynchronizedAt(new Date());
        setConnectionState('connected');
      } catch (error) {
        if (!active) return;
        setConnectionState('offline');
        toast.add({
          title: 'Importação não recuperada',
          description: error instanceof Error ? error.message : 'Tente novamente.',
          type: 'error',
        });
      } finally {
        if (active) setRecoveringBatch(false);
      }
    };
    void recover();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!batch || ['applied', 'cancelled', 'expired'].includes(batch.status)) {
      window.localStorage.removeItem(ACTIVE_BATCH_STORAGE_KEY);
      if (new URL(window.location.href).searchParams.has('batch')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      return;
    }
    window.localStorage.setItem(ACTIVE_BATCH_STORAGE_KEY, batch.id);
    const url = new URL(window.location.href);
    if (url.searchParams.get('batch') !== batch.id) {
      url.searchParams.set('batch', batch.id);
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  }, [batch]);

  useEffect(() => {
    let active = true;
    void fetch('/api/whatsapp-history-import/channels', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await responseMessage(response, 'Não foi possível carregar os canais.'));
        }
        return channelsSchema.parse(await response.json());
      })
      .then((result) => {
        if (!active) return;
        setChannels(result);
        setChannelId((current) => current || result[0]?.id || '');
      })
      .catch((error: unknown) => {
        toast.add({
          title: 'Canais indisponíveis',
          description: error instanceof Error ? error.message : 'Tente novamente.',
          type: 'error',
        });
      })
      .finally(() => {
        if (active) setLoadingChannels(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/whatsapp-history-import/android-backups', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseMessage(response, 'Não foi possível carregar os backups concluídos.'),
          );
        }
        return appliedAndroidBackupsSchema.parse(await response.json());
      })
      .then((result) => {
        if (!active) return;
        setAppliedAndroidBackups(result);
        setSelectedMediaBatchId((current) =>
          result.some((item) => item.id === current) ? current : (result[0]?.id ?? ''),
        );
        setAppliedBackupsError('');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAppliedBackupsError(
          error instanceof Error ? error.message : 'Não foi possível carregar os backups.',
        );
      })
      .finally(() => {
        if (active) setLoadingAppliedBackups(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeBatchId = batch?.id;
  const activeBatchStatus = batch?.status;
  const activeBatchPhase = batch?.operation.phase;

  useEffect(() => {
    if (!activeBatchId || ['applied', 'cancelled', 'expired'].includes(activeBatchStatus ?? '')) {
      return;
    }
    let active = true;
    let timer: number | undefined;
    let failures = 0;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(() => void refresh(), 15_000);
        return;
      }
      try {
        const response = await fetch(`/api/whatsapp-history-import/batches/${activeBatchId}`, {
          cache: 'no-store',
        });
        const updated = await parseBatch(response);
        if (!active) return;
        failures = 0;
        setBatch(updated);
        rememberAppliedBackup(updated);
        setConnectionState('connected');
        setLastSynchronizedAt(new Date());
      } catch {
        if (!active) return;
        failures += 1;
        setConnectionState(failures >= 4 ? 'offline' : 'recovering');
      }
      if (!active) return;
      const delay =
        failures === 0
          ? importPollDelay(activeBatchPhase ?? 'processing')
          : Math.min(30_000, 1_000 * 2 ** failures);
      timer = window.setTimeout(() => void refresh(), delay);
    };
    timer = window.setTimeout(() => void refresh(), 1_000);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeBatchId, activeBatchPhase, activeBatchStatus, rememberAppliedBackup]);

  const divergenceBatchId = batch?.androidBackup ? batch.id : undefined;
  const divergenceComparisonStatus = batch?.androidBackup?.comparison?.status;
  const divergenceCount = batch?.androidBackup?.comparison?.messagesDivergent;
  const divergenceComparisonUpdatedAt = batch?.androidBackup?.comparison?.updatedAt;
  const loadingDivergences = Boolean(
    divergenceBatchId &&
    divergenceComparisonStatus === 'ready' &&
    divergenceCount !== 0 &&
    loadedDivergencesBatchId !== divergenceBatchId,
  );

  useEffect(() => {
    if (!divergenceBatchId || divergenceComparisonStatus !== 'ready' || divergenceCount === 0) {
      return;
    }
    let active = true;
    void fetch(`/api/whatsapp-history-import/batches/${divergenceBatchId}/android-divergences`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseMessage(response, 'Não foi possível carregar as mensagens divergentes.'),
          );
        }
        return whatsAppHistoryDivergenceListSchema.parse(await response.json());
      })
      .then((result) => {
        if (!active) return;
        setDivergences(result.items);
        setLoadedDivergencesBatchId(divergenceBatchId);
        setDivergencesError('');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadedDivergencesBatchId(divergenceBatchId);
        setDivergencesError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as mensagens divergentes.',
        );
      });
    return () => {
      active = false;
    };
  }, [
    divergenceBatchId,
    divergenceComparisonStatus,
    divergenceCount,
    divergenceComparisonUpdatedAt,
  ]);

  const appliedProcessingIdsKey = appliedAndroidBackups
    .filter(
      (item) =>
        item.id !== activeBatchId &&
        ['validating', 'processing'].includes(item.androidBackup?.mediaImport?.status ?? ''),
    )
    .map((item) => item.id)
    .sort()
    .join(',');

  useEffect(() => {
    const processingIds = appliedProcessingIdsKey ? appliedProcessingIdsKey.split(',') : [];
    if (processingIds.length === 0) return;
    let active = true;
    let timer: number | undefined;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(() => void refresh(), 15_000);
        return;
      }
      try {
        const updatedBatches = await Promise.all(
          processingIds.map((batchId) =>
            fetch(`/api/whatsapp-history-import/batches/${batchId}`, {
              cache: 'no-store',
            }).then(parseBatch),
          ),
        );
        if (!active) return;
        setAppliedAndroidBackups((current) => {
          const updatedById = new Map(updatedBatches.map((item) => [item.id, item]));
          return current.map((item) => updatedById.get(item.id) ?? item);
        });
      } catch {
        // A próxima consulta tentará recuperar a sincronização sem interromper o processamento.
      }
      if (active) timer = window.setTimeout(() => void refresh(), 5_000);
    };
    timer = window.setTimeout(() => void refresh(), 1_000);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [appliedProcessingIdsKey]);

  const filteredArchives = useMemo(() => {
    if (!batch) return [];
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return batch.archives.filter((archive) => {
      const matchesStatus = reviewFilter === 'all' || archive.status === reviewFilter;
      const matchesSearch =
        !query ||
        archive.archiveName.toLocaleLowerCase('pt-BR').includes(query) ||
        archive.contactName?.toLocaleLowerCase('pt-BR').includes(query) ||
        archive.phoneE164?.includes(query);
      return matchesStatus && Boolean(matchesSearch);
    });
  }, [batch, reviewFilter, search]);
  const pageCount = Math.max(1, Math.ceil(filteredArchives.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleArchives = filteredArchives.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const selectedChannel = channels.find((channel) => channel.id === channelId);
  const pendingAndroidMediaBatch =
    batch?.androidBackup && batch.status !== 'applied' ? batch : undefined;
  const selectedMediaBatch =
    pendingAndroidMediaBatch ??
    appliedAndroidBackups.find((item) => item.id === selectedMediaBatchId);
  const selectedMediaImport = selectedMediaBatch?.androidBackup?.mediaImport;
  const selectedMediaProcessing = ['validating', 'processing'].includes(
    selectedMediaImport?.status ?? '',
  );
  const selectedMediaApplying = selectedMediaBatch?.status === 'applying';
  const currentBatchMediaImport = batch?.androidBackup?.mediaImport;
  const currentBatchMediaProcessing = ['validating', 'processing'].includes(
    currentBatchMediaImport?.status ?? '',
  );

  async function ensureBatch(): Promise<WhatsAppHistoryImportBatch> {
    if (batch) return batch;
    if (!channelId) throw new Error('Selecione o canal de WhatsApp.');
    const response = await fetch('/api/whatsapp-history-import/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: crypto.randomUUID(), channelId }),
    });
    const created = await parseBatch(response);
    setBatch(created);
    return created;
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    const accepted = selected.filter((file) =>
      file.name.toLocaleLowerCase('pt-BR').endsWith('.zip'),
    );
    const rejected = selected
      .filter((file) => !file.name.toLocaleLowerCase('pt-BR').endsWith('.zip'))
      .map((file) => ({
        fileName: file.name,
        message: 'O arquivo não é um backup ZIP do WhatsApp.',
      }));
    if (accepted.length === 0) {
      setUploadTotal(selected.length);
      setUploadCurrent(selected.length);
      setUploadSuccess(0);
      setUploadErrors(rejected);
      toast.add({
        title: 'Nenhum backup aceito',
        description: 'Selecione backups ZIP exportados pelo WhatsApp.',
        type: 'error',
      });
      return;
    }
    setUploading(true);
    setUploadCurrent(rejected.length);
    setUploadTotal(selected.length);
    setUploadSuccess(0);
    setUploadErrors(rejected);
    try {
      let currentBatch = await ensureBatch();
      const failures: Array<{ fileName: string; message: string }> = [...rejected];
      let successes = 0;
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        try {
          const formData = new FormData();
          formData.set('archive', file);
          const response = await fetch(
            `/api/whatsapp-history-import/batches/${currentBatch.id}/archives`,
            { method: 'POST', body: formData },
          );
          currentBatch = await parseBatch(response);
          successes += 1;
          setBatch(currentBatch);
          setUploadSuccess(successes);
        } catch (error) {
          failures.push({
            fileName: file.name,
            message: error instanceof Error ? error.message : 'O arquivo não pôde ser lido.',
          });
          setUploadErrors([...failures]);
        } finally {
          setUploadCurrent(rejected.length + index + 1);
          if (index < accepted.length - 1) {
            await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
          }
        }
      }
      toast.add({
        title: 'Backups processados',
        description:
          failures.length === 0
            ? `${plural(successes, 'arquivo foi lido', 'arquivos foram lidos')}. Revise os dados antes de aplicar.`
            : `${plural(successes, 'arquivo válido', 'arquivos válidos')} e ${plural(failures.length, 'arquivo com erro', 'arquivos com erro')}.`,
        type: failures.length === selected.length ? 'error' : 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Importação interrompida',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function uploadAndroid(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLocaleLowerCase('pt-BR').endsWith('.crypt15')) {
      toast.add({
        title: 'Arquivo incompatível',
        description: 'Selecione o arquivo msgstore.db.crypt15.',
        type: 'error',
      });
      return;
    }
    if (!/^[0-9a-fA-F]{64}$/.test(rootKey.trim())) {
      toast.add({
        title: 'Chave inválida',
        description: 'Informe os 64 caracteres hexadecimais da chave crypt15.',
        type: 'error',
      });
      return;
    }
    if (androidState === 'human-active' && !androidOwnerUsername.trim()) {
      toast.add({
        title: 'Atendente obrigatório',
        description: 'Informe o usuário responsável pelo atendimento humano ativo.',
        type: 'error',
      });
      return;
    }
    setUploading(true);
    setUploadTotal(1);
    setUploadCurrent(0);
    setDatabaseUploadBytes(0);
    setDatabaseUploadBytesTotal(file.size);
    setUploadSuccess(0);
    setUploadErrors([]);
    try {
      const currentBatch = await ensureBatch();
      const fingerprint = await fileFingerprint(file);
      const startResponse = await uploadFetch(
        `/api/whatsapp-history-import/batches/${currentBatch.id}/android-database-uploads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, sizeBytes: file.size, fingerprint }),
        },
      );
      if (!startResponse.ok) {
        throw new Error(
          await responseMessage(startResponse, 'Não foi possível iniciar o envio do backup.'),
        );
      }

      let upload = resumableUploadSchema.parse(await startResponse.json());
      let offset = upload.uploadedBytes;
      setDatabaseUploadBytes(offset);
      while (offset < file.size) {
        const end = Math.min(file.size, offset + (upload.chunkSizeBytes ?? 16 * 1024 * 1024));
        const chunk = file.slice(offset, end);
        const previousOffset = offset;
        upload = await sendResumableChunk({
          batchId: currentBatch.id,
          upload,
          offset,
          chunk,
          fileName: file.name,
          kind: 'android-database-uploads',
        });
        offset = upload.uploadedBytes;
        if (offset <= previousOffset || offset > file.size) {
          throw new Error('O servidor não confirmou o avanço do envio. Tente novamente.');
        }
        setDatabaseUploadBytes(offset);
      }

      const response = await uploadFetch(
        `/api/whatsapp-history-import/batches/${currentBatch.id}/android-database-uploads/${upload.uploadId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rootKey: rootKey.trim(),
            state: androidState,
            departmentCode: androidDepartment,
            ...(androidOwnerUsername.trim() ? { ownerUsername: androidOwnerUsername.trim() } : {}),
          }),
        },
      );
      const updated = await parseBatch(response);
      setBatch(updated);
      rememberAppliedBackup(updated);
      setImportMode('android-backup');
      setRootKey('');
      setUploadSuccess(1);
      toast.add({
        title: 'Backup completo validado',
        description: `${plural(updated.totals.archives, 'conversa encontrada', 'conversas encontradas')}.`,
        type: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'O backup não pôde ser lido.';
      setUploadErrors([{ fileName: file.name, message }]);
      toast.add({ title: 'Backup não validado', description: message, type: 'error' });
    } finally {
      setUploadCurrent(1);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function uploadAndroidMedia(
    targetBatch: WhatsAppHistoryImportBatch,
    files: FileList | null,
    inputRef: RefObject<HTMLInputElement | null>,
  ) {
    if (
      !targetBatch.androidBackup ||
      !['draft', 'failed', 'applied'].includes(targetBatch.status) ||
      !files?.length
    )
      return;
    const selected = Array.from(files);
    const accepted = selected.filter((file) =>
      file.name.toLocaleLowerCase('pt-BR').endsWith('.zip'),
    );
    const failures: Array<{ fileName: string; message: string }> = selected
      .filter((file) => !file.name.toLocaleLowerCase('pt-BR').endsWith('.zip'))
      .map((file) => ({
        fileName: file.name,
        message: 'Selecione um arquivo ZIP criado a partir da pasta Media.',
      }));
    setMediaUploading(true);
    setMediaUploadCurrent(failures.length);
    setMediaUploadTotal(selected.length);
    setMediaUploadBytes(0);
    setMediaUploadBytesTotal(accepted.reduce((total, file) => total + file.size, 0));
    setMediaUploadErrors(failures);
    setMediaUploadTargetId(targetBatch.id);
    let currentBatch = targetBatch;
    let successes = 0;
    let completedBytes = 0;
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        try {
          const fingerprint = await fileFingerprint(file);
          const startResponse = await uploadFetch(
            `/api/whatsapp-history-import/batches/${targetBatch.id}/android-media-uploads`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: file.name, sizeBytes: file.size, fingerprint }),
            },
          );
          if (!startResponse.ok) {
            throw new Error(
              await responseMessage(startResponse, 'Não foi possível iniciar o envio do ZIP.'),
            );
          }
          let upload = resumableUploadSchema.parse(await startResponse.json());
          let offset = upload.uploadedBytes;
          setMediaUploadBytes(completedBytes + offset);
          while (offset < file.size) {
            const end = Math.min(file.size, offset + (upload.chunkSizeBytes ?? 16 * 1024 * 1024));
            const chunk = file.slice(offset, end);
            const previousOffset = offset;
            upload = await sendResumableChunk({
              batchId: targetBatch.id,
              upload,
              offset,
              chunk,
              fileName: file.name,
              kind: 'android-media-uploads',
            });
            offset = upload.uploadedBytes;
            if (offset <= previousOffset || offset > file.size) {
              throw new Error('O servidor não confirmou o avanço do envio. Tente novamente.');
            }
            setMediaUploadBytes(completedBytes + offset);
          }
          const completeResponse = await uploadFetch(
            `/api/whatsapp-history-import/batches/${targetBatch.id}/android-media-uploads/${upload.uploadId}/complete`,
            { method: 'POST' },
          );
          currentBatch = await parseBatch(completeResponse);
          setBatch((current) => (current?.id === currentBatch.id ? currentBatch : current));
          if (currentBatch.status === 'applied') {
            setAppliedAndroidBackups((current) => {
              const withoutUpdated = current.filter((item) => item.id !== currentBatch.id);
              return [currentBatch, ...withoutUpdated];
            });
          }
          successes += 1;
          completedBytes += file.size;
          setMediaUploadBytes(completedBytes);
        } catch (error) {
          failures.push({
            fileName: file.name,
            message:
              error instanceof Error ? error.message : 'O ZIP de mídias não pôde ser processado.',
          });
          setMediaUploadErrors([...failures]);
        } finally {
          setMediaUploadCurrent(failures.length + successes);
        }
      }
      toast.add({
        title: failures.length === selected.length ? 'Mídias não enviadas' : 'ZIP recebido',
        description:
          failures.length === 0
            ? currentBatch.status === 'applied'
              ? `${plural(successes, 'arquivo ZIP enviado', 'arquivos ZIP enviados')}. A vinculação continuará em segundo plano e o progresso será atualizado nesta tela.`
              : 'O ZIP da pasta Media está validado. Ao aplicar, mensagens e mídias serão processadas no mesmo fluxo.'
            : `${plural(successes, 'arquivo enviado', 'arquivos enviados')} e ${plural(failures.length, 'arquivo com erro', 'arquivos com erro')}.`,
        type: failures.length === selected.length ? 'error' : 'success',
      });
    } finally {
      setMediaUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function applyImport() {
    if (!batch) return;
    setApplying(true);
    try {
      const cutoffDate = new Date(cutoffAt);
      const response = await fetch(`/api/whatsapp-history-import/batches/${batch.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cutoffAt: cutoffDate.toISOString() }),
      });
      const updated = await parseBatch(response);
      setBatch(updated);
      rememberAppliedBackup(updated);
      toast.add({
        title: updated.status === 'applying' ? 'Importação iniciada' : 'Históricos importados',
        description:
          updated.status === 'applying'
            ? 'O backup está sendo processado em blocos. Você pode acompanhar o progresso nesta tela.'
            : 'As conversas foram consolidadas no painel do WhatsApp.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Importação não concluída',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setApplying(false);
    }
  }

  async function cancelImport() {
    if (!batch || ['applied', 'cancelled', 'expired'].includes(batch.status)) return;
    try {
      const response = await fetch(`/api/whatsapp-history-import/batches/${batch.id}`, {
        method: 'DELETE',
      });
      const cancelled = await parseBatch(response);
      setBatch(null);
      setUploadTotal(0);
      setUploadCurrent(0);
      setUploadErrors([]);
      setMediaUploadErrors([]);
      window.localStorage.removeItem(ACTIVE_BATCH_STORAGE_KEY);
      window.history.replaceState(null, '', window.location.pathname);
      toast.add({
        title: 'Importação cancelada',
        description:
          cancelled.status === 'cancelled'
            ? 'Os arquivos temporários deste lote foram removidos.'
            : 'A importação foi encerrada.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Não foi possível cancelar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        type: 'error',
      });
    }
  }

  async function resolveDivergence(
    externalMessageId: string,
    resolution: 'keep-existing' | 'use-backup',
  ) {
    if (!batch) return;
    setSavingDivergenceId(externalMessageId);
    try {
      const response = await fetch(
        `/api/whatsapp-history-import/batches/${batch.id}/android-divergences/${encodeURIComponent(externalMessageId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, 'Não foi possível registrar a decisão desta mensagem.'),
        );
      }
      const result = whatsAppHistoryDivergenceResolutionSchema.parse(await response.json());
      setDivergences((current) =>
        current.map((item) =>
          item.externalMessageId === externalMessageId ? result.divergence : item,
        ),
      );
      setBatch((current) => {
        const androidBackup = current?.androidBackup;
        const comparison = androidBackup?.comparison;
        if (!current || !androidBackup || !comparison) return current;
        return {
          ...current,
          androidBackup: {
            ...androidBackup,
            comparison: {
              ...comparison,
              messagesDivergentPending: result.pending,
            },
          },
        };
      });
      toast.add({
        title: 'Decisão registrada',
        description:
          result.pending === 0
            ? 'Todas as mensagens divergentes foram corrigidas.'
            : plural(
                result.pending,
                'mensagem ainda precisa de revisão',
                'mensagens ainda precisam de revisão',
              ),
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Não foi possível salvar a decisão',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingDivergenceId(null);
    }
  }

  const readyToApply =
    batch !== null &&
    (batch.status === 'draft' || batch.status === 'failed') &&
    batch.totals.archives > 0 &&
    batch.totals.needsReview === 0 &&
    (!batch.androidBackup ||
      (batch.androidBackup.comparison?.status === 'ready' &&
        (batch.androidBackup.comparison.messagesDivergentPending ??
          batch.androidBackup.comparison.messagesDivergent) === 0 &&
        (batch.androidBackup.summary.mediaReferences === 0 ||
          batch.androidBackup.mediaImport?.status === 'ready')));
  const operationProgressPercent = batch?.operation.total
    ? Math.min(100, (batch.operation.processed / batch.operation.total) * 100)
    : 0;

  return (
    <main className="lume-page ">
      <Link
        href="/whatsapp-conversations"
        className={buttonVariants({ variant: 'ghost', className: 'mb-3' })}
      >
        <ArrowLeft /> Voltar ao painel
      </Link>
      <div className="max-w-4xl">
        <p className="text-sm font-semibold text-primary-emphasis">Painel WhatsApp</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Importar históricos de conversas
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Importe vários ZIPs individuais ou um banco completo do Android. Nenhuma conversa será
          gravada antes da confirmação final.
        </p>
      </div>

      {recoveringBatch ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Recuperando a importação em andamento
        </div>
      ) : batch ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <div>
            <p className="font-semibold">
              {connectionState === 'connected'
                ? 'Importação sincronizada'
                : connectionState === 'recovering'
                  ? 'Reconectando à importação'
                  : 'Sem conexão com a importação'}
            </p>
            <p className="text-muted-foreground">
              Etapa: {importPhaseLabel(batch.operation.phase)} ·{' '}
              {batch.operation.processed.toLocaleString('pt-BR')} de{' '}
              {batch.operation.total.toLocaleString('pt-BR')} processados
              {lastSynchronizedAt
                ? ` · Atualizado às ${lastSynchronizedAt.toLocaleTimeString('pt-BR')}`
                : ''}
            </p>
            {batch.operation.total > 0 &&
            !['ready', 'applied', 'cancelled', 'expired'].includes(batch.status) ? (
              <div className="mt-2 flex max-w-xl items-center gap-3">
                <Progress value={operationProgressPercent} className="h-2 flex-1" />
                <span className="min-w-12 text-right text-xs font-semibold tabular-nums">
                  {operationProgressPercent.toLocaleString('pt-BR', {
                    maximumFractionDigits: 0,
                  })}
                  %
                </span>
              </div>
            ) : null}
            {batch.operation.lastError ? (
              <p className="mt-1 text-destructive-emphasis">{batch.operation.lastError.message}</p>
            ) : null}
          </div>
          {!['applied', 'cancelled', 'expired'].includes(batch.status) ? (
            <Button type="button" variant="outline" onClick={() => void cancelImport()}>
              <X /> Cancelar importação
            </Button>
          ) : null}
        </div>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>1. Selecionar os backups</CardTitle>
          <CardDescription>
            Os arquivos são enviados um por vez para evitar sobrecarga. Backups repetidos são
            ignorados com segurança.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
          <div className="grid content-start gap-4">
            <div className="flex flex-wrap gap-2" aria-label="Tipo de importação">
              <Button
                type="button"
                variant={importMode === 'android-backup' ? 'default' : 'outline'}
                disabled={Boolean(batch)}
                onClick={() => setImportMode('android-backup')}
              >
                <Database /> Backup Android completo
              </Button>
              <Button
                type="button"
                variant={importMode === 'zip-exports' ? 'default' : 'outline'}
                disabled={Boolean(batch)}
                onClick={() => setImportMode('zip-exports')}
              >
                <FileArchive /> ZIPs individuais
              </Button>
            </div>
            <label className="grid max-w-xl gap-1.5 text-sm font-medium">
              Canal de destino
              <Select
                value={channelId}
                onValueChange={(value) => setChannelId(value ?? '')}
                disabled={Boolean(batch)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={loadingChannels ? 'Carregando' : 'Selecione o canal'}>
                    {selectedChannel
                      ? `${selectedChannel.name} · ${selectedChannel.phoneNumber}`
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name} · {channel.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {importMode === 'android-backup' && !batch?.androidBackup ? (
              <div className="grid max-w-3xl gap-4 rounded-lg border p-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
                  Chave crypt15 de 64 caracteres
                  <Input
                    type="password"
                    autoComplete="off"
                    value={rootKey}
                    onChange={(event) => setRootKey(event.target.value.replace(/\s/g, ''))}
                    placeholder="A chave não será armazenada"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Situação das conversas importadas
                  <Select
                    value={androidState}
                    onValueChange={(value) => setAndroidState(value as WhatsAppHistoryState)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue>{WHATSAPP_HISTORY_STATE_LABELS[androidState]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {WHATSAPP_HISTORY_STATES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {WHATSAPP_HISTORY_STATE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Departamento responsável
                  <Select
                    value={androidDepartment}
                    onValueChange={(value) =>
                      setAndroidDepartment(value as WhatsAppHistoryDepartment)
                    }
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue>
                        {WHATSAPP_HISTORY_DEPARTMENT_LABELS[androidDepartment]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {WHATSAPP_HISTORY_DEPARTMENTS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {WHATSAPP_HISTORY_DEPARTMENT_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {androidState === 'human-active' ? (
                  <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
                    Usuário do atendente responsável
                    <Input
                      value={androidOwnerUsername}
                      onChange={(event) => setAndroidOwnerUsername(event.target.value)}
                    />
                  </label>
                ) : null}
                <p className="text-xs leading-5 text-muted-foreground md:col-span-2">
                  Depois de validar o banco de mensagens, selecione o ZIP da pasta Media. A
                  aplicação só será liberada quando os dois arquivos estiverem prontos.
                </p>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept={
                importMode === 'android-backup'
                  ? '.crypt15,application/octet-stream'
                  : '.zip,application/zip'
              }
              multiple={importMode === 'zip-exports'}
              className="sr-only"
              onChange={(event) =>
                void (importMode === 'android-backup'
                  ? uploadAndroid(event.target.files)
                  : upload(event.target.files))
              }
            />
            <div>
              <Button
                type="button"
                size="lg"
                disabled={
                  uploading ||
                  !channelId ||
                  batch?.status === 'applied' ||
                  Boolean(batch?.androidBackup)
                }
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? <LoaderCircle className="animate-spin" /> : <Upload />}
                {uploading
                  ? 'Processando backup'
                  : importMode === 'android-backup'
                    ? 'Selecionar msgstore.db.crypt15'
                    : 'Selecionar arquivos ZIP'}
              </Button>
            </div>
            {uploadTotal > 0 ? (
              <div className="max-w-xl" aria-live="polite">
                <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                  <span>
                    {importMode === 'android-backup' && uploading
                      ? databaseUploadBytes < databaseUploadBytesTotal
                        ? 'Dados enviados'
                        : 'Validando o backup'
                      : 'Arquivos processados'}
                  </span>
                  <span>
                    {importMode === 'android-backup' && databaseUploadBytesTotal > 0
                      ? `${formatBytes(databaseUploadBytes)} de ${formatBytes(databaseUploadBytesTotal)}`
                      : `${uploadCurrent} de ${uploadTotal}`}
                  </span>
                </div>
                <Progress
                  value={
                    importMode === 'android-backup' && databaseUploadBytesTotal > 0
                      ? (databaseUploadBytes / databaseUploadBytesTotal) * 100
                      : uploadTotal
                        ? (uploadCurrent / uploadTotal) * 100
                        : 0
                  }
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {plural(uploadSuccess, 'arquivo válido', 'arquivos válidos')} ·{' '}
                  {plural(uploadErrors.length, 'arquivo com erro', 'arquivos com erro')}
                </p>
              </div>
            ) : null}
            {uploadErrors.length > 0 ? (
              <div className="max-w-3xl rounded-lg bg-destructive/10 p-3 text-sm text-destructive-emphasis">
                <p className="font-semibold">Arquivos que precisam de correção</p>
                <ul className="mt-2 grid gap-1">
                  {uploadErrors.map((failure) => (
                    <li key={`${failure.fileName}:${failure.message}`}>
                      <strong>{failure.fileName}:</strong> {failure.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <aside className="grid content-start gap-4 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <div>
              <h2 className="text-lg font-semibold">
                {pendingAndroidMediaBatch ? 'Adicionar mídias ao backup' : 'Importar mídias'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {pendingAndroidMediaBatch
                  ? 'Selecione o ZIP da pasta Media antes de aplicar. Mensagens e mídias serão processadas no mesmo fluxo.'
                  : 'Selecione um backup Android já concluído e vincule mídias adicionais sem importar novamente as mensagens.'}
              </p>
            </div>

            {!pendingAndroidMediaBatch && loadingAppliedBackups ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Carregando backups concluídos
              </div>
            ) : !pendingAndroidMediaBatch && appliedBackupsError ? (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive-emphasis">
                {appliedBackupsError}
              </p>
            ) : !pendingAndroidMediaBatch && appliedAndroidBackups.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">
                Nenhum backup Android concluído está disponível. Depois de aplicar um backup, ele
                aparecerá aqui e continuará disponível também na etapa 4.
              </p>
            ) : (
              <>
                {!pendingAndroidMediaBatch ? (
                  <label className="grid gap-1.5 text-sm font-medium">
                    Backup já importado
                    <Select
                      value={selectedMediaBatchId}
                      onValueChange={(value) => setSelectedMediaBatchId(value ?? '')}
                    >
                      <SelectTrigger className="h-auto min-h-9 w-full text-left">
                        <SelectValue placeholder="Selecione o backup">
                          {selectedMediaBatch?.androidBackup
                            ? `${selectedMediaBatch.androidBackup.databaseFileName} · ${new Date(
                                selectedMediaBatch.appliedAt ?? selectedMediaBatch.updatedAt,
                              ).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}`
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {appliedAndroidBackups.map((item) => {
                          const android = item.androidBackup;
                          if (!android) return null;
                          const pending =
                            android.mediaImport?.pending ?? android.summary.mediaReferences;
                          return (
                            <SelectItem key={item.id} value={item.id}>
                              {android.databaseFileName} ·{' '}
                              {new Date(item.appliedAt ?? item.updatedAt).toLocaleDateString(
                                'pt-BR',
                              )}{' '}
                              · {plural(pending, 'mídia pendente', 'mídias pendentes')}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </label>
                ) : null}

                {selectedMediaBatch?.androidBackup ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Mídias armazenadas</p>
                        <p className="mt-1 text-xl font-bold">
                          {selectedMediaBatch.androidBackup.mediaImport?.stored ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Mídias pendentes</p>
                        <p className="mt-1 text-xl font-bold">
                          {selectedMediaBatch.androidBackup.mediaImport?.pending ??
                            selectedMediaBatch.androidBackup.summary.mediaReferences}
                        </p>
                      </div>
                    </div>

                    {selectedMediaBatch.androidBackup.summary.mediaReferences > 0 ? (
                      <div>
                        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                          <span>Arquivos disponíveis</span>
                          <span>
                            {selectedMediaBatch.androidBackup.mediaImport?.stored ?? 0} de{' '}
                            {selectedMediaBatch.androidBackup.summary.mediaReferences}
                          </span>
                        </div>
                        <Progress
                          value={
                            (100 * (selectedMediaBatch.androidBackup.mediaImport?.stored ?? 0)) /
                            selectedMediaBatch.androidBackup.summary.mediaReferences
                          }
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Este backup não contém mídias citadas nas mensagens.
                      </p>
                    )}

                    <input
                      ref={historicalMediaInputRef}
                      type="file"
                      accept=".zip,application/zip"
                      className="sr-only"
                      onChange={(event) =>
                        void uploadAndroidMedia(
                          selectedMediaBatch,
                          event.target.files,
                          historicalMediaInputRef,
                        )
                      }
                    />
                    <Button
                      type="button"
                      disabled={mediaUploading || selectedMediaProcessing || selectedMediaApplying}
                      onClick={() => historicalMediaInputRef.current?.click()}
                    >
                      {(mediaUploading && mediaUploadTargetId === selectedMediaBatch.id) ||
                      selectedMediaProcessing ||
                      selectedMediaApplying ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Paperclip />
                      )}
                      {mediaUploading && mediaUploadTargetId === selectedMediaBatch.id
                        ? 'Enviando ZIP de mídias'
                        : selectedMediaApplying
                          ? 'Aplicando mensagens e mídias'
                          : selectedMediaProcessing
                            ? 'Vinculando mídias em segundo plano'
                            : selectedMediaImport?.status === 'ready'
                              ? 'Substituir ZIP da pasta Media'
                              : 'Selecionar ZIP da pasta Media'}
                    </Button>

                    {selectedMediaImport?.status === 'ready' ? (
                      <p className="rounded-lg bg-success/10 p-3 text-sm font-medium text-success-emphasis">
                        ZIP validado e pronto. Ao aplicar, as mensagens e as mídias serão
                        processadas no mesmo fluxo.
                      </p>
                    ) : null}

                    {mediaUploadTargetId === selectedMediaBatch.id && mediaUploadTotal > 0 ? (
                      <div aria-live="polite">
                        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                          <span>{mediaUploading ? 'Dados enviados' : 'Envio concluído'}</span>
                          <span>
                            {mediaUploading && mediaUploadBytesTotal > 0
                              ? `${formatBytes(mediaUploadBytes)} de ${formatBytes(mediaUploadBytesTotal)}`
                              : `${mediaUploadCurrent} de ${mediaUploadTotal}`}
                          </span>
                        </div>
                        <Progress
                          value={
                            mediaUploading && mediaUploadBytesTotal > 0
                              ? (mediaUploadBytes / mediaUploadBytesTotal) * 100
                              : mediaUploadTotal
                                ? (mediaUploadCurrent / mediaUploadTotal) * 100
                                : 0
                          }
                        />
                      </div>
                    ) : null}

                    {selectedMediaProcessing ? (
                      <div className="rounded-lg border p-3" aria-live="polite">
                        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                          <span>
                            {selectedMediaImport?.phase === 'storing'
                              ? 'Vinculando arquivos encontrados'
                              : 'Conferindo conteúdo do ZIP'}
                          </span>
                          <span>
                            {selectedMediaImport?.processingFilesTotal
                              ? `${selectedMediaImport.processingFilesProcessed ?? selectedMediaImport.processingFilesScanned ?? 0} de ${selectedMediaImport.processingFilesTotal}`
                              : 'Preparando'}
                          </span>
                        </div>
                        <Progress
                          value={
                            selectedMediaImport?.processingFilesTotal
                              ? (100 *
                                  (selectedMediaImport.phase === 'storing'
                                    ? (selectedMediaImport.processingFilesProcessed ?? 0)
                                    : (selectedMediaImport.processingFilesScanned ?? 0))) /
                                selectedMediaImport.processingFilesTotal
                              : 0
                          }
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          Você pode sair desta página. O processamento continuará na API.
                        </p>
                      </div>
                    ) : null}

                    {selectedMediaImport?.status === 'failed' &&
                    selectedMediaImport.errorMessage ? (
                      <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive-emphasis">
                        {selectedMediaImport.errorMessage} Selecione o mesmo arquivo para tentar
                        novamente.
                      </p>
                    ) : null}

                    {mediaUploadTargetId === selectedMediaBatch.id &&
                    mediaUploadErrors.length > 0 ? (
                      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive-emphasis">
                        <p className="font-semibold">Arquivos que não foram processados</p>
                        <ul className="mt-2 grid gap-1">
                          {mediaUploadErrors.map((failure) => (
                            <li key={`${failure.fileName}:${failure.message}`}>
                              <strong>{failure.fileName}:</strong> {failure.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </aside>
        </CardContent>
      </Card>

      {batch ? (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo">
            {[
              ['Backups', batch.totals.archives],
              ['Revisados', batch.totals.ready],
              ['A revisar', batch.totals.needsReview],
              ['Mensagens', batch.totals.messages],
              ['Anexos citados', batch.totals.attachments],
            ].map(([label, value]) => (
              <Card key={label} size="sm">
                <CardContent>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {batch.mode === 'zip-exports' ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>2. Revisar cada conversa</CardTitle>
                <CardDescription>
                  Confirme o número, quem representa a empresa e o estado em que a conversa deve
                  entrar no painel. O sistema não adivinha esses dados.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <label className="relative">
                    <span className="sr-only">Pesquisar conversas importadas</span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Pesquisar por arquivo, nome ou telefone"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  <Select
                    value={reviewFilter}
                    onValueChange={(value) => {
                      setReviewFilter(value as WhatsAppHistoryReviewFilter);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue>
                        {WHATSAPP_HISTORY_REVIEW_FILTER_LABELS[reviewFilter]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {Object.entries(WHATSAPP_HISTORY_REVIEW_FILTER_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4">
                  {visibleArchives.map((archive) => (
                    <ArchiveReviewCard
                      key={archive.archiveId}
                      batchId={batch.id}
                      archive={archive}
                      onSaved={setBatch}
                    />
                  ))}
                  {visibleArchives.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhuma conversa corresponde aos filtros.
                    </p>
                  ) : null}
                </div>
                {pageCount > 1 ? (
                  <nav
                    className="flex flex-wrap justify-center gap-2"
                    aria-label="Páginas da revisão"
                  >
                    {buildPaginationItems(currentPage, pageCount).map((value) =>
                      typeof value === 'number' ? (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={value === currentPage ? 'default' : 'outline'}
                          onClick={() => setPage(value)}
                          aria-current={value === currentPage ? 'page' : undefined}
                        >
                          {value}
                        </Button>
                      ) : (
                        <span
                          key={value}
                          className="inline-flex size-8 items-center justify-center text-muted-foreground"
                          aria-hidden="true"
                        >
                          …
                        </span>
                      ),
                    )}
                  </nav>
                ) : null}
              </CardContent>
            </Card>
          ) : batch.androidBackup ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>2. Conferir o backup completo</CardTitle>
                <CardDescription>
                  Conversas individuais são importadas por telefone. Grupos, listas e status não
                  entram porque o painel atual é orientado a atendimentos individuais.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <p>
                  <strong>{batch.androidBackup.summary.groupConversationsExcluded}</strong> grupos
                  excluídos
                </p>
                <p>
                  <strong>{batch.androidBackup.summary.groupMessagesExcluded}</strong> mensagens de
                  grupos
                </p>
                <p>
                  <strong>{batch.androidBackup.summary.otherConversationsExcluded}</strong> chats
                  técnicos excluídos
                </p>
                <p>
                  <strong>{batch.androidBackup.summary.mediaReferences}</strong> mídias pendentes
                </p>
                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-3">
                  {[
                    [
                      'Mensagens já existentes',
                      batch.androidBackup.comparison?.messagesExisting ?? 0,
                    ],
                    ['Mensagens novas', batch.androidBackup.comparison?.messagesNew ?? 0],
                    [
                      'Mensagens divergentes',
                      batch.androidBackup.comparison?.messagesDivergent ?? 0,
                    ],
                    ['Mídias já armazenadas', batch.androidBackup.comparison?.mediaStored ?? 0],
                    ['Mídias novas', batch.androidBackup.comparison?.mediaNew ?? 0],
                    [
                      'Mídias ainda ausentes',
                      batch.androidBackup.comparison?.mediaMissing ??
                        batch.androidBackup.summary.mediaReferences,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                {batch.androidBackup.comparison?.status === 'processing' ? (
                  <p className="rounded-lg bg-primary/10 p-3 text-primary-emphasis sm:col-span-2 xl:col-span-4">
                    Comparando este backup com o histórico já incorporado. Os totais serão
                    atualizados automaticamente.
                  </p>
                ) : null}
                {batch.androidBackup.comparison?.status === 'ready' &&
                batch.androidBackup.comparison.messagesDivergent > 0 ? (
                  <section className="grid gap-4 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:col-span-2 xl:col-span-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <MessageSquareWarning
                          aria-hidden="true"
                          className="mt-0.5 size-5 shrink-0 text-warning-emphasis"
                        />
                        <div>
                          <h3 className="font-semibold">Revisar mensagens divergentes</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Compare o conteúdo atual com o backup e escolha qual versão deve ser
                            mantida. Nenhuma mensagem será alterada antes de aplicar a importação.
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold text-warning-emphasis">
                        {plural(
                          batch.androidBackup.comparison.messagesDivergentPending ??
                            batch.androidBackup.comparison.messagesDivergent,
                          'decisão pendente',
                          'decisões pendentes',
                        )}
                      </span>
                    </div>
                    {loadingDivergences ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" /> Carregando diferenças
                      </p>
                    ) : divergencesError ? (
                      <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive-emphasis">
                        {divergencesError}
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {divergences.map((divergence) => (
                          <DivergenceReviewCard
                            key={divergence.externalMessageId}
                            divergence={divergence}
                            saving={savingDivergenceId === divergence.externalMessageId}
                            onResolve={(externalMessageId, resolution) =>
                              void resolveDivergence(externalMessageId, resolution)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ) : null}
                {batch.androidBackup.comparison?.status === 'ready' &&
                batch.androidBackup.comparison.messagesNew === 0 &&
                batch.androidBackup.comparison.messagesDivergent === 0 ? (
                  <p className="rounded-lg bg-success/10 p-3 text-success-emphasis sm:col-span-2 xl:col-span-4">
                    Todas as mensagens já estão incorporadas no sistema; não há necessidade de uma
                    nova importação. Se houver mídias pendentes, o ZIP selecionado ainda poderá
                    preenchê-las.
                  </p>
                ) : null}
                {batch.androidBackup.comparison?.status === 'failed' ? (
                  <p className="rounded-lg bg-destructive/10 p-3 text-destructive-emphasis sm:col-span-2 xl:col-span-4">
                    {batch.androidBackup.comparison.errorMessage ??
                      'Não foi possível comparar este backup com o histórico atual.'}
                  </p>
                ) : null}
                {batch.status === 'applying' ? (
                  <div className="sm:col-span-2 xl:col-span-4">
                    <div className="mb-2 flex justify-between text-muted-foreground">
                      <span>Importando em blocos</span>
                      <span>
                        {batch.androidBackup.messagesProcessed} de {batch.totals.messages}
                      </span>
                    </div>
                    <Progress
                      value={
                        batch.totals.messages
                          ? (batch.androidBackup.messagesProcessed / batch.totals.messages) * 100
                          : 0
                      }
                    />
                  </div>
                ) : null}
                {batch.status === 'failed' && batch.androidBackup.errorMessage ? (
                  <p className="rounded-lg bg-destructive/10 p-3 text-destructive-emphasis sm:col-span-2 xl:col-span-4">
                    {batch.androidBackup.errorMessage}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>3. Conferir e aplicar</CardTitle>
              <CardDescription>
                A planilha usa o mesmo contrato oficial do importador existente. Aplicar é
                idempotente: repetir o mesmo lote não duplica mensagens.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-end">
              <label className="grid gap-1.5 text-sm font-medium">
                Importar mensagens registradas até
                <Input
                  type="datetime-local"
                  value={cutoffAt}
                  onChange={(event) => setCutoffAt(event.target.value)}
                  disabled={batch.status === 'applied'}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {batch.mode === 'zip-exports' ? (
                  <Link
                    href={`/api/whatsapp-history-import/batches/${batch.id}/workbook`}
                    className={buttonVariants({ variant: 'outline' })}
                    aria-disabled={!readyToApply && batch.status !== 'applied'}
                    onClick={(event) => {
                      if (!readyToApply && batch.status !== 'applied') event.preventDefault();
                    }}
                  >
                    <Download /> Baixar planilha consolidada
                  </Link>
                ) : null}
                <Button
                  type="button"
                  onClick={() => void applyImport()}
                  disabled={!readyToApply || applying || batch.status === 'applying'}
                >
                  {applying ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
                  {applying ? 'Aplicando' : 'Aplicar importação'}
                </Button>
              </div>
              {batch.status === 'applied' ? (
                <p className="rounded-lg bg-success/10 p-3 text-sm font-medium text-success-emphasis lg:col-span-2">
                  Este lote já foi aplicado. As conversas estão disponíveis no painel.
                </p>
              ) : batch.status === 'applying' ? (
                <p className="text-sm text-muted-foreground lg:col-span-2">
                  A importação continua em segundo plano. Você pode sair desta tela e acompanhar o
                  progresso depois.
                </p>
              ) : batch.totals.needsReview > 0 ? (
                <p className="text-sm text-muted-foreground lg:col-span-2">
                  Revise{' '}
                  {plural(batch.totals.needsReview, 'conversa pendente', 'conversas pendentes')}{' '}
                  para liberar a aplicação.
                </p>
              ) : batch.androidBackup?.comparison?.status === 'processing' ? (
                <p className="text-sm text-muted-foreground lg:col-span-2">
                  Aguarde a comparação incremental antes de aplicar o backup.
                </p>
              ) : (batch.androidBackup?.comparison?.messagesDivergentPending ??
                  batch.androidBackup?.comparison?.messagesDivergent ??
                  0) > 0 ? (
                <p className="text-sm text-destructive-emphasis lg:col-span-2">
                  Use a seção de revisão acima para corrigir as mensagens divergentes.
                </p>
              ) : batch.androidBackup &&
                batch.androidBackup.summary.mediaReferences > 0 &&
                batch.androidBackup.mediaImport?.status !== 'ready' ? (
                <p className="text-sm text-muted-foreground lg:col-span-2">
                  Selecione e envie por completo o ZIP da pasta Media para liberar a aplicação do
                  backup.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {batch.mode === 'android-backup' &&
          batch.androidBackup &&
          batch.status === 'applied' &&
          batch.androidBackup.summary.mediaReferences > 0 ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>4. Vincular mídias das conversas</CardTitle>
                <CardDescription>
                  Envie um ou vários ZIPs da pasta Media. Arquivos já vinculados são ignorados e
                  você pode retomar esta etapa depois.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6">
                  <p>
                    Compacte a pasta <strong>WhatsApp/Media</strong> ou{' '}
                    <strong>WhatsApp Business/Media</strong>. Se ela for muito grande, divida o
                    conteúdo em vários ZIPs e selecione todos de uma vez.
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    O arquivo <strong>Backups.zip</strong> contém bancos auxiliares do Android e não
                    contém as fotos, áudios, vídeos e documentos das conversas.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Mídias citadas', batch.androidBackup.summary.mediaReferences],
                    ['Mídias armazenadas', batch.androidBackup.mediaImport?.stored ?? 0],
                    [
                      'Mídias pendentes',
                      batch.androidBackup.mediaImport?.pending ??
                        batch.androidBackup.summary.mediaReferences,
                    ],
                    ['ZIPs processados', batch.androidBackup.mediaImport?.archivesProcessed ?? 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-bold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="max-w-2xl">
                  <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                    <span>Arquivos disponíveis nas conversas</span>
                    <span>
                      {batch.androidBackup.mediaImport?.stored ?? 0} de{' '}
                      {batch.androidBackup.summary.mediaReferences}
                    </span>
                  </div>
                  <Progress
                    value={
                      (100 * (batch.androidBackup.mediaImport?.stored ?? 0)) /
                      batch.androidBackup.summary.mediaReferences
                    }
                  />
                </div>

                <input
                  ref={mediaInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="sr-only"
                  onChange={(event) =>
                    void uploadAndroidMedia(batch, event.target.files, mediaInputRef)
                  }
                />
                <div>
                  <Button
                    type="button"
                    size="lg"
                    disabled={mediaUploading || currentBatchMediaProcessing}
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    {mediaUploading && mediaUploadTargetId === batch.id ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Paperclip />
                    )}
                    {mediaUploading && mediaUploadTargetId === batch.id
                      ? 'Enviando ZIP de mídias'
                      : currentBatchMediaProcessing
                        ? 'Vinculando mídias em segundo plano'
                        : 'Selecionar ZIP da pasta Media'}
                  </Button>
                </div>

                {mediaUploadTargetId === batch.id && mediaUploadTotal > 0 ? (
                  <div className="max-w-2xl" aria-live="polite">
                    <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                      <span>{mediaUploading ? 'Dados enviados' : 'Envio concluído'}</span>
                      <span>
                        {mediaUploading && mediaUploadBytesTotal > 0
                          ? `${formatBytes(mediaUploadBytes)} de ${formatBytes(mediaUploadBytesTotal)}`
                          : `${mediaUploadCurrent} de ${mediaUploadTotal}`}
                      </span>
                    </div>
                    <Progress
                      value={
                        mediaUploading && mediaUploadBytesTotal > 0
                          ? (mediaUploadBytes / mediaUploadBytesTotal) * 100
                          : mediaUploadTotal
                            ? (mediaUploadCurrent / mediaUploadTotal) * 100
                            : 0
                      }
                    />
                  </div>
                ) : null}

                {currentBatchMediaProcessing ? (
                  <div className="max-w-2xl rounded-lg border p-3" aria-live="polite">
                    <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                      <span>
                        {currentBatchMediaImport?.phase === 'storing'
                          ? 'Vinculando arquivos encontrados'
                          : 'Conferindo conteúdo do ZIP'}
                      </span>
                      <span>
                        {currentBatchMediaImport?.processingFilesTotal
                          ? `${currentBatchMediaImport.processingFilesProcessed ?? currentBatchMediaImport.processingFilesScanned ?? 0} de ${currentBatchMediaImport.processingFilesTotal}`
                          : 'Preparando'}
                      </span>
                    </div>
                    <Progress
                      value={
                        currentBatchMediaImport?.processingFilesTotal
                          ? (100 *
                              (currentBatchMediaImport.phase === 'storing'
                                ? (currentBatchMediaImport.processingFilesProcessed ?? 0)
                                : (currentBatchMediaImport.processingFilesScanned ?? 0))) /
                            currentBatchMediaImport.processingFilesTotal
                          : 0
                      }
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Você pode sair desta página. O processamento continuará na API.
                    </p>
                  </div>
                ) : null}

                {currentBatchMediaImport?.status === 'failed' &&
                currentBatchMediaImport.errorMessage ? (
                  <p className="max-w-2xl rounded-lg bg-destructive/10 p-3 text-sm text-destructive-emphasis">
                    {currentBatchMediaImport.errorMessage} Selecione o mesmo arquivo para retomar ou
                    tentar novamente.
                  </p>
                ) : null}

                {mediaUploadTargetId === batch.id && mediaUploadErrors.length > 0 ? (
                  <div className="max-w-3xl rounded-lg bg-destructive/10 p-3 text-sm text-destructive-emphasis">
                    <p className="font-semibold">Arquivos que não foram processados</p>
                    <ul className="mt-2 grid gap-1">
                      {mediaUploadErrors.map((failure) => (
                        <li key={`${failure.fileName}:${failure.message}`}>
                          <strong>{failure.fileName}:</strong> {failure.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
