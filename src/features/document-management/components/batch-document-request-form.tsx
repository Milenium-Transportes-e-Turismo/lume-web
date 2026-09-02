'use client';

import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { createBatchDocumentRequestsAction } from '@/features/document-management/actions';
import {
  DOCUMENT_CONTEXT_LABELS,
  type DocumentTypeSummary,
} from '@/features/document-management/domain';
import type { TenantUser } from '@/features/tenant-administration/domain';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

function userLabel(user: TenantUser): string {
  return `${user.name} · ${user.username} · ${user.email}`;
}

export function BatchDocumentRequestForm({
  users,
  documentTypes,
}: {
  readonly users: readonly TenantUser[];
  readonly documentTypes: readonly DocumentTypeSummary[];
}) {
  const availableUsers = useMemo(
    () => users.filter((user) => user.isActive).toSorted((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  const availableDocumentTypes = useMemo(
    () =>
      documentTypes.filter((item) => item.active).toSorted((a, b) => a.name.localeCompare(b.name)),
    [documentTypes],
  );
  const [candidateUserId, setCandidateUserId] = useState('');
  const [candidateUserLabel, setCandidateUserLabel] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDocumentTypeIds, setSelectedDocumentTypeIds] = useState<string[]>([]);

  const selectedUsers = selectedUserIds.flatMap((id) => {
    const user = availableUsers.find((candidate) => candidate.id === id);
    return user ? [user] : [];
  });
  const candidateOptions = availableUsers
    .filter((user) => !selectedUserIds.includes(user.id))
    .map((user) => ({ value: user.id, label: userLabel(user) }));
  const allDocumentsSelected =
    availableDocumentTypes.length > 0 &&
    selectedDocumentTypeIds.length === availableDocumentTypes.length;
  const partiallySelected = selectedDocumentTypeIds.length > 0 && !allDocumentsSelected;

  function addUser() {
    if (!candidateUserId || selectedUserIds.includes(candidateUserId)) return;
    setSelectedUserIds((current) => [...current, candidateUserId]);
    setCandidateUserId('');
    setCandidateUserLabel('');
  }

  function toggleDocument(documentTypeId: string, checked: boolean) {
    setSelectedDocumentTypeIds((current) =>
      checked
        ? [...new Set([...current, documentTypeId])]
        : current.filter((id) => id !== documentTypeId),
    );
  }

  return (
    <form action={createBatchDocumentRequestsAction} className="space-y-6">
      {selectedUserIds.map((id) => (
        <input key={id} type="hidden" name="subjectUserIds" value={id} />
      ))}
      {selectedDocumentTypeIds.map((id) => (
        <input key={id} type="hidden" name="documentTypeIds" value={id} />
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium" htmlFor="batch-document-context">
          <span>Contexto</span>
          <Select name="context" defaultValue="admission" required>
            <SelectTrigger id="batch-document-context" className="h-9 w-full">
              <SelectValue>
                {(value: string | null) =>
                  DOCUMENT_CONTEXT_LABELS[value as keyof typeof DOCUMENT_CONTEXT_LABELS] ||
                  'Selecione o contexto'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DOCUMENT_CONTEXT_LABELS).map(([context, label]) => (
                <SelectItem key={context} value={context}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Prazo</span>
          <Input name="deadline" type="datetime-local" />
        </label>
      </div>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 font-semibold">Usuários que receberão a solicitação</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Input
              list="batch-document-request-users"
              aria-label="Usuário a adicionar"
              placeholder="Pesquise por nome, usuário ou e-mail"
              value={candidateUserLabel}
              onChange={(event) => {
                const label = event.target.value;
                setCandidateUserLabel(label);
                setCandidateUserId(
                  candidateOptions.find((option) => option.label === label)?.value ?? '',
                );
              }}
              autoComplete="off"
            />
            <datalist id="batch-document-request-users">
              {candidateOptions.map((option) => (
                <option key={option.value} value={option.label} />
              ))}
            </datalist>
          </div>
          <Button type="button" variant="outline" onClick={addUser} disabled={!candidateUserId}>
            <Plus /> Adicionar usuário
          </Button>
        </div>
        {selectedUsers.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {selectedUsers.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{userLabel(user)}</span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remover ${user.name}`}
                  onClick={() =>
                    setSelectedUserIds((current) => current.filter((id) => id !== user.id))
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Adicione um ou mais usuários.</p>
        )}
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 font-semibold">Documentos solicitados</legend>
        <label className="flex items-center gap-3 border-b pb-3 text-sm font-medium">
          <Checkbox
            checked={allDocumentsSelected}
            indeterminate={partiallySelected}
            aria-label="Selecionar todos os documentos"
            onCheckedChange={(checked) =>
              setSelectedDocumentTypeIds(
                checked ? availableDocumentTypes.map((item) => item.id) : [],
              )
            }
          />
          Selecionar todos
        </label>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {availableDocumentTypes.map((documentType) => {
            const checked = selectedDocumentTypeIds.includes(documentType.id);
            return (
              <label
                key={documentType.id}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <Checkbox
                  checked={checked}
                  aria-label={documentType.name}
                  onCheckedChange={(nextChecked) => toggleDocument(documentType.id, nextChecked)}
                />
                <span>{documentType.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Documentos de cônjuge, filhos, vacinação, escola e situação militar só serão incluídos para
        quem tiver perfil compatível. Cada usuário receberá uma solicitação própria; documentos de
        filhos aceitam vários arquivos no mesmo item e mantêm a identificação de cada dependente.
      </p>

      <label className="block space-y-1 text-sm font-medium">
        <span>Observações</span>
        <Textarea name="notes" maxLength={2000} />
      </label>

      <div className="flex justify-stretch sm:justify-end">
        <Button
          type="submit"
          disabled={selectedUserIds.length === 0 || selectedDocumentTypeIds.length === 0}
        >
          {selectedUserIds.length === 1
            ? 'Criar solicitação'
            : `Criar ${selectedUserIds.length || ''} solicitações`}
        </Button>
      </div>
    </form>
  );
}
