'use client';

import { Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { createRegistrationTagAction } from '../actions/registration-actions';
import type { RegistrationCatalog } from '../domain';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';

export function RegistrationTagDialog({
  onCreated,
}: {
  readonly onCreated: (tag: RegistrationCatalog['tags'][number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" className="h-8 shrink-0" />}
      >
        <Plus aria-hidden="true" /> Criar marcador
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar marcador</DialogTitle>
          <DialogDescription>
            Organize seus cadastros com um nome fácil de reconhecer.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="registration-tag-name">Nome do marcador</Label>
        <Input
          id="registration-tag-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await createRegistrationTagAction({ name: name.trim() });
              if (!result.success) {
                setError(result.message);
                return;
              }
              onCreated(result.tag);
              setName('');
              setError('');
              setOpen(false);
            })
          }
        >
          {pending ? 'Salvando…' : 'Salvar marcador'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
