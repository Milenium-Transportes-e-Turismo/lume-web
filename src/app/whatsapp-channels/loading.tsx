import { Skeleton } from '@/shared/ui/skeleton';

export default function WhatsAppChannelsLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[1700px] space-y-4 p-3 sm:p-4 lg:p-6"
      aria-label="Carregando canais WhatsApp"
    >
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-[36rem] w-full" />
    </main>
  );
}
