'use client';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import type { RegistrationDocumentProfile } from '../domain/registrations';
export function RegistrationDocumentProfileFields({
  profile,
  type,
}: {
  readonly profile?: RegistrationDocumentProfile | null;
  readonly type: string;
}) {
  const [dependents, setDependents] = useState([...(profile?.dependents ?? [])]);
  if (type !== 'pf') return null;
  return (
    <fieldset className="space-y-4 rounded-xl border p-4">
      <legend className="px-2 font-semibold">Perfil documental da pessoa</legend>
      <input type="hidden" name="hasDocumentProfile" value="yes" />
      <input type="hidden" name="documentDependents" value={JSON.stringify(dependents)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="document-job">Função profissional</Label>
          <Input
            id="document-job"
            name="documentJobTitle"
            maxLength={120}
            defaultValue={profile?.jobTitle ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-marital">Situação civil</Label>
          <select
            id="document-marital"
            name="documentMaritalStatus"
            defaultValue={profile?.maritalStatus ?? 'not-informed'}
            className="h-9 w-full rounded-lg border bg-background px-2"
          >
            <option value="not-informed">Não informado</option>
            <option value="single">Solteiro(a)</option>
            <option value="married">Casado(a)</option>
            <option value="stable-union">União estável</option>
            <option value="divorced">Divorciado(a)</option>
            <option value="widowed">Viúvo(a)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-military">Documentação militar</Label>
          <select
            id="document-military"
            name="documentMilitaryStatus"
            defaultValue={profile?.militaryDocumentStatus ?? 'pending-confirmation'}
            className="h-9 w-full rounded-lg border bg-background px-2"
          >
            <option value="pending-confirmation">Pendente de confirmação</option>
            <option value="applicable">Aplicável</option>
            <option value="not-applicable">Não aplicável</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="font-medium">Filhos e dependentes</p>
        <Button
          type="button"
          variant="outline"
          disabled={dependents.length >= 30}
          onClick={() =>
            setDependents((current) => [...current, { name: '', birthDate: '', relationship: '' }])
          }
        >
          Adicionar dependente
        </Button>
      </div>
      {dependents.map((dependent, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-[1fr_160px_1fr_auto]">
          <Input
            aria-label={'Nome do dependente ' + (index + 1)}
            value={dependent.name}
            minLength={2}
            maxLength={120}
            required
            onChange={(event) =>
              setDependents((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, name: event.target.value } : item,
                ),
              )
            }
          />
          <Input
            aria-label={'Nascimento do dependente ' + (index + 1)}
            type="date"
            value={dependent.birthDate}
            max={new Date().toISOString().slice(0, 10)}
            required
            onChange={(event) =>
              setDependents((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, birthDate: event.target.value } : item,
                ),
              )
            }
          />
          <Input
            aria-label={'Vínculo do dependente ' + (index + 1)}
            value={dependent.relationship ?? ''}
            maxLength={60}
            onChange={(event) =>
              setDependents((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, relationship: event.target.value } : item,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setDependents((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            Remover
          </Button>
        </div>
      ))}
    </fieldset>
  );
}
