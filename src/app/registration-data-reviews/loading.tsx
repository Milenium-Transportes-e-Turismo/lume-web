import { Skeleton } from '@/shared/ui/skeleton';

export default function RegistrationDataReviewsLoading() {
  return (
    <div className="grid gap-3 p-4" aria-label="Carregando revisões cadastrais">
      <Skeleton className="h-24" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-[34rem]" />
        <Skeleton className="h-[34rem]" />
      </div>
    </div>
  );
}
