'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Bot, CheckCircle2, FileSearch, LoaderCircle, PencilLine, ShieldAlert } from 'lucide-react';

import {
  analyzeMediaInterpretationAction,
  correctMediaInterpretationAction,
  getMediaInterpretationAction,
} from '../actions';
import type {
  DeferredWhatsAppMediaInterpretation,
  WhatsAppMediaInterpretation,
  WhatsAppMessage,
} from '../domain';
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
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

interface MessageMediaInterpretationProps {
  readonly conversationId: string;
  readonly message: WhatsAppMessage;
  readonly canManage: boolean;
}

const STATUS_LABELS: Record<WhatsAppMediaInterpretation['status'], string> = {
  'not-requested': 'Não analisada',
  pending: 'Em análise',
  succeeded: 'Analisada',
  failed: 'Falha na análise',
  unsupported: 'Formato não suportado',
};
const DEFERRED_LABELS: Record<DeferredWhatsAppMediaInterpretation['reason'], string> = {
  'human-control-disabled': 'A política do tenant desativa análise durante controle humano.',
  'media-agent-unavailable': 'O agente especialista em mídia não está configurado.',
  'binary-not-stored': 'A cópia binária durável ainda não está disponível.',
};

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/(?:credential|api.?key|secret|token)/iu.test(key))
        .map(([key, entry]) => [key, sanitize(entry)]),
    );
  }
  return value;
}

function evidence(value: Readonly<Record<string, unknown>> | null): string {
  return value ? JSON.stringify(sanitize(value), null, 2) : 'Sem proveniência adicional.';
}

