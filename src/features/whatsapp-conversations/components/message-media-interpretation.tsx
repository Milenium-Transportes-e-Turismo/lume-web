'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { CheckCircle2, FileSearch, LoaderCircle, PencilLine, X } from 'lucide-react';

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

const DEFERRED_LABELS: Record<DeferredWhatsAppMediaInterpretation['reason'], string> = {
  'human-control-disabled': 'A análise automática está pausada durante o atendimento humano.',
  'media-agent-unavailable': 'A análise de mídia está indisponível no momento.',
  'binary-not-stored': 'A mídia ainda está sendo preparada. Tente novamente em instantes.',
};

export function MessageMediaInterpretation({
  conversationId,
  message,
  canManage,
}: MessageMediaInterpretationProps) {
  const [interpretation, setInterpretation] = useState<
    WhatsAppMediaInterpretation | DeferredWhatsAppMediaInterpretation | null
  >(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correction, setCorrection] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isPending, startTransition] = useTransition();

  function load(refresh = false) {
    setExpanded(true);
    if (loaded && !error && !refresh) return;
    setError('');
    startTransition(async () => {
      const result = await getMediaInterpretationAction({
        conversationId,
        messageId: message.id,
      });
      setLoaded(true);
      if (result.success) setInterpretation(result.interpretation);
      else setError(result.message);
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
      else {
        // A análise pode continuar na API mesmo quando a conexão de espera falha.
        const refreshed = await getMediaInterpretationAction({
          conversationId,
          messageId: message.id,
        });
        if (refreshed.success && refreshed.interpretation.status !== 'not-requested') {
          setInterpretation(refreshed.interpretation);
        } else {
          setError(result.message);
        }
      }
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
        setError(result.message);
      }
    });
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        onClick={() => load()}
        aria-expanded={false}
        disabled={isPending}
        aria-controls={'interpretation-' + message.id}
      >
        <FileSearch aria-hidden="true" /> Ver interpretação
      </Button>
    );
  }
  const analyzed = interpretation && interpretation.status !== 'deferred' ? interpretation : null;
  const content =
    analyzed?.transcription?.trim() || analyzed?.extractedText?.trim() || analyzed?.summary?.trim();
  return (
    <section
      id={'interpretation-' + message.id}
      className="grid gap-2 rounded-lg border bg-background/70 p-2 text-xs"
      aria-label="Interpretação da mídia"
    >
      <header className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          {message.kind === 'audio' ? 'Transcrição' : 'Interpretação'}
        </span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          aria-label="Fechar interpretação"
          aria-expanded={true}
          aria-controls={'interpretation-' + message.id}
          onClick={() => setExpanded(false)}
        >
          <X aria-hidden="true" /> Fechar
        </Button>
      </header>
      {isPending && !interpretation ? (
        <p className="flex items-center gap-1 text-muted-foreground" aria-live="polite">
          <LoaderCircle className="size-3 animate-spin" aria-hidden="true" /> Consultando
          interpretação…
        </p>
      ) : null}
      {interpretation?.status === 'deferred' ? (
        <p className="text-muted-foreground">{DEFERRED_LABELS[interpretation.reason]}</p>
      ) : null}
      {content ? (
        <p className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2">
          {content}
        </p>
      ) : analyzed ? (
        <p className="text-muted-foreground">
          {analyzed.status === 'pending'
            ? 'A mídia está sendo analisada.'
            : analyzed.status === 'failed'
              ? 'Não foi possível analisar esta mídia.'
              : analyzed.status === 'unsupported'
                ? 'Este formato ainda não possui interpretação.'
                : 'Ainda não há texto disponível para esta mídia.'}
        </p>
      ) : null}
      {analyzed?.correction ? (
        <div className="rounded border border-primary/30 bg-primary/5 p-2">
          <p className="flex items-center gap-1 font-medium">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Correção registrada
          </p>
          <p className="mt-1 whitespace-pre-wrap">{analyzed.correction.correction}</p>
        </div>
      ) : null}
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-1">
        {error || interpretation?.status === 'deferred' || analyzed?.status === 'pending' ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={isPending}
            onClick={() => load(true)}
          >
            Atualizar interpretação
          </Button>
        ) : null}
        {canManage && analyzed?.status === 'not-requested' ? (
          <Button type="button" size="xs" onClick={analyze} disabled={isPending}>
            <FileSearch aria-hidden="true" /> Analisar agora
          </Button>
        ) : null}
        {canManage && analyzed?.status === 'succeeded' && !analyzed.correction ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setCorrectionOpen(true)}
            disabled={isPending}
          >
            <PencilLine aria-hidden="true" /> Corrigir interpretação
          </Button>
        ) : null}
      </div>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <form onSubmit={submitCorrection} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Corrigir interpretação</DialogTitle>
              <DialogDescription>
                O atendimento usará esta correção nas próximas respostas. Revise o texto antes de
                salvar, pois ele não poderá ser editado depois.
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
