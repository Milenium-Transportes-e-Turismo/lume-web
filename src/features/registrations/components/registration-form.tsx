'use client';
import { RegistrationDocumentProfileFields } from './registration-document-profile-fields';

import { useId, useState } from 'react';
import { RegistrationTagDialog } from './registration-tag-dialog';
import { MailPlus, PhoneCall, Plus, Trash2, Search } from 'lucide-react';

import type {
  Registration,
  RegistrationCatalog,
  RegistrationEmail,
  RegistrationPhone,
  RegistrationType,
} from '../domain';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Textarea } from '@/shared/ui/textarea';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/form-select';
import { Switch } from '@/shared/ui/switch';
import { formatCnpjInput, formatCpfInput } from '@/shared/utils/brazilian-data';
import { formatPersonName } from '@/shared/utils/person-name';

type MutablePhone = Omit<RegistrationPhone, 'id' | 'normalizedValue'>;
type MutableEmail = Omit<RegistrationEmail, 'id'>;

export interface RegistrationFormInitialValues {
  readonly type?: RegistrationType;
  readonly status?: 'active' | 'inactive';
  readonly avicExternalId?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly legalName?: string;
  readonly tradeName?: string;
  readonly cpf?: string;
  readonly cnpj?: string;
  readonly phone?: string;
  readonly phones?: readonly RegistrationPhone[];
  readonly emails?: readonly RegistrationEmail[];
  readonly roleCodes?: readonly string[];
  readonly tagCodes?: readonly string[];
}

interface RegistrationFormProps {
  readonly canManageTags?: boolean;
  readonly action: (data: FormData) => void | Promise<void>;
  readonly catalog: RegistrationCatalog;
  readonly registration?: Registration;
  readonly initialValues?: RegistrationFormInitialValues;
  readonly submitLabel?: string;
  readonly children?: React.ReactNode;
  readonly hiddenFields?: Readonly<Record<string, string | number>>;
  readonly formId?: string;
}

const phoneTypeLabels: Readonly<Record<MutablePhone['type'], string>> = {
  mobile: 'Celular',
  commercial: 'Comercial',
  residential: 'Residencial',
  other: 'Outro',
};

const emailTypeLabels: Readonly<Record<MutableEmail['type'], string>> = {
  personal: 'Pessoal',
  commercial: 'Comercial',
  financial: 'Financeiro',
  other: 'Outro',
};

function initialPhones(
  registration: Registration | undefined,
  initialValues: RegistrationFormInitialValues | undefined,
): MutablePhone[] {
  if (registration?.phones.length) {
    return registration.phones
      .filter((phone) => !phone.activeUntil)
      .map((phone) => ({
        number: phone.originalValue || phone.normalizedValue || phone.number,
        originalValue: phone.originalValue,
        type: phone.type,
        isPrimary: phone.isPrimary,
        hasWhatsApp: phone.hasWhatsApp,
        whatsappContactId: phone.whatsappContactId,
      }));
  }
  if (initialValues?.phones?.length) {
    return initialValues.phones.map((phone) => ({
      number: phone.originalValue || phone.normalizedValue || phone.number,
      originalValue: phone.originalValue,
      type: phone.type,
      isPrimary: phone.isPrimary,
      hasWhatsApp: phone.hasWhatsApp,
      whatsappContactId: phone.whatsappContactId,
    }));
  }
  return initialValues?.phone
    ? [
        {
          number: initialValues.phone,
          type: 'mobile',
          isPrimary: true,
          hasWhatsApp: true,
          whatsappContactId: null,
        },
      ]
    : [];
}

function initialEmails(
  registration: Registration | undefined,
  initialValues: RegistrationFormInitialValues | undefined,
): MutableEmail[] {
  return (
    (registration?.emails ?? initialValues?.emails)?.map((email) => ({
      address: email.address,
      type: email.type,
      isPrimary: email.isPrimary,
    })) ?? []
  );
}