export function MessageMediaInterpretation({
  conversationId,
  message,
  canManage,
}: MessageMediaInterpretationProps) {
  const [interpretation, setInterpretation] = useState<
    WhatsAppMediaInterpretation | DeferredWhatsAppMediaInterpretation | null
  >(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correction, setCorrection] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isPending, startTransition] = useTransition();

  function load() {
    setError('');
    startTransition(async () => {
      const result = await getMediaInterpretationAction({
        conversationId,
        messageId: message.id,
      });
      setLoaded(true);
      if (result.success) setInterpretation(result.interpretation);
      else setError(`${result.message} (${result.code})`);
    });
  }

  function analyze() {
    setError('');
    startTransition(async () => {
      const result = await analyzeMediaInterpretationAction({
        conversationId,
        messageId: message.id,
      });
      if (result.success) setInterpretation(result.interpretation);
      else setError(`${result.message} (${result.code})`);
    });
  }

  function submitCorrection(event: FormEvent) {
    event.preventDefault();
    setError('');
    startTransition(async () => {
      const result = await correctMediaInterpretationAction({
        conversationId,
        messageId: message.id,
        correction,
        feedback: feedback || undefined,
      });
      if (result.success && result.interpretation.status !== 'deferred') {
        setInterpretation(result.interpretation);
        setCorrectionOpen(false);
        setCorrection('');
        setFeedback('');
      } else if (!result.success) {
        setError(`${result.message} (${result.code})`);
      }
    });
  }

  if (!loaded && !isPending) {
    return (
      <Button type="button" size="xs" variant="ghost" onClick={load}>
        <FileSearch aria-hidden="true" /> Ver interpretação
      </Button>
    );
  }

  if (isPending && !interpretation) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
        <LoaderCircle className="size-3 animate-spin" /> Consultando interpretação…
      </p>
    );
  }

  if (error && !interpretation) {
    return (
      <Alert variant="destructive" className="p-2 text-xs">
        <ShieldAlert className="size-3.5" />
        <AlertTitle>Interpretação indisponível</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button type="button" size="xs" variant="outline" className="mt-2" onClick={load}>
          Tentar novamente
        </Button>
      </Alert>
    );
  }

  if (interpretation?.status === 'deferred') {
    return (
      <div className="rounded-lg border bg-muted/40 p-2 text-xs">
        <p className="font-medium">Análise adiada</p>
        <p className="text-muted-foreground">{DEFERRED_LABELS[interpretation.reason]}</p>
      </div>
    );
  }

  if (!interpretation) return null;
  const contextLabel =
    interpretation.effectiveContext.source === 'human'
      ? 'Contexto corrigido por pessoa'
      : interpretation.effectiveContext.source === 'machine'
        ? 'Contexto gerado pelo agente'
        : 'Sem contexto efetivo';

  return (
    <section
      className="grid gap-2 rounded-lg border bg-background/70 p-2 text-xs"
      aria-label="Interpretação da mídia"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-semibold">
          <Bot className="size-3.5" aria-hidden="true" /> Interpretação
        </span>
        <div className="flex items-center gap-1">
          <Badge
            variant={
              interpretation.status === 'succeeded'
                ? 'default'
                : interpretation.status === 'failed'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {STATUS_LABELS[interpretation.status]}
          </Badge>
          {interpretation.confidence !== null ? (
            <Badge variant="outline">
              {Math.round(interpretation.confidence * 100)}% confiança
            </Badge>
          ) : null}
        </div>
      </header>
      {interpretation.summary ? (
        <p>
          <strong>Resumo:</strong> {interpretation.summary}
        </p>
      ) : null}
      {interpretation.transcription ? (
        <div>
          <strong>Transcrição</strong>
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2">
            {interpretation.transcription}
          </p>
        </div>
      ) : null}
      {interpretation.extractedText ? (
        <div>
          <strong>Texto extraído</strong>
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2">
            {interpretation.extractedText}
          </p>
        </div>
      ) : null}
      {interpretation.structuredData ? (
        <details>
          <summary className="cursor-pointer font-medium">Dados estruturados</summary>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">
            {JSON.stringify(sanitize(interpretation.structuredData), null, 2)}
          </pre>
        </details>
      ) : null}
      <div className="rounded bg-muted/40 p-2">
        <p className="font-medium">{contextLabel}</p>
        {interpretation.effectiveContext.value ? (
          <p className="mt-1 whitespace-pre-wrap">{interpretation.effectiveContext.value}</p>
        ) : null}
      </div>
      {interpretation.errorCode ? (
        <p className="text-destructive">
          <strong>Erro:</strong> {interpretation.errorCode}
        </p>
      ) : null}
      {interpretation.correction ? (
        <div className="rounded border border-primary/30 bg-primary/5 p-2">
          <p className="flex items-center gap-1 font-medium">
            <CheckCircle2 className="size-3.5" /> Correção humana efetiva
          </p>
          <p className="mt-1 whitespace-pre-wrap">{interpretation.correction.correction}</p>
          {interpretation.correction.feedback ? (
            <p className="mt-1 text-muted-foreground">
              Feedback: {interpretation.correction.feedback}
            </p>
          ) : null}
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-muted-foreground">Proveniência técnica</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">
          {evidence(interpretation.provenance)}
        </pre>
      </details>
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-1">
        {canManage && interpretation.status === 'not-requested' ? (
          <Button type="button" size="xs" onClick={analyze} disabled={isPending}>
            <FileSearch /> Analisar agora
          </Button>
        ) : null}
        {canManage && interpretation.status === 'succeeded' && !interpretation.correction ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setCorrectionOpen(true)}
            disabled={isPending}
          >
            <PencilLine /> Corrigir contexto
          </Button>
        ) : null}
      </div>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <form onSubmit={submitCorrection} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Corrigir interpretação</DialogTitle>
              <DialogDescription>
                A correção é imutável, auditável e passa a prevalecer no contexto futuro. Ela não
                dispara nova análise.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor={`correction-${message.id}`}>Contexto correto</Label>
              <Textarea
                id={`correction-${message.id}`}
                required
                value={correction}
                onChange={(event) => setCorrection(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`feedback-${message.id}`}>Feedback opcional</Label>
              <Textarea
                id={`feedback-${message.id}`}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCorrectionOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                Registrar correção
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
