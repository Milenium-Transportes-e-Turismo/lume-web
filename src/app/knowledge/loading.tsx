import { Skeleton } from '@/shared/ui/skeleton';

export default function KnowledgeLoading() {
  return (
    <div className="grid gap-3 p-4" aria-label="Carregando knowledge">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-[34rem]" />
        <Skeleton className="h-[34rem]" />
        <Skeleton className="h-[34rem]" />
      </div>
    </div>
  );
}
