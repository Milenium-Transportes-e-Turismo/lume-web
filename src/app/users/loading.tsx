import { Skeleton } from '@/shared/ui/skeleton';

export default function UsersLoading() {
  return (
    <main className="lume-page space-y-5" aria-busy="true">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
      <span className="sr-only">Carregando usuários</span>
    </main>
  );
}
