export function QuoteProposalsLoading() {
  return (
    <main className="lume-page animate-pulse" aria-label="Carregando propostas">
      <div className="h-4 w-28 rounded bg-muted" />
      <div className="mt-3 h-9 w-80 max-w-full rounded bg-muted" />
      <div className="mt-3 h-5 w-[34rem] max-w-full rounded bg-muted" />

      <div className="mt-8 h-28 rounded-xl bg-muted" />
      <div className="mt-6 grid min-h-[36rem] overflow-hidden rounded-xl border bg-card lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-4 border-b p-5 lg:border-r lg:border-b-0">
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-20 rounded-lg bg-muted" />
          <div className="h-20 rounded-lg bg-muted" />
          <div className="h-20 rounded-lg bg-muted" />
        </div>
        <div className="space-y-5 p-6">
          <div className="h-16 rounded-lg bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
          <div className="h-52 rounded-xl bg-muted" />
        </div>
      </div>
    </main>
  );
}
