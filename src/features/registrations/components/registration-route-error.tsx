'use client';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function RegistrationRouteError({ reset }: { readonly reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center p-4 md:p-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-5 text-destructive" />
            Não foi possível carregar esta área
          </CardTitle>
          <CardDescription>
            Verifique a conexão com a API do Lume e tente novamente. Nenhuma alteração foi aplicada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={reset}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
