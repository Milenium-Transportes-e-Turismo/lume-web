'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  FileText,
  LoaderCircle,
  Upload,
  XCircle,
} from 'lucide-react';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  combineBrazilianCivilDateTime,
  isValidCivilDate,
  splitBrazilianDateTime,
} from '@/shared/lib/civil-date-time';
import { userFacingMessage } from '@/shared/lib/user-facing-message';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/form-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Textarea } from '@/shared/ui/textarea';

import {
  createQuoteProposalAction,
  decideQuoteProposalAction,
  getQuoteProposalDocumentHistoryAction,
  sendQuoteProposalAction,
} from '../actions';
import {
  formatQuoteProposalServiceType,
  formatQuoteProposalPdfSize,
  type PendingQuoteProposal,
  type QuoteProposalDocument,
  type QuoteProposalPdfValidationResult,
  validateQuoteProposalPdf,
} from '../domain';

const proposalFormSchema = z
  .object({
    contactName: z.string().trim().min(2, 'Informe o nome do cliente.').max(160),
    document: z.string().trim().max(20),
    email: z
      .union([z.literal(''), z.string().trim().email('Informe um e-mail válido.')])
      .refine((value) => value.length <= 254, 'O e-mail é muito longo.'),
    serviceType: z.string().min(1, 'Selecione o tipo de serviço.'),
    origin: z.string().trim().min(2, 'Informe a origem.').max(300),
    destination: z.string().trim().min(2, 'Informe o destino.').max(300),
    departureDate: z.string().refine(isValidCivilDate, 'Informe uma data de saída válida.'),
    departureTime: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.')
      .or(z.literal('')),
    returnDate: z
      .string()
      .refine(
        (value) => value === '' || isValidCivilDate(value),
        'Informe uma data de retorno válida.',
      ),
    returnTime: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.')
      .or(z.literal('')),
    passengerCount: z
      .number()
      .int('Informe um número inteiro.')
      .min(1, 'Informe ao menos um passageiro.')
      .max(1000),
    vehicleType: z.string(),
    vehicleAtDisposal: z.boolean(),
    localTransfers: z.boolean(),
    notes: z.string().trim().max(2000),
  })
  .superRefine((value, context) => {
    if (value.returnDate && value.returnDate < value.departureDate) {
      context.addIssue({
        code: 'custom',
        path: ['returnDate'],
        message: 'O retorno não pode ser anterior à saída.',
      });
    }
    if (value.returnTime && !value.returnDate) {
      context.addIssue({
        code: 'custom',
        path: ['returnDate'],
        message: 'Informe a data de retorno antes do horário.',
      });
    }
    if (
      value.returnDate === value.departureDate &&
      value.departureTime &&
      value.returnTime &&
      value.returnTime < value.departureTime
    ) {
      context.addIssue({
        code: 'custom',
        path: ['returnTime'],
        message: 'O horário de retorno não pode ser anterior ao de saída.',
      });
    }
  });

const rejectionSchema = z.object({
  reason: z.string().trim().min(3, 'Explique brevemente o motivo da recusa.').max(500),
});

type ProposalFormValues = z.infer<typeof proposalFormSchema>;
type RejectionFormValues = z.infer<typeof rejectionSchema>;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function defaultValues(proposal: PendingQuoteProposal): ProposalFormValues {
  const departureDateTime = splitBrazilianDateTime(proposal.summary.departureAt);
  const returnDateTime = splitBrazilianDateTime(proposal.summary.returnAt);
  return {
    contactName: proposal.summary.contactName?.trim() || proposal.contact.name,
    document: proposal.summary.document ?? '',
    email: proposal.summary.email ?? '',
    serviceType:
      formatQuoteProposalServiceType(proposal.summary.serviceType) ?? 'Fretamento eventual',
    origin: proposal.summary.origin ?? '',
    destination: proposal.summary.destination ?? '',
    departureDate: proposal.summary.departureDate ?? departureDateTime?.date ?? '',
    departureTime: departureDateTime?.time ?? '',
    returnDate: proposal.summary.returnDate ?? returnDateTime?.date ?? '',
    returnTime: returnDateTime?.time ?? '',
    passengerCount: proposal.summary.passengerCount ?? 1,
    vehicleType: proposal.summary.vehicleType ?? '',
    vehicleAtDisposal: proposal.summary.vehicleAtDisposal ?? false,
    localTransfers: proposal.summary.localTransfers ?? false,
    notes: proposal.summary.notes ?? '',
  };
}

