import { cva } from 'class-variance-authority';

export const conversationWorkspaceStyles = {
  section: cva(
    'grid h-full w-full max-w-full min-w-0 overflow-hidden bg-card text-card-foreground lg:grid-cols-[clamp(22rem,28vw,27rem)_minmax(0,1fr)]',
  ),
  visuallyHidden: cva('sr-only'),
  sidebar: cva(
    'h-full min-h-0 w-full max-w-full min-w-0 flex-col border-b border-border bg-card lg:flex lg:border-r lg:border-b-0',
  ),
  sidebarHeader: cva('min-w-0 border-b border-border px-3 py-3'),
  sidebarHeading: cva('flex items-start justify-between gap-3'),
  sidebarEyebrow: cva('text-sm font-extrabold uppercase tracking-wide text-primary-emphasis'),
  sidebarTitle: cva('sr-only'),
  refreshButton: cva(
    'inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-50 [&_svg]:size-4',
  ),
  errorBanner: cva(
    'mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-emphasis ring-1 ring-destructive/20 [&>svg]:size-4 [&>button]:font-bold [&>button]:underline',
  ),
  searchContainer: cva('relative mt-3'),
  searchIcon: cva(
    'pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground',
  ),
  searchInput: cva(
    'h-10 w-full rounded-full border border-input bg-background pr-3 pl-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20',
  ),
  quickFilters: cva('mt-3 flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5'),
  quickFilter: cva(
    'inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-bold text-muted-foreground transition hover:bg-muted',
    {
      variants: {
        active: {
          true: 'border-primary/40 bg-primary/15 text-primary-emphasis',
          false: '',
        },
      },
      defaultVariants: { active: false },
    },
  ),
  advancedFilters: cva(
    'mt-2 rounded-xl border border-border bg-muted/20 [&>summary]:flex [&>summary]:h-8 [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:items-center [&>summary]:justify-center [&>summary]:gap-2 [&>summary]:px-3 [&>summary]:text-xs [&>summary]:font-semibold [&>summary]:text-muted-foreground',
  ),
  filters: cva('grid min-w-0 gap-2 border-t border-border p-3 sm:grid-cols-2'),
  wideFilter: cva('sm:col-span-2'),
  filterLabel: cva('block text-xs font-semibold text-muted-foreground'),
  filterSelect: cva(
    'mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20',
  ),
  conversationList: cva('min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain'),
  pagination: cva(
    'flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground [&_strong]:text-foreground',
  ),
  conversationButton: cva(
    'flex w-full gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset focus-visible:outline-none',
    {
      variants: {
        selected: {
          true: 'bg-primary/12 hover:bg-primary/16',
          false: 'bg-card',
        },
      },
      defaultVariants: { selected: false },
    },
  ),
  avatar: cva(
    'flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary-emphasis',
  ),
  conversationSummary: cva('min-w-0 flex-1'),
  conversationHeading: cva('flex items-center justify-between gap-2'),
  contactName: cva('truncate text-sm font-bold text-foreground'),
  conversationTime: cva('shrink-0 text-[10px] text-muted-foreground'),
  phonePreview: cva('mt-0.5 block text-[11px] text-muted-foreground'),
  previewRow: cva('mt-1.5 flex items-center gap-2'),
  preview: cva('min-w-0 flex-1 truncate text-xs leading-5 text-muted-foreground'),
  unreadBadge: cva(
    'flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground',
  ),
  listMetadata: cva('mt-1.5 flex flex-wrap gap-1'),
  departmentBadge: cva(
    'inline-flex rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground',
  ),
  controlBadge: cva('inline-flex rounded-full px-2 py-1 text-[10px] font-semibold', {
    variants: {
      control: {
        bot: 'bg-success/15 text-success-emphasis',
        human: 'bg-info/15 text-info',
        paused: 'bg-warning/15 text-warning-emphasis',
        closed: 'bg-muted text-muted-foreground',
      },
    },
  }),
  requestBadge: cva('inline-flex rounded-full px-2 py-1 text-[10px] font-semibold', {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        progress: 'bg-info/15 text-info',
        waiting: 'bg-warning/15 text-warning-emphasis',
        success: 'bg-success/15 text-success-emphasis',
        danger: 'bg-destructive/15 text-destructive-emphasis',
      },
    },
  }),
  emptyList: cva('flex flex-col items-center px-6 py-14 text-center'),
  emptyIcon: cva('size-8 text-muted-foreground/40'),
  emptyTitle: cva('mt-3 text-sm font-bold text-foreground'),
  emptyDescription: cva('mt-1 text-xs leading-5 text-muted-foreground'),
  detail: cva(
    'h-full min-h-0 w-full max-w-full min-w-0 flex-col overflow-hidden bg-muted/20 lg:flex',
  ),
  detailHeader: cva(
    'flex min-h-14 items-center justify-between gap-2 border-b border-border bg-primary/8 px-3 py-1.5',
  ),
  contactBlock: cva(
    'flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left transition hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-wait disabled:opacity-70 sm:gap-3',
  ),
  contactIdentity: cva('flex min-w-0 flex-1 flex-col items-start gap-0.5'),
  detailAvatar: cva(
    'flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground',
  ),
  detailTitle: cva('shrink-0 text-sm font-bold text-foreground'),
  phone: cva('flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5'),
  lastInteraction: cva('min-w-0 text-[11px] text-muted-foreground'),
  headerAssignment: cva('flex shrink-0 items-center gap-0.5 text-muted-foreground'),
  versionBadge: cva(
    'w-fit rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground',
  ),
  highlight: cva(
    'flex min-w-0 items-start gap-2 bg-card px-3 py-2 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&_span]:min-w-0 [&_strong]:block [&_strong]:whitespace-nowrap [&_strong]:text-[11px] [&_small]:mt-0.5 [&_small]:block [&_small]:truncate [&_small]:text-[10px] [&_small]:leading-4',
    {
      variants: {
        tone: {
          success: 'text-success-emphasis',
          danger: 'text-destructive-emphasis',
          info: 'text-info',
          warning: 'text-warning-emphasis',
          neutral: 'text-muted-foreground',
        },
      },
    },
  ),
  dimensionGrid: cva(
    'grid min-w-0 grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3 xl:grid-cols-5',
  ),
  dimensionItem: cva(
    'flex min-w-0 items-start gap-2 bg-card px-3 py-1.5 [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-primary-emphasis [&_small]:block [&_small]:text-[9px] [&_small]:font-semibold [&_small]:uppercase [&_small]:tracking-wide [&_small]:text-muted-foreground [&_strong]:block [&_strong]:truncate [&_strong]:text-[11px] [&_strong]:leading-4 [&_strong]:text-foreground',
  ),
  assignment: cva(
    'flex flex-wrap items-center gap-2 border-b border-border bg-card px-5 py-2.5 text-xs text-muted-foreground [&>svg]:size-4 [&>svg]:text-muted-foreground [&>small]:ml-auto [&>small]:text-muted-foreground',
  ),
  actionsPanel: cva('border-b border-border bg-card px-3 py-1.5'),
  actionsTitle: cva('sr-only'),
  actionColumns: cva('grid min-w-0 gap-1.5 xl:grid-cols-2 xl:[&>div:last-child]:justify-end'),
  actions: cva('grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap'),
  actionButton: cva(
    'inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:px-2.5 [&_svg]:size-3.5',
    {
      variants: {
        action: {
          human: 'bg-info/10 text-info ring-1 ring-info/20 hover:bg-info/15',
          bot: 'bg-success/10 text-success-emphasis ring-1 ring-success/20 hover:bg-success/15',
          read: 'bg-muted text-foreground ring-1 ring-border hover:bg-muted/70',
          forward: 'bg-warning/10 text-warning-emphasis ring-1 ring-warning/20 hover:bg-warning/15',
          close:
            'bg-destructive/10 text-destructive-emphasis ring-1 ring-destructive/20 hover:bg-destructive/15',
        },
      },
    },
  ),
  quotePanel: cva('border-b border-border bg-card px-3 py-2'),
  panelHeading: cva(
    'grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-foreground',
  ),
  panelEyebrow: cva('sr-only'),
  quoteActions: cva(
    'grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end [&_button]:w-full sm:[&_button]:w-auto',
  ),
  closureHistoryList: cva('mt-4 grid gap-3'),
  closureHistoryItem: cva(
    'rounded-xl border border-border bg-muted/30 p-4 [&_dl]:grid [&_dl]:gap-3 sm:[&_dl]:grid-cols-3 [&_dt]:text-[10px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-wide [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words [&_dd]:text-xs [&_dd]:leading-5 [&_dd]:text-foreground',
  ),
  detailFooter: cva('mt-auto border-t border-border bg-card px-4 py-2'),
  feedback: cva('mt-2 min-h-5 text-xs font-semibold', {
    variants: {
      tone: {
        neutral: 'text-muted-foreground',
        success: 'text-success-emphasis',
        error: 'text-destructive-emphasis',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }),
  emptyDetail: cva('flex flex-1 flex-col items-center justify-center px-6 text-center'),
  emptyDetailIcon: cva('size-12 text-muted-foreground/40'),
  emptyDetailTitle: cva('mt-4 text-base font-bold text-foreground'),
  emptyDetailDescription: cva('mt-2 max-w-sm text-sm leading-6 text-muted-foreground'),
};
