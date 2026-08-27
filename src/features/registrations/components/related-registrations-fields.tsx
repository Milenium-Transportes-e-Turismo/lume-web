'use client';

import { useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';

import type { RegistrationCatalog, RegistrationType } from '../domain';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';

export interface RelatedRegistrationInitialValue {
  readonly localId: string;
  readonly type: RegistrationType;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly legalName?: string;
  readonly tradeName?: string;
  readonly cpf?: string;
  readonly cnpj?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly roleCodes?: readonly string[];
  readonly tagCodes?: readonly string[];
  readonly relationshipType?: string;
  readonly relationshipDirection?: 'primary-to-related' | 'related-to-primary';
  readonly jobTitle?: string;
  readonly department?: string;
  readonly isPrimary?: boolean;
  readonly notes?: string;
}

interface RelatedDraft {
  localId: string;
  type: RegistrationType;
  firstName: string;
  lastName: string;
  legalName: string;
  tradeName: string;
  cpf: string;
  cnpj: string;
  phone: string;
  email: string;
  roleCodes: string[];
  tagCodes: string[];
  relationshipType: string;
  relationshipDirection: 'primary-to-related' | 'related-to-primary';
  jobTitle: string;
  department: string;
  isPrimary: boolean;
  notes: string;
}

function draft(initial?: RelatedRegistrationInitialValue): RelatedDraft {
  return {
    localId: initial?.localId ?? crypto.randomUUID(),
    type: initial?.type ?? 'pf',
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    legalName: initial?.legalName ?? '',
    tradeName: initial?.tradeName ?? '',
    cpf: initial?.cpf ?? '',
    cnpj: initial?.cnpj ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    roleCodes: [...(initial?.roleCodes ?? [])],
    tagCodes: [...(initial?.tagCodes ?? [])],
    relationshipType: initial?.relationshipType ?? 'relacionado a',
    relationshipDirection: initial?.relationshipDirection ?? 'related-to-primary',
    jobTitle: initial?.jobTitle ?? '',
    department: initial?.department ?? '',
    isPrimary: initial?.isPrimary ?? false,
    notes: initial?.notes ?? '',
  };
}

function toggle(values: readonly string[], value: string, checked: boolean): string[] {
  return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}

function serializedValue(values: readonly RelatedDraft[]) {
  return values.map((value) => ({
    localId: value.localId,
    registration: {
      type: value.type,
      status: 'active',
      firstName: value.type === 'pf' ? value.firstName : null,
      lastName: value.type === 'pf' ? value.lastName : null,
      legalName: value.type === 'pj' ? value.legalName : null,
      tradeName: value.type === 'pj' ? value.tradeName || null : null,
      cpf: value.type === 'pf' ? value.cpf || null : null,
      cnpj: value.type === 'pj' ? value.cnpj || null : null,
      roleCodes: value.roleCodes,
      tagCodes: value.tagCodes,
      phones: value.phone
        ? [
            {
              number: value.phone,
              type: 'mobile',
              isPrimary: true,
              hasWhatsApp: true,
            },
          ]
        : [],
      emails: value.email ? [{ address: value.email, type: 'commercial', isPrimary: true }] : [],
    },
    relationship: {
      sourceLocalId:
        value.relationshipDirection === 'primary-to-related' ? 'primary' : value.localId,
      targetLocalId:
        value.relationshipDirection === 'primary-to-related' ? value.localId : 'primary',
      type: value.relationshipType,
      jobTitle: value.jobTitle || null,
      department: value.department || null,
      isPrimary: value.isPrimary,
      notes: value.notes || null,
    },
  }));
}

export function RelatedRegistrationsFields({
  catalog,
  initialValues = [],
}: {
  readonly catalog: RegistrationCatalog;
  readonly initialValues?: readonly RelatedRegistrationInitialValue[];
}) {
  const [values, setValues] = useState<RelatedDraft[]>(() => initialValues.map(draft));

  function update(index: number, change: Partial<RelatedDraft>) {
    setValues((current) =>
      current.map((value, valueIndex) => (valueIndex === index ? { ...value, ...change } : value)),
    );
  }

  return (
    <Card>
      <input
        type="hidden"
        name="relatedRegistrationGraph"
        value={JSON.stringify(serializedValue(values))}
      />
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Identidades e relacionamentos adicionais</CardTitle>
            <CardDescription>
              Crie PF, PJ e seus vínculos na mesma decisão. Toda a estrutura será promovida em uma
              única transação.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setValues((items) => [...items, draft()])}
          >
            <Plus aria-hidden="true" /> Adicionar identidade
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {values.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Use esta seção somente quando a mesma revisão precisar criar outra pessoa ou organização
            e relacioná-la à identidade principal.
          </p>
        ) : null}
        {values.map((value, index) => (
          <section className="space-y-4 rounded-xl border p-4" key={value.localId}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-medium">
                <Link2 aria-hidden="true" className="size-4" /> Identidade relacionada {index + 1}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover identidade relacionada ${index + 1}`}
                onClick={() =>
                  setValues((items) => items.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={value.type}
                  onValueChange={(type) => update(index, { type: type as RegistrationType })}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={`Tipo da identidade relacionada ${index + 1}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pf">Pessoa física</SelectItem>
                    <SelectItem value="pj">Pessoa jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`related-phone-${value.localId}`}>Telefone</Label>
                <Input
                  id={`related-phone-${value.localId}`}
                  inputMode="tel"
                  required={value.type === 'pf'}
                  value={value.phone}
                  onChange={(event) => update(index, { phone: event.target.value })}
                />
              </div>
              {value.type === 'pf' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor={`related-first-name-${value.localId}`}>Nome</Label>
                    <Input
                      id={`related-first-name-${value.localId}`}
                      required
                      value={value.firstName}
                      onChange={(event) => update(index, { firstName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`related-last-name-${value.localId}`}>Sobrenome</Label>
                    <Input
                      id={`related-last-name-${value.localId}`}
                      value={value.lastName}
                      onChange={(event) => update(index, { lastName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor={`related-cpf-${value.localId}`}>CPF</Label>
                    <Input
                      id={`related-cpf-${value.localId}`}
                      inputMode="numeric"
                      value={value.cpf}
                      onChange={(event) => update(index, { cpf: event.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor={`related-legal-name-${value.localId}`}>Razão social</Label>
                    <Input
                      id={`related-legal-name-${value.localId}`}
                      required
                      value={value.legalName}
                      onChange={(event) => update(index, { legalName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`related-trade-name-${value.localId}`}>Nome fantasia</Label>
                    <Input
                      id={`related-trade-name-${value.localId}`}
                      value={value.tradeName}
                      onChange={(event) => update(index, { tradeName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor={`related-cnpj-${value.localId}`}>CNPJ</Label>
                    <Input
                      id={`related-cnpj-${value.localId}`}
                      required
                      inputMode="numeric"
                      value={value.cnpj}
                      onChange={(event) => update(index, { cnpj: event.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`related-email-${value.localId}`}>E-mail</Label>
                <Input
                  id={`related-email-${value.localId}`}
                  type="email"
                  value={value.email}
                  onChange={(event) => update(index, { email: event.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.roles
                .filter((role) => role.active !== false)
                .map((role) => (
                  <Label
                    key={role.id}
                    className="flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    <Checkbox
                      checked={value.roleCodes.includes(role.code)}
                      onCheckedChange={(checked) =>
                        update(index, {
                          roleCodes: toggle(value.roleCodes, role.code, checked === true),
                        })
                      }
                    />
                    {role.name}
                  </Label>
                ))}
            </div>

            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Marcadores da identidade relacionada
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.tags
                  .filter((tag) => tag.active !== false)
                  .map((tag) => (
                    <Label
                      key={tag.id}
                      className="flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      <Checkbox
                        checked={value.tagCodes.includes(tag.code)}
                        onCheckedChange={(checked) =>
                          update(index, {
                            tagCodes: toggle(value.tagCodes, tag.code, checked === true),
                          })
                        }
                      />
                      {tag.name}
                    </Label>
                  ))}
              </div>
            </details>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Direção do relacionamento</Label>
                <Select
                  value={value.relationshipDirection}
                  onValueChange={(direction) =>
                    update(index, {
                      relationshipDirection: direction as RelatedDraft['relationshipDirection'],
                    })
                  }
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={`Direção do relacionamento da identidade ${index + 1}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="related-to-primary">Adicional → principal</SelectItem>
                    <SelectItem value="primary-to-related">Principal → adicional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`related-type-${value.localId}`}>Tipo de relacionamento</Label>
                <Input
                  id={`related-type-${value.localId}`}
                  required
                  value={value.relationshipType}
                  onChange={(event) => update(index, { relationshipType: event.target.value })}
                  placeholder="Ex.: representante de"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`related-job-${value.localId}`}>Cargo</Label>
                <Input
                  id={`related-job-${value.localId}`}
                  value={value.jobTitle}
                  onChange={(event) => update(index, { jobTitle: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`related-department-${value.localId}`}>Departamento/setor</Label>
                <Input
                  id={`related-department-${value.localId}`}
                  value={value.department}
                  onChange={(event) => update(index, { department: event.target.value })}
                />
              </div>
              <Label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 md:col-span-2">
                <Switch
                  checked={value.isPrimary}
                  onCheckedChange={(checked) => update(index, { isPrimary: checked })}
                />
                É o contato principal neste relacionamento
              </Label>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`related-notes-${value.localId}`}>Observações</Label>
                <Textarea
                  id={`related-notes-${value.localId}`}
                  value={value.notes}
                  onChange={(event) => update(index, { notes: event.target.value })}
                  maxLength={1000}
                />
              </div>
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
