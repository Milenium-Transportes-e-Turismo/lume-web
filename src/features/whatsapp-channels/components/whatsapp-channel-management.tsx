'use client';

import Image from 'next/image';
import { useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Cable,
  CableIcon,
  CircleOff,
  LoaderCircle,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Router,
  Search,
  ShieldOff,
  Smartphone,
} from 'lucide-react';

import {
  createWhatsAppChannelAction,
  executeWhatsAppChannelAction,
  loadWhatsAppChannelsAction,
  updateWhatsAppChannelAction,
} from '../actions';
import {
  WHATSAPP_CHANNEL_CONNECTION_STATUSES,
  WHATSAPP_CHANNEL_ORGANIZATIONAL_STATUSES,
  whatsappChannelQrDataUrl,
  type ManagedWhatsAppChannel,
  type WhatsAppChannelAction,
  type WhatsAppChannelConnectionStatus,
  type WhatsAppChannelOrganizationalStatus,
  type WhatsAppChannelQrCode,
  type WhatsAppChannelRoutingMode,
} from '../domain';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/ui/select';

const ORGANIZATIONAL_LABELS: Record<WhatsAppChannelOrganizationalStatus, string> = {
  pending: 'Configuração pendente',
  active: 'Ativo',
  cancelled: 'Configuração cancelada',
  disabled: 'Desativado',
};
const CONNECTION_LABELS: Record<WhatsAppChannelConnectionStatus, string> = {
  unknown: 'Conexão desconhecida',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  error: 'Falha de conexão',
};
const ROUTING_LABELS: Record<WhatsAppChannelRoutingMode, string> = {
  'department-owned': 'Canal de departamento',
  'general-triage': 'Triagem geral',
};

interface ChannelDraft {
  displayName: string;
  phoneNumber: string;
  routingMode: WhatsAppChannelRoutingMode;
  departmentId: string;
  allowedDepartmentIds: string;
}

const EMPTY_DRAFT: ChannelDraft = {
  displayName: '',
  phoneNumber: '',
  routingMode: 'general-triage',
  departmentId: '',
  allowedDepartmentIds: '',
};

function identifiers(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,;]+/u)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function draftFromChannel(channel: ManagedWhatsAppChannel): ChannelDraft {
  return {
    displayName: channel.displayName,
    phoneNumber: channel.phoneNumber,
    routingMode: channel.routingMode,
    departmentId: channel.departmentId ?? '',
    allowedDepartmentIds: channel.allowedAutomaticTargetDepartmentIds.join(', '),
  };
}