function ContactPhones({
  phones,
  onChange,
  required,
}: {
  readonly phones: readonly MutablePhone[];
  readonly onChange: (phones: MutablePhone[]) => void;
  readonly required: boolean;
}) {
  return (
    <div className="space-y-3">
      <input type="hidden" name="phones" value={JSON.stringify(phones)} />
      {phones.map((phone, index) => (
        <div
          className="grid gap-2 rounded-lg border bg-muted/20 p-2 sm:grid-cols-[minmax(0,1fr)_9rem]"
          key={`phone-${index}`}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`phone-${index}`}>Número</Label>
            <Input
              id={`phone-${index}`}
              inputMode="tel"
              autoComplete="tel"
              required={required && index === 0}
              placeholder="(34) 99999-9999"
              value={phone.number}
              onChange={(event) =>
                onChange(
                  phones.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, number: event.target.value } : item,
                  ),
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={phone.type}
              onValueChange={(value) =>
                onChange(
                  phones.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, type: value as MutablePhone['type'] } : item,
                  ),
                )
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue>{phoneTypeLabels[phone.type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(phoneTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2">
            <Label className="flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg border px-2.5">
              <Switch
                checked={phone.isPrimary}
                onCheckedChange={(checked) =>
                  checked &&
                  onChange(
                    phones.map((item, itemIndex) => ({
                      ...item,
                      isPrimary: itemIndex === index,
                    })),
                  )
                }
              />
              Principal
            </Label>
            <Label className="flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg border px-2.5">
              <Switch
                checked={phone.hasWhatsApp}
                onCheckedChange={(checked) =>
                  onChange(
                    phones.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, hasWhatsApp: checked } : item,
                    ),
                  )
                }
              />
              WhatsApp
            </Label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Remover telefone ${index + 1}`}
              onClick={() => {
                const next = phones.filter((_, itemIndex) => itemIndex !== index);
                if (next.length > 0 && !next.some((item) => item.isPrimary)) {
                  next[0] = { ...next[0], isPrimary: true };
                }
                onChange(next);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...phones,
            {
              number: '',
              type: 'mobile',
              isPrimary: phones.length === 0,
              hasWhatsApp: false,
              whatsappContactId: null,
            },
          ])
        }
      >
        <PhoneCall aria-hidden="true" /> Adicionar telefone
      </Button>
    </div>
  );
}

function ContactEmails({
  emails,
  onChange,
}: {
  readonly emails: readonly MutableEmail[];
  readonly onChange: (emails: MutableEmail[]) => void;
}) {
  return (
    <div className="space-y-3">
      <input type="hidden" name="emails" value={JSON.stringify(emails)} />
      {emails.map((email, index) => (
        <div
          className="grid gap-2 rounded-lg border bg-muted/20 p-2 sm:grid-cols-[minmax(0,1fr)_9rem]"
          key={`email-${index}`}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`email-${index}`}>Endereço</Label>
            <Input
              id={`email-${index}`}
              type="email"
              autoComplete="email"
              placeholder="nome@empresa.com.br"
              value={email.address}
              onChange={(event) =>
                onChange(
                  emails.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, address: event.target.value } : item,
                  ),
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={email.type}
              onValueChange={(value) =>
                onChange(
                  emails.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, type: value as MutableEmail['type'] } : item,
                  ),
                )
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue>{emailTypeLabels[email.type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(emailTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2">
            <Label className="flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg border px-2.5">
              <Switch
                checked={email.isPrimary}
                onCheckedChange={(checked) =>
                  checked &&
                  onChange(
                    emails.map((item, itemIndex) => ({
                      ...item,
                      isPrimary: itemIndex === index,
                    })),
                  )
                }
              />
              Principal
            </Label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Remover e-mail ${index + 1}`}
              onClick={() => {
                const next = emails.filter((_, itemIndex) => itemIndex !== index);
                if (next.length > 0 && !next.some((item) => item.isPrimary)) {
                  next[0] = { ...next[0], isPrimary: true };
                }
                onChange(next);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...emails,
            {
              address: '',
              type: 'personal',
              isPrimary: emails.length === 0,
            },
          ])
        }
      >
        <MailPlus aria-hidden="true" /> Adicionar e-mail
      </Button>
    </div>
  );
}