function decisionLabel(proposal: PendingQuoteProposal): string {
  if (proposal.decision.status === 'approved') return 'Aprovada';
  if (proposal.decision.status === 'rejected') return 'Recusada';
  if (proposal.decision.status === 'cancelled') return 'Cancelada';
  return 'Aguardando decisão';
}

interface ProposalHistoryProps {
  readonly proposals: readonly PendingQuoteProposal[];
  readonly total: number;
  readonly onCreated: (proposal: PendingQuoteProposal) => void;
  readonly onDecided: (proposal: PendingQuoteProposal) => void;
  readonly onError: (message: string) => void;
  readonly title?: string;
  readonly description?: string;
  readonly emptyMessage?: string;
  readonly itemLabel?: {
    readonly singular: string;
    readonly plural: string;
  };
  readonly showDecisionActions?: boolean;
  readonly showCreateAction?: boolean;
  readonly compactCreateOnly?: boolean;
}

interface NewProposalSubmissionIdentity {
  readonly seedQuoteRequestId: string;
  readonly batchId: string;
  readonly createCommandId: string;
  readonly uploadCommandId: string;
  readonly sendCommandId: string;
  readonly createdProposal?: PendingQuoteProposal;
  readonly uploadedDocument?: QuoteProposalDocument;
}

function proposalCycleKey(proposal: PendingQuoteProposal): string {
  return `conversation:${proposal.conversationId}`;
}

function isMoreRecent(candidate: PendingQuoteProposal, current: PendingQuoteProposal): boolean {
  const requestedDifference =
    new Date(candidate.requestedAt).valueOf() - new Date(current.requestedAt).valueOf();
  if (requestedDifference !== 0) return requestedDifference > 0;
  return new Date(candidate.updatedAt).valueOf() > new Date(current.updatedAt).valueOf();
}

