import type { AuthenticatedSession } from '@/features/auth/domain';
import { AuthenticatedShell } from '@/features/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

import { QuoteProposalArchive, QuoteProposalWorkspace } from '../components';
import type { PendingQuoteProposal, QuoteProposalCategory } from '../domain';

const contentClassName = 'lume-page';

export type QuoteProposalTab = 'pending' | 'sent' | 'approved' | 'cancelled';

export interface QuoteProposalsPageProps {
  readonly session: AuthenticatedSession;
  readonly initialTab: QuoteProposalTab;
  readonly pending: readonly PendingQuoteProposal[];
  readonly pendingTotal: number;
  readonly sent: readonly PendingQuoteProposal[];
  readonly approved: readonly PendingQuoteProposal[];
  readonly cancelled: readonly PendingQuoteProposal[];
  readonly errors?: Partial<Record<QuoteProposalTab, string | null>>;
  readonly canManage?: boolean;
}

export function QuoteProposalsPage({
  session,
  initialTab,
  pending,
  pendingTotal,
  sent,
  approved,
  cancelled,
  errors = {},
  canManage = true,
}: QuoteProposalsPageProps) {
  const tabs: readonly {
    value: QuoteProposalTab;
    label: string;
    count: number;
  }[] = [
    { value: 'pending', label: 'Pendentes', count: pendingTotal },
    { value: 'sent', label: 'Enviadas', count: sent.length },
    { value: 'approved', label: 'Aprovadas', count: approved.length },
    { value: 'cancelled', label: 'Canceladas', count: cancelled.length },
  ];

  return (
    <AuthenticatedShell user={session.user}>
      <div className={contentClassName}>
        <header>
          <p className="text-sm font-semibold text-primary-emphasis">Comercial</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Orçamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe pendências, envios, aprovações e cancelamentos sem sair desta tela.
          </p>
        </header>

        <Tabs defaultValue={initialTab} className="mt-6 gap-5">
          <TabsList
            className="grid h-auto w-full grid-cols-2 sm:grid-cols-4"
            aria-label="Filas de orçamentos"
          >
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="min-w-0 py-1.5">
                <span className="truncate">{tab.label}</span>
                <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                  {tab.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="pending">
            <QuoteProposalWorkspace
              initialPendingProposals={pending}
              initialPendingTotal={pendingTotal}
              initialSentProposals={sent}
              initialSentTotal={sent.length}
              initialError={errors.pending ?? null}
              showHistory={false}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="sent">
            <QuoteProposalArchive
              category="sent"
              initialProposals={sent}
              initialError={errors.sent ?? null}
              canManage={canManage}
              showHeader={false}
            />
          </TabsContent>
          <TabsContent value="approved">
            <QuoteProposalArchive
              category="approved"
              initialProposals={approved}
              initialError={errors.approved ?? null}
              canManage={canManage}
              showHeader={false}
            />
          </TabsContent>
          <TabsContent value="cancelled">
            <QuoteProposalArchive
              category="cancelled"
              initialProposals={cancelled}
              initialError={errors.cancelled ?? null}
              canManage={canManage}
              showHeader={false}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AuthenticatedShell>
  );
}

export interface PendingQuoteProposalsPageProps {
  readonly session: AuthenticatedSession;
  readonly proposals: readonly PendingQuoteProposal[];
  readonly total: number;
  readonly initialError?: string | null;
  readonly canManage?: boolean;
}

export function PendingQuoteProposalsPage({
  session,
  proposals,
  total,
  initialError = null,
  canManage = true,
}: PendingQuoteProposalsPageProps) {
  return (
    <AuthenticatedShell user={session.user}>
      <div className={contentClassName}>
        <header>
          <p className="text-sm font-semibold text-primary-emphasis">Comercial · Orçamentos</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Orçamentos pendentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prioridade da equipe: valide os dados, anexe um ou mais PDFs e confirme o envio.
          </p>
        </header>
        <QuoteProposalWorkspace
          initialPendingProposals={proposals}
          initialPendingTotal={total}
          initialSentProposals={[]}
          initialSentTotal={0}
          initialError={initialError}
          showHistory={false}
          canManage={canManage}
        />
      </div>
    </AuthenticatedShell>
  );
}

export interface QuoteProposalArchivePageProps {
  readonly session: AuthenticatedSession;
  readonly category: Exclude<QuoteProposalCategory, 'pending'>;
  readonly proposals: readonly PendingQuoteProposal[];
  readonly initialError?: string | null;
  readonly canManage?: boolean;
}

export function QuoteProposalArchivePage({
  session,
  category,
  proposals,
  initialError = null,
  canManage = true,
}: QuoteProposalArchivePageProps) {
  return (
    <AuthenticatedShell user={session.user}>
      <div className={contentClassName}>
        <QuoteProposalArchive
          category={category}
          initialProposals={proposals}
          initialError={initialError}
          canManage={canManage}
        />
      </div>
    </AuthenticatedShell>
  );
}
