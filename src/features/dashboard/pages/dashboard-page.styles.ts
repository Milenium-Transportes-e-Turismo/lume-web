import { cva } from 'class-variance-authority';

export const dashboardPageStyles = {
  content: cva('lume-page'),

  eyebrow: cva('text-sm font-semibold text-primary-emphasis'),

  heading: cva('mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'),

  title: cva('max-w-3xl text-2xl font-bold tracking-tight text-foreground sm:text-3xl'),

  description: cva('mt-1 max-w-3xl text-sm leading-6 text-muted-foreground'),

  liveBadge: cva(
    'inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-emphasis [&_svg]:size-3.5',
  ),

  errorBanner: cva(
    'mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive-emphasis [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0',
  ),

  graphGrid: cva('mt-6 grid gap-5 xl:grid-cols-2'),

  summaryCard: cva('mt-6 shadow-sm'),

  summaryContent: cva('flex items-center gap-4 p-5'),

  summaryIcon: cva(
    'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-emphasis [&_svg]:size-5',
  ),
};