function shortId(value: string | null): string {
  if (!value) return 'Não definido';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function channelMatches(channel: ManagedWhatsAppChannel, search: string): boolean {
  const normalized = search.trim().toLocaleLowerCase('pt-BR');
  if (!normalized) return true;
  return [channel.displayName, channel.phoneNumber, channel.evolutionInstanceName]
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .includes(normalized);
}

function ConfigurationFields({
  value,
  onChange,
  includePhone,
  disabled,
  departments,
}: {
  readonly value: ChannelDraft;
  readonly onChange: (value: ChannelDraft) => void;
  readonly departments: readonly { id: string; name: string }[];
  readonly includePhone: boolean;
  readonly disabled: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${includePhone ? 'create' : 'edit'}-channel-name`}>Nome do canal</Label>
        <Input
          id={`${includePhone ? 'create' : 'edit'}-channel-name`}
          value={value.displayName}
          onChange={(event) => onChange({ ...value, displayName: event.target.value })}
          maxLength={80}
          required
          disabled={disabled}
        />
      </div>
      {includePhone ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="create-channel-phone">Número do WhatsApp</Label>
          <Input
            id="create-channel-phone"
            inputMode="tel"
            value={value.phoneNumber}
            onChange={(event) => onChange({ ...value, phoneNumber: event.target.value })}
            placeholder="(34) 99999-9999"
            maxLength={30}
            required
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            O número é globalmente único e não poderá ser trocado após o provisionamento.
          </p>
        </div>
      ) : null}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${includePhone ? 'create' : 'edit'}-routing-mode`}>
          Roteamento inicial
        </Label>
        <Select
          value={value.routingMode}
          onValueChange={(routingMode) =>
            onChange({
              ...value,
              routingMode:
                routingMode === 'department-owned' ? 'department-owned' : 'general-triage',
            })
          }
          disabled={disabled}
        >
          <SelectTrigger id={`${includePhone ? 'create' : 'edit'}-routing-mode`} className="w-full">
            <span>{ROUTING_LABELS[value.routingMode]}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general-triage">Triagem geral</SelectItem>
            <SelectItem value="department-owned">Canal de departamento</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${includePhone ? 'create' : 'edit'}-department-id`}>
          Departamento proprietário {value.routingMode === 'general-triage' ? '(opcional)' : ''}
        </Label>
        <Select
          value={value.departmentId || '__none__'}
          disabled={disabled || departments.length === 0}
          onValueChange={(id) =>
            onChange({ ...value, departmentId: id === '__none__' ? '' : (id ?? '') })
          }
        >
          <SelectTrigger
            id={includePhone ? 'create-department-id' : 'edit-department-id'}
            className="w-full"
          >
            <span>
              {departments.find((department) => department.id === value.departmentId)?.name ??
                'Selecione um departamento'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {value.routingMode === 'general-triage' ? (
              <SelectItem value="__none__">Sem departamento proprietário</SelectItem>
            ) : null}
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-2 sm:col-span-2" disabled={disabled}>
        <legend className="text-sm font-medium">Destinos automáticos permitidos</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {departments.map((department) => (
            <Label key={department.id} className="flex items-center gap-2 rounded-lg border p-3">
              <Checkbox
                checked={identifiers(value.allowedDepartmentIds).includes(department.id)}
                onCheckedChange={(checked) => {
                  const selected = new Set(identifiers(value.allowedDepartmentIds));
                  if (checked) selected.add(department.id);
                  else selected.delete(department.id);
                  onChange({ ...value, allowedDepartmentIds: [...selected].join(', ') });
                }}
              />
              {department.name}
            </Label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        {departments.length === 0 ? (
          <p role="alert" className="text-sm text-destructive">
            Departamentos indisponíveis. Recarregue a página.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export interface WhatsAppChannelManagementProps {
  readonly initialChannels: readonly ManagedWhatsAppChannel[];
  readonly initialError?: string;
  readonly departments?: readonly { id: string; name: string }[];
  readonly permissions: {
    readonly canView: boolean;
    readonly canCreate: boolean;
    readonly canManage: boolean;
    readonly canConnect: boolean;
    readonly canDisconnect: boolean;
    readonly isAdministrator: boolean;
  };
}

export function WhatsAppChannelManagement({
  initialChannels,
  initialError = '',
  departments = [],
  permissions,
}: WhatsAppChannelManagementProps) {
  const [channels, setChannels] = useState(initialChannels);
  const [selectedId, setSelectedId] = useState(initialChannels[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [organizationalFilter, setOrganizationalFilter] = useState<
    WhatsAppChannelOrganizationalStatus | 'all'
  >('all');
  const [connectionFilter, setConnectionFilter] = useState<WhatsAppChannelConnectionStatus | 'all'>(
    'all',
  );
  const [feedback, setFeedback] = useState(initialError);
  const [feedbackCode, setFeedbackCode] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'neutral' | 'error'>(
    initialError ? 'error' : 'neutral',
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ChannelDraft>(EMPTY_DRAFT);
  const [editDraft, setEditDraft] = useState<ChannelDraft>(EMPTY_DRAFT);
  const [qrCode, setQrCode] = useState<WhatsAppChannelQrCode | null>(null);
  const [confirmation, setConfirmation] = useState<WhatsAppChannelAction | null>(null);
  const [isPending, startTransition] = useTransition();
  const createCommandId = useRef<string | null>(null);

  const filteredChannels = useMemo(
    () =>
      channels.filter(
        (channel) =>
          channelMatches(channel, search) &&
          (organizationalFilter === 'all' ||
            channel.organizationalStatus === organizationalFilter) &&
          (connectionFilter === 'all' || channel.connectionStatus === connectionFilter),
      ),
    [channels, connectionFilter, organizationalFilter, search],
  );
  const selected = channels.find((channel) => channel.id === selectedId) ?? channels[0] ?? null;

  function replaceChannel(channel: ManagedWhatsAppChannel) {
    setChannels((current) => {
      const exists = current.some((item) => item.id === channel.id);
      return exists
        ? current.map((item) => (item.id === channel.id ? channel : item))
        : [channel, ...current];
    });
    setSelectedId(channel.id);
  }

  function showFailure(message: string, publicCode: string) {
    setFeedback(message);
    setFeedbackCode(publicCode);
    setFeedbackTone('error');
  }

  function showSuccess(message: string) {
    setFeedback(message);
    setFeedbackCode('');
    setFeedbackTone('neutral');
  }

  function refresh() {
    startTransition(async () => {
      const result = await loadWhatsAppChannelsAction();
      if (!result.success) {
        showFailure(result.message, result.publicCode);
        return;
      }
      setChannels(result.channels);
      if (selectedId && !result.channels.some((channel) => channel.id === selectedId)) {
        setSelectedId(result.channels[0]?.id ?? null);
      }
      showSuccess('Canais atualizados.');
    });
  }

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createCommandId.current ??= globalThis.crypto.randomUUID();
    startTransition(async () => {
      const result = await createWhatsAppChannelAction({
        commandId: createCommandId.current,
        displayName: createDraft.displayName,
        phoneNumber: createDraft.phoneNumber,
        departmentId: createDraft.departmentId.trim() || null,
        routingMode: createDraft.routingMode,
        allowedAutomaticTargetDepartmentIds: identifiers(createDraft.allowedDepartmentIds),
      });
      if (!result.success) {
        if (result.publicCode === 'VALIDATION_ERROR') createCommandId.current = null;
        showFailure(result.message, result.publicCode);
        return;
      }
      replaceChannel(result.operation.channel);
      setQrCode(result.operation.qrCode);
      showSuccess(result.operation.providerIssue?.message ?? result.message);
      setCreateDraft(EMPTY_DRAFT);
      createCommandId.current = null;
      setCreateOpen(false);
    });
  }

  function openEdit() {
    if (!selected) return;
    setEditDraft(draftFromChannel(selected));
    setEditOpen(true);
  }

  function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    startTransition(async () => {
      const result = await updateWhatsAppChannelAction({
        channelId: selected.id,
        commandId: globalThis.crypto.randomUUID(),
        expectedVersion: selected.version,
        displayName: editDraft.displayName,
        departmentId: editDraft.departmentId.trim() || null,
        routingMode: editDraft.routingMode,
        allowedAutomaticTargetDepartmentIds: identifiers(editDraft.allowedDepartmentIds),
      });
      if (!result.success) {
        if (result.channel) replaceChannel(result.channel);
        showFailure(result.message, result.publicCode);
        return;
      }
      replaceChannel(result.operation.channel);
      showSuccess(result.message);
      setEditOpen(false);
    });
  }

  function runAction(action: WhatsAppChannelAction) {
    if (!selected) return;
    setConfirmation(null);
    startTransition(async () => {
      const result = await executeWhatsAppChannelAction({
        channelId: selected.id,
        action,
        commandId: globalThis.crypto.randomUUID(),
        expectedVersion: selected.version,
      });
      if (!result.success) {
        if (result.channel) replaceChannel(result.channel);
        showFailure(result.message, result.publicCode);
        return;
      }
      replaceChannel(result.operation.channel);
      setQrCode(result.operation.qrCode);
      showSuccess(result.operation.providerIssue?.message ?? result.message);
    });
  }

  const connected = channels.filter((channel) => channel.connectionStatus === 'connected').length;
  const attention = channels.filter(
    (channel) => channel.connectionStatus === 'error' || channel.connectionStatus === 'unknown',
  ).length;

  return (
    <section aria-labelledby="whatsapp-channels-title" className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary-emphasis">
            Administração
          </p>
          <h1 id="whatsapp-channels-title" className="text-2xl font-bold tracking-tight">
            Canais WhatsApp
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Acompanhe organização e conexão separadamente. O nome técnico da instância permanece
            imutável.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={refresh} disabled={isPending}>
            <RefreshCw aria-hidden="true" className={isPending ? 'animate-spin' : ''} /> Atualizar
          </Button>
          {permissions.canCreate ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" /> Provisionar canal
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2" aria-label="Resumo dos canais">
        {[
          ['Canais', channels.length],
          ['Conectados', connected],
          ['Atenção', attention],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card px-3 py-2">
            <small className="text-[10px] font-bold uppercase text-muted-foreground">{label}</small>
            <strong className="mt-0.5 block text-lg">{value}</strong>
          </div>
        ))}
      </div>

      {feedback ? (
        <Alert variant={feedbackTone === 'error' ? 'destructive' : 'default'}>
          {feedbackTone === 'error' ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <Cable aria-hidden="true" />
          )}
          <AlertTitle>
            {feedbackTone === 'error' ? 'Operação não concluída' : 'Atualização'}
          </AlertTitle>
          <AlertDescription>
            {feedback}
            {feedbackCode ? ` Código do erro: ${feedbackCode}.` : ''}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-[36rem] overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
        <aside
          className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0"
          aria-label="Lista de canais"
        >
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Label htmlFor="channel-search" className="sr-only">
                Buscar canais
              </Label>
              <Input
                id="channel-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, número ou instância"
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={organizationalFilter}
                onValueChange={(value) =>
                  setOrganizationalFilter(
                    WHATSAPP_CHANNEL_ORGANIZATIONAL_STATUSES.includes(
                      value as WhatsAppChannelOrganizationalStatus,
                    )
                      ? (value as WhatsAppChannelOrganizationalStatus)
                      : 'all',
                  )
                }
              >
                <SelectTrigger aria-label="Filtrar estado organizacional" className="w-full">
                  <span>
                    {organizationalFilter === 'all'
                      ? 'Todos os estados'
                      : ORGANIZATIONAL_LABELS[organizationalFilter]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {WHATSAPP_CHANNEL_ORGANIZATIONAL_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ORGANIZATIONAL_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={connectionFilter}
                onValueChange={(value) =>
                  setConnectionFilter(
                    WHATSAPP_CHANNEL_CONNECTION_STATUSES.includes(
                      value as WhatsAppChannelConnectionStatus,
                    )
                      ? (value as WhatsAppChannelConnectionStatus)
                      : 'all',
                  )
                }
              >
                <SelectTrigger aria-label="Filtrar conexão" className="w-full">
                  <span>
                    {connectionFilter === 'all'
                      ? 'Todas as conexões'
                      : CONNECTION_LABELS[connectionFilter]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as conexões</SelectItem>
                  {WHATSAPP_CHANNEL_CONNECTION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CONNECTION_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-busy={isPending}>
            {isPending && channels.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-6 animate-spin" /> Carregando
                canais
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 text-center">
                <Smartphone aria-hidden="true" className="size-8 text-muted-foreground" />
                <strong>Nenhum canal encontrado</strong>
                <p className="text-sm text-muted-foreground">
                  Ajuste os filtros ou provisione um novo número.
                </p>
              </div>
            ) : (
              filteredChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedId(channel.id)}
                  aria-pressed={selected?.id === channel.id}
                  className="flex w-full items-start gap-3 border-b px-3 py-3 text-left transition hover:bg-muted/40 aria-pressed:bg-primary/5 aria-pressed:shadow-[inset_3px_0_0_var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-emphasis">
                    <Smartphone aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{channel.displayName}</strong>
                    <span className="block truncate text-xs text-muted-foreground">
                      {channel.phoneNumber}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge
                        variant={channel.organizationalStatus === 'active' ? 'default' : 'outline'}
                      >
                        {ORGANIZATIONAL_LABELS[channel.organizationalStatus]}
                      </Badge>
                      <Badge
                        variant={channel.connectionStatus === 'error' ? 'destructive' : 'secondary'}
                      >
                        {CONNECTION_LABELS[channel.connectionStatus]}
                      </Badge>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="min-w-0 overflow-y-auto">
          {selected ? (
            <div className="space-y-4 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{selected.displayName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.phoneNumber} · versão {selected.version}
                  </p>
                </div>
                {permissions.canManage &&
                !['cancelled', 'disabled'].includes(selected.organizationalStatus) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={openEdit}
                    disabled={isPending}
                  >
                    <Pencil aria-hidden="true" /> Editar configuração
                  </Button>
                ) : null}
              </div>
              <dl className="grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2">
                {[
                  ['Estado organizacional', ORGANIZATIONAL_LABELS[selected.organizationalStatus]],
                  ['Conexão', CONNECTION_LABELS[selected.connectionStatus]],
                  ['Roteamento', ROUTING_LABELS[selected.routingMode]],
                  [
                    'Departamento',
                    departments.find((department) => department.id === selected.departmentId)
                      ?.name ?? 'Não definido',
                  ],
                  ['Instância técnica', selected.evolutionInstanceName],
                  ['ID no provedor', shortId(selected.evolutionInstanceId)],
                ].map(([term, value]) => (
                  <div key={term} className="min-w-0 bg-card px-3 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {term}
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-semibold" title={value}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <section aria-labelledby="channel-actions-title" className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <h3 id="channel-actions-title" className="text-sm font-bold">
                    Conexão e ciclo de vida
                  </h3>
                  {isPending ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {permissions.canConnect &&
                  !['cancelled', 'disabled'].includes(selected.organizationalStatus) ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => runAction('request-qr')}
                        disabled={isPending}
                      >
                        <QrCode aria-hidden="true" /> Gerar QR
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => runAction('reconnect')}
                        disabled={isPending}
                      >
                        <CableIcon aria-hidden="true" /> Reconectar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => runAction('synchronize-connection')}
                        disabled={isPending}
                      >
                        <RefreshCw aria-hidden="true" /> Sincronizar
                      </Button>
                    </>
                  ) : null}
                  {permissions.canDisconnect && selected.connectionStatus !== 'disconnected' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmation('disconnect')}
                      disabled={isPending}
                    >
                      <CircleOff aria-hidden="true" /> Desconectar
                    </Button>
                  ) : null}
                  {permissions.canManage && selected.organizationalStatus === 'pending' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmation('cancel-setup')}
                      disabled={isPending}
                    >
                      <ShieldOff aria-hidden="true" /> Cancelar configuração
                    </Button>
                  ) : null}
                  {permissions.canManage &&
                  permissions.isAdministrator &&
                  selected.organizationalStatus === 'active' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmation('disable')}
                      disabled={isPending}
                    >
                      <ShieldOff aria-hidden="true" /> Desativar canal
                    </Button>
                  ) : null}
                </div>
              </section>
              <section aria-labelledby="automatic-targets-title" className="rounded-xl border p-3">
                <h3 id="automatic-targets-title" className="text-sm font-bold">
                  Destinos automáticos permitidos
                </h3>
                {selected.allowedAutomaticTargetDepartmentIds.length ? (
                  <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    {selected.allowedAutomaticTargetDepartmentIds.map((id) => (
                      <li
                        key={id}
                        className="truncate rounded-md bg-muted px-2 py-1.5 font-mono"
                        title={id}
                      >
                        {id}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum destino automático configurado.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-2 px-6 text-center">
              <Router aria-hidden="true" className="size-9 text-muted-foreground" />
              <strong>Selecione um canal</strong>
              <p className="text-sm text-muted-foreground">Os detalhes e ações aparecerão aqui.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={submitCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Provisionar canal WhatsApp</DialogTitle>
              <DialogDescription>
                O registro Lume será salvo antes da tentativa de conexão com a Evolution.
              </DialogDescription>
            </DialogHeader>
            <ConfigurationFields
              departments={departments}
              value={createDraft}
              onChange={(draft) => {
                setCreateDraft(draft);
                createCommandId.current = null;
              }}
              includePhone
              disabled={isPending}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Provisionando…' : 'Criar e gerar QR'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={submitEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Configurar canal</DialogTitle>
              <DialogDescription>
                Número e instância técnica permanecem imutáveis.
              </DialogDescription>
            </DialogHeader>
            <ConfigurationFields
              departments={departments}
              value={editDraft}
              onChange={setEditDraft}
              includePhone={false}
              disabled={isPending}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                Salvar configuração
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={qrCode !== null}
        onOpenChange={(open) => {
          if (!open) setQrCode(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar ao WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular e escaneie este código. O QR expira no provedor.
            </DialogDescription>
          </DialogHeader>
          {qrCode ? (
            <div className="mx-auto rounded-xl border bg-white p-3">
              <Image
                src={whatsappChannelQrDataUrl(qrCode)}
                alt="QR code para conectar o canal WhatsApp"
                width={280}
                height={280}
                unoptimized
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => setQrCode(null)}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação no canal</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === 'disconnect'
                ? 'A sessão será desconectada, mas o canal continuará ativo e poderá ser reconectado.'
                : confirmation === 'cancel-setup'
                  ? 'A configuração pendente será cancelada. O registro de auditoria será preservado.'
                  : 'O canal operacional será desativado sem exclusão do histórico.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="outline" />}>
              Voltar
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={() => confirmation && runAction(confirmation)}
              disabled={isPending}
            >
              Confirmar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
