'use client';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createDocumentRequestAction } from '@/features/document-management/actions/document-management-actions';
import type { DocumentChecklistSummary } from '@/features/document-management/domain';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Solicitando…' : 'Solicitar documentos'}
    </Button>
  );
}
export function RegistrationDocumentRequestForm({
  registrationId,
  checklists,
}: {
  readonly registrationId: string;
  readonly checklists: readonly DocumentChecklistSummary[];
}) {
  const [selected, setSelected] = useState('');
  const checklist = checklists.find((item) => item.id === selected);
  return (
    <form action={createDocumentRequestAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="subjectRegistrationId" value={registrationId} />
      <input type="hidden" name="context" value={checklist?.context ?? ''} />
      <div className="min-w-52 flex-1 space-y-2">
        <Label htmlFor="registration-checklist">Lista de documentos</Label>
        <select
          id="registration-checklist"
          name="checklistId"
          required
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="h-9 w-full rounded-lg border bg-background px-2"
        >
          <option value="" disabled>
            Selecione a lista
          </option>
          {checklists.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="registration-deadline">Prazo</Label>
        <Input id="registration-deadline" name="deadline" type="date" />
      </div>
      <Submit />
    </form>
  );
}
