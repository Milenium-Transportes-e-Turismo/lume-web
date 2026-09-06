import { Skeleton } from '@/shared/ui/skeleton';

export default function AiAgentsLoading() {
  return (
    <main className="lume-page space-y-4" aria-label="Carregando agentes de IA">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-[42rem] w-full" />
    </main>
  );
}