export function ProposalHistory({
  proposals,
  total,
  onCreated,
  onDecided,
  onError,
  title = 'Propostas enviadas',
  description = 'Histórico comercial agrupado por cliente e solicitação.',
  emptyMessage = 'Nenhuma proposta enviada até o momento.',
  itemLabel = { singular: 'enviada', plural: 'enviadas' },
  showDecisionActions = true,
  showCreateAction = true,
  compactCreateOnly = false,
}: ProposalHistoryProps) {
  const [newProposalSeed, setNewProposalSeed] = React.useState<PendingQuoteProposal | null>(null);
  const [newProposalError, setNewProposalError] = React.useState('');
  const [newProposalFile, setNewProposalFile] = React.useState<File | null>(null);
  const [newProposalFileValidation, setNewProposalFileValidation] =
    React.useState<QuoteProposalPdfValidationResult | null>(null);
  const [isValidatingNewProposalFile, setIsValidatingNewProposalFile] = React.useState(false);
  const [newSubmissionIdentity, setNewSubmissionIdentity] =
    React.useState<NewProposalSubmissionIdentity | null>(null);
  const [rejectedProposal, setRejectedProposal] = React.useState<PendingQuoteProposal | null>(null);
  const [documentHistoryProposal, setDocumentHistoryProposal] =
    React.useState<PendingQuoteProposal | null>(null);
  const [documentHistory, setDocumentHistory] = React.useState<readonly QuoteProposalDocument[]>(
    [],
  );
  const [documentHistoryError, setDocumentHistoryError] = React.useState('');
  const [isLoadingDocumentHistory, setIsLoadingDocumentHistory] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const newFileValidationSequence = React.useRef(0);
  const proposalForm = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: proposals[0] ? defaultValues(proposals[0]) : undefined,
  });
  const rejectionForm = useForm<RejectionFormValues>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { reason: '' },
  });

  const groups = React.useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        current: PendingQuoteProposal;
        history: PendingQuoteProposal[];
      }
    >();
    for (const proposal of proposals) {
      const key = proposalCycleKey(proposal);
      const current = grouped.get(key);
      if (current) {
        current.history.push(proposal);
        if (isMoreRecent(proposal, current.current)) {
          current.current = proposal;
        }
      } else {
        grouped.set(key, {
          key,
          current: proposal,
          history: [proposal],
        });
      }
    }
    return [...grouped.values()].map((group) => ({
      ...group,
      history: group.history.sort((left, right) => {
        const requestedDifference =
          new Date(right.requestedAt).valueOf() - new Date(left.requestedAt).valueOf();
        return requestedDifference || right.summary.sequence - left.summary.sequence;
      }),
    }));
  }, [proposals]);

  function openNewProposal(proposal: PendingQuoteProposal) {
    setNewProposalError('');
    proposalForm.reset(defaultValues(proposal));
    setNewProposalFile(null);
    setNewProposalFileValidation(null);
    setNewSubmissionIdentity({
      seedQuoteRequestId: proposal.quoteRequestId,
      batchId: crypto.randomUUID(),
      createCommandId: crypto.randomUUID(),
      uploadCommandId: crypto.randomUUID(),
      sendCommandId: crypto.randomUUID(),
    });
    setNewProposalSeed(proposal);
  }

  function closeNewProposal() {
    setNewProposalSeed(null);
    setNewProposalFile(null);
    setNewProposalFileValidation(null);
    setIsValidatingNewProposalFile(false);
    setNewSubmissionIdentity(null);
    setNewProposalError('');
  }

  function cancelNewProposal() {
    newFileValidationSequence.current += 1;
    closeNewProposal();
  }

  async function handleNewProposalFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    const sequence = newFileValidationSequence.current + 1;
    newFileValidationSequence.current = sequence;
    setNewProposalFile(file);
    setNewProposalFileValidation(null);
    setIsValidatingNewProposalFile(false);

    if (!file) return;

    setIsValidatingNewProposalFile(true);
    const validation = await validateQuoteProposalPdf(file);
    if (newFileValidationSequence.current === sequence) {
      setNewProposalFileValidation(validation);
      setIsValidatingNewProposalFile(false);
    }
  }

  async function openDocumentHistory(proposal: PendingQuoteProposal) {
    setDocumentHistoryProposal(proposal);
    setDocumentHistory(proposal.proposalDocument ? [proposal.proposalDocument] : []);
    setDocumentHistoryError('');
    setIsLoadingDocumentHistory(true);

    const result = await getQuoteProposalDocumentHistoryAction(proposal.quoteRequestId);
    if (result.success) {
      setDocumentHistory(result.documents);
    } else {
      setDocumentHistoryError(
        userFacingMessage(result.message, 'Não foi possível consultar os PDFs desta solicitação.'),
      );
    }
    setIsLoadingDocumentHistory(false);
  }

  function submitNewProposal(values: ProposalFormValues, shouldSend: boolean) {
    if (!newProposalSeed || !newSubmissionIdentity) return;
    if (
      shouldSend &&
      !newSubmissionIdentity.uploadedDocument &&
      (newProposalFile === null || newProposalFileValidation?.valid !== true)
    ) {
      setNewProposalError('Selecione um PDF válido para cadastrar e enviar a proposta.');
      return;
    }

    setNewProposalError('');
    startTransition(async () => {
      let createdProposal = newSubmissionIdentity.createdProposal;
      if (!createdProposal) {
        const result = await createQuoteProposalAction({
          commandId: newSubmissionIdentity.createCommandId,
          expectedVersion: newProposalSeed.conversationVersion,
          conversationId: newProposalSeed.conversationId,
          ...values,
          departureDate: values.departureDate,
          departureAt: combineBrazilianCivilDateTime(values.departureDate, values.departureTime),
          returnDate: values.returnDate || null,
          returnAt: values.returnDate
            ? combineBrazilianCivilDateTime(values.returnDate, values.returnTime)
            : null,
          document: values.document || null,
          email: values.email || undefined,
          vehicleType: values.vehicleType || null,
          notes: values.notes || null,
        });
        if (!result.success) {
          setNewProposalError(
            userFacingMessage(result.message, 'Não foi possível cadastrar o orçamento.'),
          );
          return;
        }
        createdProposal = result.proposal;
        setNewSubmissionIdentity((current) =>
          current
            ? {
                ...current,
                createdProposal: result.proposal,
              }
            : current,
        );
      }

      if (!shouldSend) {
        onCreated(createdProposal);
        closeNewProposal();
        return;
      }

      const formData = new FormData();
      formData.set('quoteRequestId', createdProposal.quoteRequestId);
      formData.set('batchId', newSubmissionIdentity.batchId);
      formData.set('uploadCommandId', newSubmissionIdentity.uploadCommandId);
      formData.set('sendCommandId', newSubmissionIdentity.sendCommandId);
      formData.set('expectedVersion', String(createdProposal.conversationVersion));
      formData.set('confirmed', 'true');
      if (newProposalFile) formData.set('file', newProposalFile);
      if (newSubmissionIdentity.uploadedDocument) {
        formData.set('proposalDocumentId', newSubmissionIdentity.uploadedDocument.id);
        formData.set('uploadedFileName', newSubmissionIdentity.uploadedDocument.fileName);
        formData.set('uploadedSizeBytes', String(newSubmissionIdentity.uploadedDocument.sizeBytes));
        formData.set('uploadedSha256', newSubmissionIdentity.uploadedDocument.sha256);
      }

      const sendResult = await sendQuoteProposalAction(formData);
      if (!sendResult.success) {
        const queuedProposal = {
          ...createdProposal,
          ...(sendResult.uploadedDocument ? { proposalDocument: sendResult.uploadedDocument } : {}),
          ...(sendResult.currentVersion ? { conversationVersion: sendResult.currentVersion } : {}),
        };
        if (sendResult.uploadedDocument || sendResult.currentVersion) {
          setNewSubmissionIdentity((current) =>
            current
              ? {
                  ...current,
                  createdProposal: queuedProposal,
                  ...(sendResult.uploadedDocument
                    ? { uploadedDocument: sendResult.uploadedDocument }
                    : {}),
                }
              : current,
          );
        }
        onCreated(queuedProposal);
        setNewProposalError(
          userFacingMessage(sendResult.message, 'Não foi possível enviar a proposta.'),
        );
        return;
      }

      onCreated({
        ...createdProposal,
        conversationVersion: sendResult.proposal.conversationVersion,
        proposalDocument: sendResult.proposal.proposalDocument,
      });
      closeNewProposal();
    });
  }

  function decide(
    proposal: PendingQuoteProposal,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    startTransition(async () => {
      const result = await decideQuoteProposalAction({
        quoteRequestId: proposal.quoteRequestId,
        commandId: crypto.randomUUID(),
        expectedVersion: proposal.conversationVersion,
        decision,
        reason,
      });
      if (!result.success) {
        onError(userFacingMessage(result.message, 'Não foi possível registrar a decisão.'));
        return;
      }
      setRejectedProposal(null);
      rejectionForm.reset();
      onDecided(result.proposal);
    });
  }

  return (
    <section
      aria-label={compactCreateOnly ? 'Criar orçamento' : undefined}
      aria-labelledby={compactCreateOnly ? undefined : 'sent-proposals-title'}
      className="space-y-3"
    >
      {compactCreateOnly ? (
        groups[0] && showCreateAction && groups[0].current.conversationState !== 'closed' ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => openNewProposal(groups[0]!.current)}
          >
            <FilePlus2 aria-hidden="true" />
            Criar orçamento
          </Button>
        ) : null
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="sent-proposals-title" className="text-lg font-semibold">
                {title}
              </h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success-emphasis">
              {total} {total === 1 ? itemLabel.singular : itemLabel.plural}
            </span>
          </div>

          {groups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groups.map(({ key, current, history }) => (
                <Card key={key} className="gap-0 overflow-hidden py-2 px-0">
                  <CardHeader className="flex grid-cols-none flex-row items-start justify-between gap-3 border-b p-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{current.contact.name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{current.contact.phone}</p>
                    </div>
                    {showCreateAction && current.conversationState !== 'closed' ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openNewProposal(current)}
                      >
                        <FilePlus2 aria-hidden="true" />
                        {compactCreateOnly ? 'Criar orçamento' : 'Nova proposta'}
                      </Button>
                    ) : null}
                  </CardHeader>
                  {compactCreateOnly ? (
                    <CardContent className="grid gap-1 px-3 py-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <span>
                        Rota:{' '}
                        <strong className="text-foreground">
                          {current.summary.origin || 'não informada'} →{' '}
                          {current.summary.destination || 'não informado'}
                        </strong>
                      </span>
                      <span>
                        Última etapa:{' '}
                        <strong className="text-foreground">
                          {current.summary.sequence > 0
                            ? `orçamento #${current.summary.sequence}`
                            : 'sem orçamento anterior'}
                        </strong>
                      </span>
                    </CardContent>
                  ) : (
                    <CardContent className="p-0">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[20%]">Solicitação</TableHead>
                            <TableHead className="w-[20%]">Rota</TableHead>
                            <TableHead className="w-[22%]">Arquivo e envio</TableHead>
                            <TableHead className="w-[23%]">Decisão</TableHead>
                            <TableHead className="w-[15%] text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.map((proposal) => (
                            <TableRow key={proposal.quoteRequestId}>
                              <TableCell className="break-words whitespace-normal align-top">
                                <strong>#{proposal.summary.sequence}</strong>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Solicitada em {formatDateTime(proposal.requestedAt)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  por {proposal.requestedBy.name}
                                </p>
                              </TableCell>
                              <TableCell className="break-words whitespace-normal align-top">
                                <p className="font-medium">
                                  {proposal.summary.origin ?? 'Não informada'} →{' '}
                                  {proposal.summary.destination ?? 'Não informado'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {proposal.summary.passengerCount ?? '—'} passageiros
                                </p>
                              </TableCell>
                              <TableCell className="break-words whitespace-normal align-top">
                                <p className="font-medium">
                                  {proposal.proposalDocument?.fileName ?? 'PDF da proposta'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Enviada em {formatDateTime(proposal.proposalDocument?.sentAt)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  por{' '}
                                  {proposal.proposalDocument?.sentBy?.name ??
                                    proposal.proposalDocument?.uploadedBy?.name ??
                                    'Atendente'}
                                </p>
                              </TableCell>
                              <TableCell className="break-words whitespace-normal align-top">
                                <span
                                  className={
                                    proposal.decision.status === 'approved'
                                      ? 'font-semibold text-success-emphasis'
                                      : proposal.decision.status === 'rejected' ||
                                          proposal.decision.status === 'cancelled'
                                        ? 'font-semibold text-destructive-emphasis'
                                        : 'font-medium text-muted-foreground'
                                  }
                                >
                                  {decisionLabel(proposal)}
                                </span>
                                {proposal.decision.reason ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {proposal.decision.reason}
                                  </p>
                                ) : null}
                                {proposal.decision.decidedBy ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    por {proposal.decision.decidedBy.name} em{' '}
                                    {formatDateTime(proposal.decision.decidedAt)}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-wrap justify-end gap-2">
                                  {proposal.proposalDocument ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => void openDocumentHistory(proposal)}
                                    >
                                      <ExternalLink aria-hidden="true" />
                                      Visualizar PDF
                                    </Button>
                                  ) : null}
                                  {showDecisionActions ? (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                          isPending || proposal.decision.status !== 'pending'
                                        }
                                        onClick={() => decide(proposal, 'approved')}
                                      >
                                        <CheckCircle2 aria-hidden="true" />
                                        Aprovar
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        disabled={
                                          isPending || proposal.decision.status !== 'pending'
                                        }
                                        onClick={() => {
                                          rejectionForm.reset();
                                          setRejectedProposal(proposal);
                                        }}
                                      >
                                        <XCircle aria-hidden="true" />
                                        Recusar
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={newProposalSeed !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) cancelNewProposal();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova proposta</DialogTitle>
            <DialogDescription>
              Cadastre uma nova solicitação para o mesmo cliente. Você pode mantê-la na fila ou
              anexar o PDF e iniciar o envio agora.
            </DialogDescription>
          </DialogHeader>
          {newProposalError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-emphasis"
            >
              {newProposalError}
            </div>
          ) : null}
          <form
            id="new-quote-proposal-form"
            onSubmit={proposalForm.handleSubmit((values) => submitNewProposal(values, false))}
          >
            <fieldset disabled={Boolean(newSubmissionIdentity?.createdProposal)}>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(proposalForm.formState.errors.contactName)}>
                  <FieldLabel htmlFor="proposal-contact-name">Nome</FieldLabel>
                  <Input
                    id="proposal-contact-name"
                    aria-invalid={Boolean(proposalForm.formState.errors.contactName)}
                    {...proposalForm.register('contactName')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.contactName]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.document)}>
                  <FieldLabel htmlFor="proposal-document">CPF ou CNPJ</FieldLabel>
                  <Input id="proposal-document" {...proposalForm.register('document')} />
                  <FieldError errors={[proposalForm.formState.errors.document]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.email)}>
                  <FieldLabel htmlFor="proposal-email">E-mail</FieldLabel>
                  <Input
                    id="proposal-email"
                    type="email"
                    aria-invalid={Boolean(proposalForm.formState.errors.email)}
                    {...proposalForm.register('email')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.email]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.serviceType)}>
                  <FieldLabel htmlFor="proposal-service-type">Tipo de serviço</FieldLabel>
                  <Controller
                    control={proposalForm.control}
                    name="serviceType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="proposal-service-type"
                          className="w-full"
                          aria-invalid={Boolean(proposalForm.formState.errors.serviceType)}
                        >
                          <SelectValue>
                            {formatQuoteProposalServiceType(field.value) ?? 'Fretamento eventual'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fretamento eventual">Fretamento eventual</SelectItem>
                          <SelectItem value="Viagem contínua">Viagem contínua</SelectItem>
                          <SelectItem value="Traslado">Traslado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[proposalForm.formState.errors.serviceType]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.origin)}>
                  <FieldLabel htmlFor="proposal-origin">Origem</FieldLabel>
                  <Input
                    id="proposal-origin"
                    aria-invalid={Boolean(proposalForm.formState.errors.origin)}
                    {...proposalForm.register('origin')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.origin]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.destination)}>
                  <FieldLabel htmlFor="proposal-destination">Destino</FieldLabel>
                  <Input
                    id="proposal-destination"
                    aria-invalid={Boolean(proposalForm.formState.errors.destination)}
                    {...proposalForm.register('destination')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.destination]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.departureDate)}>
                  <FieldLabel htmlFor="proposal-departure-date">Data de saída</FieldLabel>
                  <Input
                    id="proposal-departure-date"
                    type="date"
                    aria-invalid={Boolean(proposalForm.formState.errors.departureDate)}
                    {...proposalForm.register('departureDate')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.departureDate]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.departureTime)}>
                  <FieldLabel htmlFor="proposal-departure-time">
                    Horário de saída (opcional)
                  </FieldLabel>
                  <Input
                    id="proposal-departure-time"
                    type="time"
                    aria-invalid={Boolean(proposalForm.formState.errors.departureTime)}
                    {...proposalForm.register('departureTime')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.departureTime]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.returnDate)}>
                  <FieldLabel htmlFor="proposal-return-date">Data de retorno (opcional)</FieldLabel>
                  <Input
                    id="proposal-return-date"
                    type="date"
                    aria-invalid={Boolean(proposalForm.formState.errors.returnDate)}
                    {...proposalForm.register('returnDate')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.returnDate]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.returnTime)}>
                  <FieldLabel htmlFor="proposal-return-time">
                    Horário de retorno (opcional)
                  </FieldLabel>
                  <Input
                    id="proposal-return-time"
                    type="time"
                    aria-invalid={Boolean(proposalForm.formState.errors.returnTime)}
                    {...proposalForm.register('returnTime')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.returnTime]} />
                </Field>
                <Field data-invalid={Boolean(proposalForm.formState.errors.passengerCount)}>
                  <FieldLabel htmlFor="proposal-passenger-count">Passageiros</FieldLabel>
                  <Input
                    id="proposal-passenger-count"
                    type="number"
                    min={1}
                    max={1000}
                    aria-invalid={Boolean(proposalForm.formState.errors.passengerCount)}
                    {...proposalForm.register('passengerCount', {
                      valueAsNumber: true,
                    })}
                  />
                  <FieldError errors={[proposalForm.formState.errors.passengerCount]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="proposal-vehicle-type">Veículo</FieldLabel>
                  <Controller
                    control={proposalForm.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <Select
                        value={field.value || '__not_defined__'}
                        onValueChange={(value) =>
                          field.onChange(value === '__not_defined__' ? '' : value)
                        }
                      >
                        <SelectTrigger id="proposal-vehicle-type" className="w-full">
                          <SelectValue>{field.value || 'Não definido'}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__not_defined__">Não definido</SelectItem>
                          <SelectItem value="Ônibus">Ônibus</SelectItem>
                          <SelectItem value="Micro-ônibus">Micro-ônibus</SelectItem>
                          <SelectItem value="Van">Van</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <FieldSet className="sm:col-span-2">
                  <FieldLegend>Detalhes do serviço</FieldLegend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Controller
                      control={proposalForm.control}
                      name="vehicleAtDisposal"
                      render={({ field }) => (
                        <Field orientation="horizontal">
                          <Checkbox
                            id="proposal-vehicle-at-disposal"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <FieldLabel htmlFor="proposal-vehicle-at-disposal">
                            Veículo à disposição
                          </FieldLabel>
                        </Field>
                      )}
                    />
                    <Controller
                      control={proposalForm.control}
                      name="localTransfers"
                      render={({ field }) => (
                        <Field orientation="horizontal">
                          <Checkbox
                            id="proposal-local-transfers"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <FieldLabel htmlFor="proposal-local-transfers">
                            Traslados locais
                          </FieldLabel>
                        </Field>
                      )}
                    />
                  </div>
                </FieldSet>
                <Field
                  className="sm:col-span-2"
                  data-invalid={Boolean(proposalForm.formState.errors.notes)}
                >
                  <FieldLabel htmlFor="proposal-notes">Observações</FieldLabel>
                  <Textarea
                    id="proposal-notes"
                    rows={3}
                    aria-invalid={Boolean(proposalForm.formState.errors.notes)}
                    {...proposalForm.register('notes')}
                  />
                  <FieldError errors={[proposalForm.formState.errors.notes]} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="new-proposal-pdf">PDF da proposta</FieldLabel>
                  <Input
                    id="new-proposal-pdf"
                    type="file"
                    accept=".pdf,application/pdf"
                    disabled={isPending}
                    onChange={handleNewProposalFileChange}
                  />
                  {isValidatingNewProposalFile ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      Validando PDF...
                    </p>
                  ) : newProposalFile && newProposalFileValidation?.valid ? (
                    <p className="text-sm text-success-emphasis">
                      {newProposalFile.name} ·{' '}
                      {formatQuoteProposalPdfSize(newProposalFileValidation.metadata.sizeBytes)} ·
                      PDF validado
                    </p>
                  ) : newProposalFile &&
                    newProposalFileValidation &&
                    !newProposalFileValidation.valid ? (
                    <p role="alert" className="text-sm text-destructive-emphasis">
                      {newProposalFileValidation.message}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Opcional para cadastrar; obrigatório para cadastrar e enviar. Limite de 10 MB.
                    </p>
                  )}
                </Field>
              </FieldGroup>
            </fieldset>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={cancelNewProposal}
            >
              Cancelar
            </Button>
            <Button type="submit" form="new-quote-proposal-form" disabled={isPending}>
              {isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <FilePlus2 aria-hidden="true" />
              )}
              Cadastrar
            </Button>
            <Button
              type="button"
              disabled={
                isPending ||
                isValidatingNewProposalFile ||
                (!newSubmissionIdentity?.uploadedDocument &&
                  newProposalFileValidation?.valid !== true)
              }
              onClick={proposalForm.handleSubmit((values) => submitNewProposal(values, true))}
            >
              {isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              Cadastrar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={documentHistoryProposal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDocumentHistoryProposal(null);
            setDocumentHistory([]);
            setDocumentHistoryError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>PDFs da solicitação</DialogTitle>
            <DialogDescription>
              Consulte todas as propostas vinculadas ao orçamento #
              {documentHistoryProposal?.summary.sequence}.
            </DialogDescription>
          </DialogHeader>

          {isLoadingDocumentHistory ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Carregando PDFs...
            </p>
          ) : documentHistoryError ? (
            <p role="alert" className="text-sm text-destructive-emphasis">
              {documentHistoryError}
            </p>
          ) : documentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum PDF foi registrado nesta solicitação.
            </p>
          ) : (
            <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
              {documentHistory.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                >
                  <FileText className="size-5 shrink-0 text-primary-emphasis" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{document.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatQuoteProposalPdfSize(document.sizeBytes)} ·{' '}
                      {document.sentAt
                        ? `Enviado em ${formatDateTime(document.sentAt)}`
                        : 'Envio ainda não confirmado'}
                      {document.sentBy?.name ? ` · por ${document.sentBy.name}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a
                        href={`/quote-proposals/${documentHistoryProposal?.quoteRequestId}/documents/${document.id}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <ExternalLink aria-hidden="true" />
                    Visualizar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectedProposal !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setRejectedProposal(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recusar proposta</DialogTitle>
            <DialogDescription>
              Registre uma breve explicação. Essa informação ficará no histórico comercial e poderá
              ser usada em relatórios.
            </DialogDescription>
          </DialogHeader>
          <form
            id="reject-quote-proposal-form"
            onSubmit={rejectionForm.handleSubmit(({ reason }) => {
              if (rejectedProposal) decide(rejectedProposal, 'rejected', reason);
            })}
          >
            <Field data-invalid={Boolean(rejectionForm.formState.errors.reason)}>
              <FieldLabel htmlFor="proposal-rejection-reason">Motivo da recusa</FieldLabel>
              <Textarea
                id="proposal-rejection-reason"
                rows={4}
                aria-invalid={Boolean(rejectionForm.formState.errors.reason)}
                {...rejectionForm.register('reason')}
              />
              <FieldError errors={[rejectionForm.formState.errors.reason]} />
            </Field>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setRejectedProposal(null)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="reject-quote-proposal-form"
              variant="destructive"
              disabled={isPending}
            >
              {isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <XCircle aria-hidden="true" />
              )}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