export function RegistrationForm({
  action,
  catalog,
  canManageTags = false,
  registration,
  initialValues,
  submitLabel,
  children,
  hiddenFields,
  formId,
}: RegistrationFormProps) {
  const instanceId = useId();
  const [hasAddress, setHasAddress] = useState(Boolean(registration?.address));
  const [type, setType] = useState<RegistrationType>(
    registration?.type ?? initialValues?.type ?? 'pf',
  );
  const [status, setStatus] = useState<'active' | 'inactive'>(
    registration?.status ?? initialValues?.status ?? 'active',
  );
  const [firstName, setFirstName] = useState(() =>
    formatPersonName(
      registration?.firstName ?? initialValues?.firstName ?? registration?.individualName ?? '',
    ),
  );
  const [lastName, setLastName] = useState(() =>
    formatPersonName(registration?.lastName ?? initialValues?.lastName ?? ''),
  );
  const [cpf, setCpf] = useState(() =>
    formatCpfInput(registration?.cpf ?? initialValues?.cpf ?? ''),
  );
  const [cnpj, setCnpj] = useState(() =>
    formatCnpjInput(registration?.cnpj ?? initialValues?.cnpj ?? ''),
  );
  const [phones, setPhones] = useState<MutablePhone[]>(() =>
    initialPhones(registration, initialValues),
  );
  const [emails, setEmails] = useState<MutableEmail[]>(() =>
    initialEmails(registration, initialValues),
  );
  const [tagSearch, setTagSearch] = useState('');
  const [tags, setTags] = useState(catalog.tags);
  const [tagSearchOpen, setTagSearchOpen] = useState(false);
  const selectedRoles = new Set(
    registration?.roles.map((role) => role.code) ?? initialValues?.roleCodes ?? [],
  );
  const [selectedTags, setSelectedTags] = useState(
    () => new Set(registration?.tags.map((tag) => tag.code) ?? initialValues?.tagCodes ?? []),
  );

  return (
    <form id={formId} action={action} className="space-y-3">
      {registration ? (
        <>
          <input type="hidden" name="registrationId" value={registration.id} />
          <input type="hidden" name="expectedVersion" value={registration.version} />
        </>
      ) : null}
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="type" value={type} />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
          <CardDescription>
            O tipo define os campos da identidade. Papéis e Marcadores podem mudar sem duplicar a
            pessoa ou empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tipo de pessoa</Label>
              <Select value={type} onValueChange={(value) => setType(value as RegistrationType)}>
                <SelectTrigger className="h-9 w-full" aria-label="Tipo de pessoa">
                  <SelectValue>{type === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pf">Pessoa física</SelectItem>
                  <SelectItem value="pj">Pessoa jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${instanceId}-status`}>Situação</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as typeof status)}
                name="status"
              >
                <SelectTrigger id={`${instanceId}-status`} className="h-9 w-full">
                  <SelectValue>{status === 'active' ? 'Ativo' : 'Inativo'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${instanceId}-avic`}>Código AVIC</Label>
              <Input
                id={`${instanceId}-avic`}
                name="avicExternalId"
                defaultValue={registration?.avicExternalId ?? initialValues?.avicExternalId ?? ''}
                placeholder="Opcional"
              />
            </div>
          </div>

          {type === 'pf' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${instanceId}-first-name`}>Nome</Label>
                <Input
                  id={`${instanceId}-first-name`}
                  name="firstName"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  onBlur={() => setFirstName((value) => formatPersonName(value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${instanceId}-last-name`}>Sobrenome</Label>
                <Input
                  id={`${instanceId}-last-name`}
                  name="lastName"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  onBlur={() => setLastName((value) => formatPersonName(value))}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`${instanceId}-cpf`}>CPF</Label>
                <Input
                  id={`${instanceId}-cpf`}
                  name="cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cpf}
                  onChange={(event) => setCpf(formatCpfInput(event.target.value))}
                  placeholder="Opcional"
                />
                <p className="text-xs text-muted-foreground">
                  O CPF é opcional para Pessoa Física, mas, quando informado, deve ser válido.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${instanceId}-legal-name`}>Razão social</Label>
                <Input
                  id={`${instanceId}-legal-name`}
                  name="legalName"
                  required
                  autoComplete="organization"
                  defaultValue={registration?.legalName ?? initialValues?.legalName ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${instanceId}-trade-name`}>Nome fantasia</Label>
                <Input
                  id={`${instanceId}-trade-name`}
                  name="tradeName"
                  defaultValue={registration?.tradeName ?? initialValues?.tradeName ?? ''}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`${instanceId}-cnpj`}>CNPJ</Label>
                <Input
                  id={`${instanceId}-cnpj`}
                  name="cnpj"
                  required
                  inputMode="text"
                  autoComplete="off"
                  value={cnpj}
                  onChange={(event) => setCnpj(formatCnpjInput(event.target.value))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Papéis e Marcadores</CardTitle>
          <CardDescription>
            Papéis definem como o registro participa da operação. Marcadores ajudam a organizar e
            pesquisar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Papéis</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {catalog.roles
                .filter((role) => role.active !== false)
                .map((role) => (
                  <Label
                    key={role.id}
                    className="flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <Checkbox
                      name="roleCodes"
                      value={role.code}
                      defaultChecked={selectedRoles.has(role.code)}
                    />
                    {role.name}
                  </Label>
                ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="w-full">
              <span className="flex min-h-8 items-center justify-between gap-3">
                <span className="text-sm font-medium">Marcadores</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="size-8 shrink-0 p-0"
                    aria-label="Pesquisar Marcadores"
                    title="Pesquisar marcadores"
                    aria-expanded={tagSearchOpen}
                    onClick={() => {
                      setTagSearchOpen(!tagSearchOpen);
                      setTagSearch('');
                    }}
                  >
                    <Search aria-hidden="true" />
                  </Button>
                  {canManageTags ? (
                    <RegistrationTagDialog
                      onCreated={(tag) => {
                        setTags((current) =>
                          current.some((entry) => entry.id === tag.id)
                            ? current
                            : [...current, tag],
                        );
                        setSelectedTags((current) => new Set([...current, tag.code]));
                      }}
                    />
                  ) : null}
                </span>
              </span>
            </legend>
            {[...selectedTags].map((code) => (
              <input key={code} type="hidden" name="tagCodes" value={code} />
            ))}
            {tagSearchOpen ? (
              <Input
                autoFocus
                type="search"
                value={tagSearch}
                onChange={(event) => setTagSearch(event.target.value)}
                aria-label="Pesquisar Marcadores"
                placeholder="Pesquisar Marcadores"
                className="max-w-md"
              />
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {tags
                .filter(
                  (tag) =>
                    tag.active !== false &&
                    tag.name
                      .toLocaleLowerCase('pt-BR')
                      .includes(tagSearch.trim().toLocaleLowerCase('pt-BR')),
                )
                .map((tag) => (
                  <Label
                    key={tag.id}
                    className="flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <Checkbox
                      value={tag.code}
                      checked={selectedTags.has(tag.code)}
                      onCheckedChange={(checked) =>
                        setSelectedTags((current) => {
                          const next = new Set(current);
                          if (checked) next.add(tag.code);
                          else next.delete(tag.code);
                          return next;
                        })
                      }
                    />
                    {tag.name}
                  </Label>
                ))}
            </div>
            {tags.filter(
              (tag) =>
                tag.active !== false &&
                tag.name
                  .toLocaleLowerCase('pt-BR')
                  .includes(tagSearch.trim().toLocaleLowerCase('pt-BR')),
            ).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum Marcador encontrado para esta pesquisa.
              </p>
            ) : null}
          </fieldset>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Contatos</CardTitle>
          <CardDescription>
            Cadastre vários telefones e e-mails, indicando o principal e quais números usam
            WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="space-y-2" aria-labelledby={`${instanceId}-phones-title`}>
            <div className="flex items-center justify-between gap-3">
              <h3 id={`${instanceId}-phones-title`} className="text-sm font-medium">
                Telefones {type === 'pf' ? '(pelo menos um)' : ''}
              </h3>
              {phones.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPhones([
                      {
                        number: '',
                        type: 'mobile',
                        isPrimary: true,
                        hasWhatsApp: false,
                        whatsappContactId: null,
                      },
                    ])
                  }
                >
                  <Plus aria-hidden="true" /> Incluir primeiro telefone
                </Button>
              ) : null}
            </div>
            <ContactPhones phones={phones} onChange={setPhones} required={type === 'pf'} />
          </section>
          <section className="space-y-2" aria-labelledby={`${instanceId}-emails-title`}>
            <h3 id={`${instanceId}-emails-title`} className="text-sm font-medium">
              E-mails
            </h3>
            <ContactEmails emails={emails} onChange={setEmails} />
          </section>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
          <CardDescription>Endereço da pessoa ou empresa, reutilizado na operação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="flex items-center gap-2">
            <Checkbox checked={hasAddress} onCheckedChange={setHasAddress} />
            Informar endereço
          </Label>
          <input type="hidden" name="hasAddress" value={hasAddress ? 'yes' : 'no'} />
          {hasAddress ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['Street', 'Logradouro', 'street', 160],
                  ['Number', 'Número', 'number', 30],
                  ['Complement', 'Complemento', 'complement', 120],
                  ['District', 'Bairro', 'district', 120],
                  ['PostalCode', 'CEP', 'postalCode', 10],
                  ['City', 'Cidade', 'city', 120],
                  ['State', 'UF', 'state', 2],
                ] as const
              ).map(([suffix, label, key, maxLength]) => (
                <div className="space-y-1.5" key={key}>
                  <Label htmlFor={instanceId + '-address-' + key}>{label}</Label>
                  <Input
                    id={instanceId + '-address-' + key}
                    name={'address' + suffix}
                    defaultValue={registration?.address?.[key] ?? ''}
                    maxLength={maxLength}
                    required={key !== 'complement'}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Instruções para atendimento</CardTitle>
          <CardDescription>
            Preferências específicas desta pessoa ou empresa. Os agentes as consideram quando a
            identidade é confirmada no atendimento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor={instanceId + '-service-instructions'}>Como atender este cadastro</Label>
          <Textarea
            id={instanceId + '-service-instructions'}
            name="serviceInstructions"
            defaultValue={registration?.serviceInstructions ?? ''}
            maxLength={4000}
            placeholder="Ex.: usar linguagem objetiva e confirmar o local de embarque antes de concluir."
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            Estas instruções complementam as regras existentes e não alteram permissões ou
            segurança. Não inclua senhas ou chaves.
          </p>
        </CardContent>
      </Card>

      <RegistrationDocumentProfileFields profile={registration?.documentProfile} type={type} />
      {children ?? (
        <div className="flex justify-end">
          <Button type="submit">
            {submitLabel ?? (registration ? 'Salvar alterações' : 'Criar Cadastro')}
          </Button>
        </div>
      )}
    </form>
  );
}
