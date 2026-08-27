import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

export default function RegistrationsLoading() {
  return (
    <main className="mx-auto w-full max-w-[96rem] space-y-4 p-4 md:p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Card size="sm">
        <CardHeader>
          <Skeleton className="h-9 w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton className="h-12 w-full" key={index} />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
