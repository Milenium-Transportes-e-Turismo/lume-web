'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import type { RoutingCompany, RoutingPhone } from '@/features/routing/domain/routing';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

type ClientFormProps = {
  readonly action: (data: FormData) => void | Promise<void>;
  readonly client?: RoutingCompany;
  readonly initialValues?: { readonly name?: string; readonly phone?: string };
};

function PhoneList({ name, initial }: { name: string; initial: readonly RoutingPhone[] }) {
  const [items, setItems] = useState(() => initial.map((item) => ({ ...item })));
  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      {items.map((item, index) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" key={`${name}-${index}`}>
          <Input
            aria-label={`Telefone adicional ${index + 1}`}
            placeholder="(34) 99999-9999"
            value={item.number}
            onChange={(event) =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, number: event.target.value } : entry,
                ),
              )
            }
          />
          <Input
            aria-label={`Descrição do telefone ${index + 1}`}
            placeholder="Ex.: Financeiro"
            value={item.description ?? ''}
            onChange={(event) =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, description: event.target.value } : entry,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Remover telefone"
            onClick={() =>
              setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setItems((current) => [...current, { number: '', description: '' }])}
      >
        <Plus aria-hidden="true" /> Adicionar telefone
      </Button>
    </div>
  );
}

export function ClientForm({ action, client, initialValues }: ClientFormProps) {
  const hasInitialIndividualValues = Boolean(initialValues?.name || initialValues?.phone);
  const [clientType, setClientType] = useState<'pf' | 'pj'>(
    client?.clientType ?? (hasInitialIndividualValues ? 'pf' : 'pj'),
  );
  return (
    <form action={action} className="space-y-6">
      {client ? (
        <>
          <input type="hidden" name="clientId" value={client.id} />
          <input type="hidden" name="expectedVersion" value={client.version} />
        </>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="clientType">Tipo de cliente</Label>
            <select
              id="clientType"
              name="clientType"
              value={clientType}
              onChange={(event) => setClientType(event.target.value as 'pf' | 'pj')}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="pf">Pessoa física</option>
              <option value="pj">Pessoa jurídica</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Situação</Label>
            <select
              id="status"
              name="status"
              defaultValue={client?.status ?? 'active'}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="avicExternalId">Código AVIC</Label>
            <Input
              id="avicExternalId"
              name="avicExternalId"
              defaultValue={client?.avicExternalId ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={clientType === 'pf' ? 'border-primary' : ''}>
        <CardHeader>
          <CardTitle>Pessoa física</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="individualName">Nome</Label>
            <Input
              id="individualName"
              name="individualName"
              defaultValue={client?.individualName ?? initialValues?.name ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" name="cpf" inputMode="numeric" defaultValue={client?.cpf ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="individualEmail">E-mail</Label>
            <Input
              id="individualEmail"
              name="individualEmail"
              type={clientType === 'pf' ? 'email' : 'text'}
              defaultValue={client?.individualEmail ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="individualWhatsapp">
              WhatsApp {clientType === 'pf' ? '(obrigatório)' : ''}
            </Label>
            <Input
              id="individualWhatsapp"
              name="individualWhatsapp"
              required={clientType === 'pf'}
              defaultValue={client?.individualWhatsapp ?? initialValues?.phone ?? ''}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Telefones adicionais</Label>
            <PhoneList name="individualPhones" initial={client?.individualPhones ?? []} />
          </div>
        </CardContent>
      </Card>

      <Card className={clientType === 'pj' ? 'border-primary' : ''}>
        <CardHeader>
          <CardTitle>Pessoa jurídica</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legalName">
              Razão social {clientType === 'pj' ? '(obrigatória)' : ''}
            </Label>
            <Input
              id="legalName"
              name="legalName"
              required={clientType === 'pj'}
              defaultValue={client?.legalName ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tradeName">Nome fantasia</Label>
            <Input id="tradeName" name="tradeName" defaultValue={client?.tradeName ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ {clientType === 'pj' ? '(obrigatório)' : ''}</Label>
            <Input
              id="cnpj"
              name="cnpj"
              required={clientType === 'pj'}
              inputMode="numeric"
              defaultValue={client?.cnpj ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalEmail">E-mail</Label>
            <Input
              id="legalEmail"
              name="legalEmail"
              type={clientType === 'pj' ? 'email' : 'text'}
              defaultValue={client?.legalEmail ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalWhatsapp">WhatsApp</Label>
            <Input
              id="legalWhatsapp"
              name="legalWhatsapp"
              defaultValue={client?.legalWhatsapp ?? ''}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Telefones adicionais</Label>
            <PhoneList name="legalPhones" initial={client?.legalPhones ?? []} />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit">{client ? 'Salvar alterações' : 'Cadastrar cliente'}</Button>
      </div>
    </form>
  );
}
