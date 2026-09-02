'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  LoaderCircle,
  CircleHelp,
  PauseCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react';
import {
  Controller,
  useController,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
} from 'react-hook-form';

import {
  createTenantUserFormAction,
  deleteTenantUserAction,
  requestTenantUserPasswordResetAction,
  updateTenantUserStatusAction,
} from '@/features/tenant-administration/actions';
import {
  TENANT_DEPARTMENTS,
  TENANT_DEPARTMENT_LABELS,
  getTenantDepartmentLabel,
  type PermissionCatalog,
  type TenantUser,
  type TenantUserList,
  type TenantUserStatus,
} from '@/features/tenant-administration/domain';
import {
  getPermissionActionLabel,
  getPermissionCodeLabel,
  getPermissionResourceLabel,
} from '@/features/tenant-administration/permissions/permission-labels';
import { Button } from '@/shared/ui/button';
import { formatActionResultDescription } from '@/shared/lib/action-result-feedback';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Textarea } from '@/shared/ui/textarea';
import { toast } from '@/shared/ui/toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';

import {
  compatiblePermissionCodes,
  groupPermissionsByResource,
  permissionResource,
} from './permission-assignment';
import { userFormSchema, type UserFormValues } from './user-form-schema';

const STATUS_LABELS: Readonly<Record<TenantUserStatus, string>> = {
  active: 'Ativo',
  inactive: 'Desativado',
  suspended: 'Suspenso',
};

const STATUS_CLASSES: Readonly<Record<TenantUserStatus, string>> = {
  active: 'bg-success/10 text-success-emphasis',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-warning/10 text-warning-emphasis',
};

const STATUS_FILTER_LABELS: Readonly<Record<string, string>> = {
  __all__: 'Todos',
  active: 'Ativos',
  inactive: 'Desativados',
  suspended: 'Suspensos',
};

const SUSPENSION_MODE_LABELS = {
  days: 'Quantidade de dias',
  date: 'Até uma data',
} as const;

const GENERAL_DOCUMENTS = [
  'Foto 3x4 digital',
  'CPF',
  'RG',
  'CTPS',
  'CNH',
  'Comprovante de residência com CEP',
  'Cartão do PIS',
  'Título de eleitor',
  'Certidão criminal estadual',
  'Certidão criminal civil/federal',
] as const;

const USER_CLASSIFICATION_LABELS = {
  Administrativo: 'Administrativo',
  Geral: 'Geral',
  Motorista: 'Motorista',
} as const;

const MARITAL_STATUS_LABELS = {
  'not-informed': 'Não informado',
  single: 'Solteiro(a)',
  married: 'Casado(a)',
  'stable-union': 'União estável',
  divorced: 'Divorciado(a)',
  widowed: 'Viúvo(a)',
} as const;

const MILITARY_STATUS_LABELS = {
  'pending-confirmation': 'Pendente de confirmação',
  applicable: 'Aplicável',
  'not-applicable': 'Não aplicável',
} as const;

function documentPreview(values: UserFormValues): string[] {
  const result: string[] = [...GENERAL_DOCUMENTS];
  if (['married', 'stable-union'].includes(values.maritalStatus ?? '')) {
    result.push('Certidão de casamento/união estável', 'RG e CPF do(a) cônjuge');
  }
  const dependents = values.dependents ?? [];
  if (dependents.length > 0) result.push('Certidão de nascimento de cada dependente');
  const ages = dependents.map((dependent) => {
    const birth = new Date(`${dependent.birthDate}T00:00:00`);
    return Math.floor((Date.now() - birth.getTime()) / 31_556_952_000);
  });
  if (ages.some((age) => age >= 0 && age < 7))
    result.push('Carteira de vacinação dos dependentes menores de 7 anos');
  if (ages.some((age) => age > 7 && age <= 16)) {
    result.push('Atestado escolar dos dependentes acima de 7 anos até 16 anos');
  }
  if (values.militaryDocumentStatus === 'applicable') result.push('Documento militar');
  if (values.militaryDocumentStatus === 'pending-confirmation') {
    result.push('Pendência do DP: confirmar documentação militar');
  }
  if (values.jobTitle === 'Motorista') {
    result.push(
      'CNH com categoria D, EAR e validade (sem duplicar a CNH)',
      'Curso de Transporte Coletivo de Passageiros',
      'Prontuário de habilitação — nada consta',
      'Certidão negativa de débitos municipais',
      'Cartão de vacina atualizado',
    );
  }
  return result;
}

type SuspensionMode = keyof typeof SUSPENSION_MODE_LABELS;

export interface UserListFilters {
  readonly search?: string;
  readonly department?: string;
  readonly permission?: string;
  readonly status?: TenantUserStatus;
}

function AssignmentCheckboxes({
  control,
  name,
  values,
  labels,
  disabled = false,
}: {
  readonly control: Control<UserFormValues>;
  readonly name: 'departments' | 'permissionCodes';
  readonly values: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly disabled?: boolean;
}) {
  const { field } = useController({ control, name });

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {values.map((value) => {
        const id = `${name}-${value}`;
        return (
          <Field
            key={value}
            orientation="horizontal"
            className="rounded-lg border border-border p-3"
          >
            <Checkbox
              id={id}
              disabled={disabled}
              checked={field.value.includes(value)}
              onCheckedChange={(checked) =>
                field.onChange(
                  checked
                    ? [...field.value, value]
                    : field.value.filter((candidate) => candidate !== value),
                )
              }
            />
            <FieldLabel htmlFor={id}>{labels[value] ?? 'Opção de departamento'}</FieldLabel>
          </Field>
        );
      })}
    </div>
  );
}

function PermissionFields({
  control,
  permissions,
  disabled = false,
}: {
  readonly control: Control<UserFormValues>;
  readonly permissions: readonly string[];
  readonly disabled?: boolean;
}) {
  const { field } = useController({ control, name: 'permissionCodes' });
  const groups = groupPermissionsByResource(permissions);

  if (permissions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        Selecione um departamento para consultar as permissões compatíveis.
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {[...groups].map(([resource, codes]) => {
        const resourceLabel = getPermissionResourceLabel(resource);
        const selectedCount = codes.filter((code) => field.value.includes(code)).length;
        const allSelected = selectedCount === codes.length;
        const partiallySelected = selectedCount > 0 && !allSelected;
        const selectAllId = `permission-${resource}-all`;

        return (
          <section key={resource} className="rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary-emphasis" />
              <h3 className="font-semibold">{resourceLabel}</h3>
            </div>
            <Field orientation="horizontal" className="mb-3 border-b pb-3">
              <Checkbox
                id={selectAllId}
                checked={allSelected}
                indeterminate={partiallySelected}
                disabled={disabled}
                aria-label={`Selecionar todas em ${resourceLabel}`}
                onCheckedChange={(checked) => {
                  const next = new Set(field.value);
                  codes.forEach((code) => {
                    if (checked) next.add(code);
                    else next.delete(code);
                  });
                  field.onChange([...next]);
                }}
              />
              <FieldLabel htmlFor={selectAllId}>Selecionar todas</FieldLabel>
            </Field>
            <div className="space-y-2">
              {codes.map((code) => {
                const action = code.slice(permissionResource(code).length + 1);
                const id = `permission-${code}`;
                return (
                  <Field key={code} orientation="horizontal">
                    <Checkbox
                      id={id}
                      disabled={disabled}
                      checked={field.value.includes(code)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked
                            ? [...field.value, code]
                            : field.value.filter((candidate) => candidate !== code),
                        )
                      }
                    />
                    <FieldLabel htmlFor={id}>{getPermissionCodeLabel(resource, action)}</FieldLabel>
                  </Field>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CreateUserDialog({
  permissionCatalog,
}: {
  readonly permissionCatalog: PermissionCatalog;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isPending, startTransition] = useTransition();
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      isAdministrator: false,
      documentAccessMode: 'standard',
      clientCategory: null,
      routingCompanyId: null,
      requestDocuments: false,
      departments: [],
      permissionCodes: [],
      jobTitle: 'Geral',
      maritalStatus: 'not-informed',
      militaryDocumentStatus: 'pending-confirmation',
      dependents: [],
    },
  });
  const dependents = useFieldArray({ control: form.control, name: 'dependents' });
  const departments = useWatch({ control: form.control, name: 'departments' });
  useWatch({
    control: form.control,
    name: ['jobTitle', 'maritalStatus', 'militaryDocumentStatus', 'dependents'],
  });
  const preview = documentPreview(form.getValues());
  const standardPermissions = useMemo(
    () => compatiblePermissionCodes(permissionCatalog, departments),
    [departments, permissionCatalog],
  );

  const reset = () => {
    form.reset();
    setStep(1);
  };

  const next = async () => {
    if (step === 1) {
      const valid = await form.trigger([
        'name',
        'username',
        'email',
        'password',
        'requestDocuments',
        'jobTitle',
        'maritalStatus',
        'militaryDocumentStatus',
        'dependents',
      ]);
      if (valid) setStep(2);
      return;
    }

    const valid = await form.trigger(['departments']);
    if (!valid) return;
    const allowed = new Set(standardPermissions);
    form.setValue(
      'permissionCodes',
      form.getValues('permissionCodes').filter((permission) => allowed.has(permission)),
    );
    setStep(3);
  };

  const createUser = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createTenantUserFormAction(values);
      toast.add({
        title: result.success ? 'Usuário cadastrado' : 'Cadastro não concluído',
        description: formatActionResultDescription(result),
        type: result.success ? 'success' : 'error',
      });
      if (result.success) {
        reset();
        setOpen(false);
      }
    });
  });

  const stepLabels = ['Dados básicos', 'Departamentos', 'Permissões'];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger render={<Button size="lg" />}>
        <Plus />
        Novo usuário
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[96dvh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Cadastrar usuário</DialogTitle>
          <DialogDescription>
            A senha inicial serve apenas para ativar o acesso. O usuário deverá definir uma nova
            senha antes de entrar no sistema.
          </DialogDescription>
        </DialogHeader>

        <ol className="grid gap-2 sm:grid-cols-3" aria-label="Etapas do cadastro">
          {stepLabels.map((label, index) => {
            const number = index + 1;
            const current = number === step;
            const complete = number < step;
            return (
              <li
                key={label}
                aria-current={current ? 'step' : undefined}
                className={[
                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                  current ? 'border-primary bg-primary/5 text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-muted font-semibold">
                  {complete ? <Check className="size-4" /> : number}
                </span>
                {label}
              </li>
            );
          })}
        </ol>

        <form
          onSubmit={(event) => event.preventDefault()}
          className="space-y-5"
          noValidate
          data-testid="create-user-form"
        >
          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.name)}>
                <FieldLabel htmlFor="new-user-name">Nome</FieldLabel>
                <Input id="new-user-name" className="h-11" {...form.register('name')} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.username)}>
                <FieldLabel htmlFor="new-user-username">Usuário</FieldLabel>
                <Input
                  id="new-user-username"
                  className="h-11"
                  autoComplete="off"
                  {...form.register('username')}
                />
                <FieldError errors={[form.formState.errors.username]} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.email)}>
                <FieldLabel htmlFor="new-user-email">E-mail</FieldLabel>
                <Input
                  id="new-user-email"
                  type="email"
                  className="h-11"
                  {...form.register('email')}
                />
                <FieldError errors={[form.formState.errors.email]} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.password)}>
                <span className="flex items-center gap-1.5">
                  <FieldLabel htmlFor="new-user-password">Senha inicial</FieldLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        aria-label="Ver regra da senha inicial"
                        className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <CircleHelp className="size-4" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <Input
                  id="new-user-password"
                  type="password"
                  className="h-11"
                  autoComplete="new-password"
                  {...form.register('password')}
                />
                <FieldError errors={[form.formState.errors.password]} />
              </Field>
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Tipo de conta: Colaborador</p>
                <p className="mt-1 text-muted-foreground">
                  Novos candidatos usarão link seguro e clientes usarão uma área própria quando
                  esses contratos forem publicados pela Tenant API.
                </p>
              </div>
              <Field data-invalid={Boolean(form.formState.errors.requestDocuments)}>
                <FieldLabel htmlFor="new-user-request-documents">
                  Solicitar documentação?
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="requestDocuments"
                  render={({ field }) => (
                    <Select
                      value={field.value ? 'yes' : 'no'}
                      onValueChange={(value) => field.onChange(value === 'yes')}
                    >
                      <SelectTrigger id="new-user-request-documents" className="h-11 w-full">
                        <SelectValue>{field.value ? 'Sim' : 'Não'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Sim</SelectItem>
                        <SelectItem value="no">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  Para colaboradores, escolha se a solicitação deve ser criada agora.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.requestDocuments]} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.jobTitle)}>
                <FieldLabel htmlFor="new-user-job-title">Classificação do usuário</FieldLabel>
                <Controller
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} required>
                      <SelectTrigger id="new-user-job-title" className="h-11 w-full">
                        <SelectValue>{USER_CLASSIFICATION_LABELS[field.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(USER_CLASSIFICATION_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[form.formState.errors.jobTitle]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-user-marital-status">Situação civil</FieldLabel>
                <Controller
                  control={form.control}
                  name="maritalStatus"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="new-user-marital-status" className="h-11 w-full">
                        <SelectValue>
                          {MARITAL_STATUS_LABELS[field.value ?? 'not-informed']}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-informed">Não informado</SelectItem>
                        <SelectItem value="single">Solteiro(a)</SelectItem>
                        <SelectItem value="married">Casado(a)</SelectItem>
                        <SelectItem value="stable-union">União estável</SelectItem>
                        <SelectItem value="divorced">Divorciado(a)</SelectItem>
                        <SelectItem value="widowed">Viúvo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-user-military-status">
                  Situação da documentação militar
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="militaryDocumentStatus"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="new-user-military-status" className="h-11 w-full">
                        <SelectValue>
                          {MILITARY_STATUS_LABELS[field.value ?? 'pending-confirmation']}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending-confirmation">
                          Pendente de confirmação
                        </SelectItem>
                        <SelectItem value="applicable">Aplicável</SelectItem>
                        <SelectItem value="not-applicable">Não aplicável</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  A regra não utiliza gênero e pode ser decidida manualmente.
                </FieldDescription>
              </Field>
              <FieldSet className="sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <FieldLegend>Filhos e dependentes</FieldLegend>
                    <FieldDescription>
                      Adicione cada dependente com sua data de nascimento.
                    </FieldDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      dependents.append({ name: '', birthDate: '', relationship: 'filho(a)' })
                    }
                  >
                    <Plus className="size-4" /> Adicionar dependente
                  </Button>
                </div>
                <div className="space-y-3">
                  {dependents.fields.map((dependent, index) => (
                    <div
                      key={dependent.id}
                      className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[1fr_11rem_10rem_auto]"
                    >
                      <Input
                        aria-label={`Nome do dependente ${index + 1}`}
                        placeholder="Nome completo"
                        {...form.register(`dependents.${index}.name`)}
                      />
                      <Input
                        aria-label={`Nascimento do dependente ${index + 1}`}
                        type="date"
                        {...form.register(`dependents.${index}.birthDate`)}
                      />
                      <Input
                        aria-label={`Vínculo do dependente ${index + 1}`}
                        placeholder="Vínculo"
                        {...form.register(`dependents.${index}.relationship`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover dependente ${index + 1}`}
                        onClick={() => dependents.remove(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </FieldSet>
              <section className="rounded-xl border bg-muted/30 p-4 sm:col-span-2">
                <h3 className="font-semibold">Prévia da documentação personalizada</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  A lista é recalculada automaticamente; nenhum documento aparece duplicado.
                </p>
                <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  {preview.map((document) => (
                    <li key={document}>• {document}</li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          {step === 2 ? (
            <FieldSet>
              <FieldLegend>Departamentos</FieldLegend>
              <FieldDescription>
                Selecione um ou mais departamentos. Eles definem o limite das permissões que poderão
                ser concedidas.
              </FieldDescription>
              <AssignmentCheckboxes
                control={form.control}
                name="departments"
                values={TENANT_DEPARTMENTS.filter((department) => department !== 'client-company')}
                labels={TENANT_DEPARTMENT_LABELS}
              />
              <FieldError errors={[form.formState.errors.departments]} />
            </FieldSet>
          ) : null}

          {step === 3 ? (
            <FieldSet>
              <FieldLegend>Permissões individuais</FieldLegend>
              <FieldDescription>
                Somente permissões compatíveis com os departamentos selecionados são exibidas. A
                validação mantém esse limite no cadastro.
              </FieldDescription>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Dashboard, Agentes de IA, Perfil e Suporte são acessos comuns automáticos e, por
                isso, não podem ser revogados nesta etapa.
              </p>
              <PermissionFields control={form.control} permissions={standardPermissions} />
              <FieldError errors={[form.formState.errors.permissionCodes]} />
            </FieldSet>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((step - 1) as 1 | 2)}>
                Voltar
              </Button>
            ) : null}
            {step < 3 ? (
              <Button type="button" onClick={next}>
                Continuar
              </Button>
            ) : (
              <Button type="button" disabled={isPending} onClick={() => void createUser()}>
                {isPending ? <LoaderCircle className="animate-spin" /> : null}
                Cadastrar usuário
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordResetButton({ userId }: { readonly userId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await requestTenantUserPasswordResetAction(userId);
          toast.add({
            title: result.success ? 'E-mail solicitado' : 'Solicitação não concluída',
            description: formatActionResultDescription(result),
            type: result.success ? 'success' : 'error',
          });
        })
      }
    >
      {isPending ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
      Recuperar senha
    </Button>
  );
}

function DeleteUserButton({ user }: { readonly user: TenantUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isPending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await deleteTenantUserAction(user.id, password);
      toast.add({
        title: result.success ? 'Usuário excluído' : 'Exclusão não concluída',
        description: formatActionResultDescription(result),
        type: result.success ? 'success' : 'error',
      });
      if (result.success) {
        setOpen(false);
        setPassword('');
        router.refresh();
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setPassword('');
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" variant="destructive" />}>
        <Trash2 />
        Excluir
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir {user.name}?</DialogTitle>
          <DialogDescription>
            O acesso será removido e os históricos da empresa serão preservados. Esta ação é
            exclusiva de administradores.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <FieldLabel htmlFor={`delete-user-password-${user.id}`}>
            Sua senha administrativa
          </FieldLabel>
          <Input
            id={`delete-user-password-${user.id}`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && password && !isPending) remove();
            }}
          />
          <FieldDescription>
            Confirme com a senha da conta administrativa conectada.
          </FieldDescription>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || !password}
            onClick={remove}
          >
            {isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            Confirmar exclusão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserStatusActions({ user }: { readonly user: TenantUser }) {
  const router = useRouter();
  const [suspensionOpen, setSuspensionOpen] = useState(false);
  const [mode, setMode] = useState<SuspensionMode>('days');
  const [days, setDays] = useState('7');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const updateStatus = (
    status: TenantUserStatus,
    extra: { suspendedUntil?: string; suspensionReason?: string } = {},
  ) => {
    startTransition(async () => {
      const result = await updateTenantUserStatusAction(user.id, { status, ...extra });
      toast.add({
        title: result.success ? 'Estado atualizado' : 'Alteração não concluída',
        description: formatActionResultDescription(result),
        type: result.success ? 'success' : 'error',
      });
      if (result.success) {
        setSuspensionOpen(false);
        router.refresh();
      }
    });
  };

  const suspend = () => {
    const suspendedUntil =
      mode === 'days'
        ? new Date(Date.now() + Number(days) * 86_400_000).toISOString()
        : new Date(`${date}T23:59:59`).toISOString();
    updateStatus('suspended', { suspendedUntil, suspensionReason: reason });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {user.status !== 'active' ? (
        <Button type="button" size="sm" disabled={isPending} onClick={() => updateStatus('active')}>
          <UserRoundCheck />
          Ativar
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => updateStatus('inactive')}
        >
          <UserRoundX />
          Desativar
        </Button>
      )}

      {user.status !== 'suspended' ? (
        <Dialog open={suspensionOpen} onOpenChange={setSuspensionOpen}>
          <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
            <PauseCircle />
            Suspender
          </DialogTrigger>
          <DialogContent showCloseButton={false} className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Suspender {user.name}</DialogTitle>
              <DialogDescription>
                Durante o período informado, novas autenticações e sessões existentes serão
                bloqueadas enquanto o usuário estiver suspenso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor={`suspension-mode-${user.id}`}>Período</FieldLabel>
                <Select value={mode} onValueChange={(value) => setMode(value as SuspensionMode)}>
                  <SelectTrigger id={`suspension-mode-${user.id}`} className="h-11 w-full">
                    <SelectValue>
                      {(value) =>
                        SUSPENSION_MODE_LABELS[value as SuspensionMode] ?? 'Selecione o período'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUSPENSION_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {mode === 'days' ? (
                <Field>
                  <FieldLabel htmlFor={`suspension-days-${user.id}`}>Dias</FieldLabel>
                  <Input
                    id={`suspension-days-${user.id}`}
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                  />
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor={`suspension-date-${user.id}`}>Suspenso até</FieldLabel>
                  <Input
                    id={`suspension-date-${user.id}`}
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor={`suspension-reason-${user.id}`}>Motivo</FieldLabel>
                <Textarea
                  id={`suspension-reason-${user.id}`}
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Informe o motivo da suspensão."
                />
              </Field>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button
                type="button"
                disabled={
                  isPending ||
                  reason.trim().length < 3 ||
                  (mode === 'days' ? Number(days) < 1 : !date)
                }
                onClick={suspend}
              >
                {isPending ? <LoaderCircle className="animate-spin" /> : <CalendarClock />}
                Confirmar suspensão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function PermissionFilterLabel({
  code,
  isImplicit,
}: {
  readonly code: string;
  readonly isImplicit: boolean;
}) {
  const resource = permissionResource(code);
  const action = code.slice(resource.length + 1);
  return (
    <>
      {getPermissionResourceLabel(resource)} · {getPermissionActionLabel(action)}
      {isImplicit ? ' (automática)' : ''}
    </>
  );
}

interface UsersFilterValues {
  readonly search: string;
  readonly department: string;
  readonly permission: string;
  readonly status: string;
}

function resolveFilterValues(filters: UserListFilters): UsersFilterValues {
  return {
    search: filters.search ?? '',
    department: filters.department ?? '__all__',
    permission: filters.permission ?? '__all__',
    status: filters.status ?? '__all__',
  };
}

function UsersFilters({
  filters,
  permissionCatalog,
}: {
  readonly filters: UserListFilters;
  readonly permissionCatalog: PermissionCatalog;
}) {
  const initialValues = resolveFilterValues(filters);

  return (
    <UsersFiltersState
      key={JSON.stringify(initialValues)}
      initialValues={initialValues}
      permissionCatalog={permissionCatalog}
    />
  );
}

function UsersFiltersState({
  initialValues,
  permissionCatalog,
}: {
  readonly initialValues: UsersFilterValues;
  readonly permissionCatalog: PermissionCatalog;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [values, setValues] = useState(initialValues);
  const latestValues = useRef(initialValues);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const navigate = useCallback(
    (nextValues: UsersFilterValues) => {
      const params = new URLSearchParams();
      const search = nextValues.search.trim();
      if (search) params.set('search', search);
      if (nextValues.department !== '__all__') {
        params.set('department', nextValues.department);
      }
      if (nextValues.permission !== '__all__') {
        params.set('permission', nextValues.permission);
      }
      if (nextValues.status !== '__all__') params.set('status', nextValues.status);
      const query = params.toString();

      startTransition(() => {
        router.push(query ? `/users?${query}` : '/users', { scroll: false });
      });
    },
    [router],
  );

  const updateFilter = useCallback(
    (name: 'department' | 'permission' | 'status', value: string | null) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const nextValues = {
        ...latestValues.current,
        [name]: value ?? '__all__',
      };
      latestValues.current = nextValues;
      setValues(nextValues);
      navigate(nextValues);
    },
    [navigate],
  );

  const applySearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    navigate(latestValues.current);
  }, [navigate]);

  const updateSearch = (search: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const nextValues = { ...latestValues.current, search };
    latestValues.current = nextValues;
    setValues(nextValues);
    searchTimer.current = setTimeout(() => navigate(latestValues.current), 400);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applySearch();
  };

  const clearFilter = (name: 'search' | 'department' | 'permission' | 'status') => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const nextValues = {
      ...latestValues.current,
      [name]: name === 'search' ? '' : '__all__',
    };
    latestValues.current = nextValues;
    setValues(nextValues);
    navigate(nextValues);
  };

  const clearAll = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const nextValues = {
      search: '',
      department: '__all__',
      permission: '__all__',
      status: '__all__',
    };
    latestValues.current = nextValues;
    setValues(nextValues);
    navigate(nextValues);
  };

  const hasActiveFilters =
    values.search.trim().length > 0 ||
    values.department !== '__all__' ||
    values.permission !== '__all__' ||
    values.status !== '__all__';

  return (
    <section
      aria-label="Pesquisa e filtros de usuários"
      aria-busy={isPending}
      className="mb-5 rounded-xl border bg-card p-4"
    >
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1.3fr_1fr]">
        <Field>
          <FieldLabel htmlFor="user-search">Pesquisar</FieldLabel>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="user-search"
              type="search"
              name="search"
              value={values.search}
              onChange={(event) => updateSearch(event.currentTarget.value)}
              onBlur={applySearch}
              onKeyDown={handleSearchKeyDown}
              className="h-10 pl-9"
              placeholder="Nome, usuário ou e-mail"
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="user-department-filter">Departamento</FieldLabel>
          <Select
            name="department"
            value={values.department}
            onValueChange={(value) => updateFilter('department', value)}
          >
            <SelectTrigger id="user-department-filter" className="h-10 w-full">
              <SelectValue>
                {(value) =>
                  !value || value === '__all__' ? 'Todos' : getTenantDepartmentLabel(String(value))
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {TENANT_DEPARTMENTS.map((department) => (
                <SelectItem key={department} value={department}>
                  {TENANT_DEPARTMENT_LABELS[department]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="user-permission-filter">Permissão efetiva</FieldLabel>
          <Select
            name="permission"
            value={values.permission}
            onValueChange={(value) => updateFilter('permission', value)}
          >
            <SelectTrigger id="user-permission-filter" className="h-10 w-full">
              <SelectValue>
                {(value) => {
                  const code = String(value ?? '');
                  return !code || code === '__all__' ? (
                    'Todas as permissões'
                  ) : (
                    <PermissionFilterLabel
                      code={code}
                      isImplicit={permissionCatalog.implicitPermissions.includes(code)}
                    />
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as permissões</SelectItem>
              {permissionCatalog.permissions.map((permission) => (
                <SelectItem key={permission} value={permission}>
                  <PermissionFilterLabel
                    code={permission}
                    isImplicit={permissionCatalog.implicitPermissions.includes(permission)}
                  />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="user-status-filter">Estado</FieldLabel>
          <Select
            name="status"
            value={values.status}
            onValueChange={(value) => updateFilter('status', value)}
          >
            <SelectTrigger id="user-status-filter" className="h-10 w-full">
              <SelectValue>
                {(value) => STATUS_FILTER_LABELS[String(value ?? '')] ?? 'Todos'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Desativados</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FieldDescription>
          Inclui permissões individuais e automáticas disponíveis para este acesso.
        </FieldDescription>
        {values.search.trim() ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => clearFilter('search')}
            aria-label="Remover filtro de pesquisa"
          >
            Pesquisa: {values.search.trim()}
            <X />
          </Button>
        ) : null}
        {values.department !== '__all__' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => clearFilter('department')}
            aria-label="Remover filtro de departamento"
          >
            Departamento: {getTenantDepartmentLabel(values.department)}
            <X />
          </Button>
        ) : null}
        {values.permission !== '__all__' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => clearFilter('permission')}
            aria-label="Remover filtro de permissão"
          >
            Permissão:
            <PermissionFilterLabel
              code={values.permission}
              isImplicit={permissionCatalog.implicitPermissions.includes(values.permission)}
            />
            <X />
          </Button>
        ) : null}
        {values.status !== '__all__' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => clearFilter('status')}
            aria-label="Remover filtro de estado"
          >
            Estado: {STATUS_FILTER_LABELS[values.status]}
            <X />
          </Button>
        ) : null}
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function paginationHref(filters: UserListFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.department) params.set('department', filters.department);
  if (filters.permission) params.set('permission', filters.permission);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(page));
  return `/users?${params.toString()}`;
}

export function UsersManagement({
  users,
  permissionCatalog,
  canCreate,
  canEdit,
  canManageAccess,
  canManageLifecycle = canManageAccess,
  canResetPassword = canManageLifecycle,
  canDelete = false,
  currentUserId,
  filters = {},
}: {
  readonly users: TenantUserList;
  readonly permissionCatalog: PermissionCatalog;
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canManageAccess: boolean;
  readonly canManageLifecycle?: boolean;
  readonly canResetPassword?: boolean;
  readonly canDelete?: boolean;
  readonly currentUserId?: string;
  readonly filters?: UserListFilters;
}) {
  const hasFilters = Boolean(
    filters.search || filters.department || filters.permission || filters.status,
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary-emphasis">Administração de acessos</p>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {users.meta.total === 1
              ? '1 conta encontrada nesta organização.'
              : `${users.meta.total} contas encontradas nesta organização.`}
          </p>
        </div>
        {canCreate && canManageAccess ? (
          <CreateUserDialog permissionCatalog={permissionCatalog} />
        ) : null}
      </div>

      <UsersFilters filters={filters} permissionCatalog={permissionCatalog} />

      {users.data.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilters ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
            </EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? 'Revise os filtros informados ou limpe a pesquisa.'
                : canCreate && canManageAccess
                  ? 'Use “Novo usuário” para criar a primeira conta.'
                  : canCreate
                    ? 'A criação de candidatos aguarda o contrato de link seguro da Tenant API.'
                    : 'Nenhuma conta está disponível para consulta.'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {hasFilters ? (
              <Button render={<Link href="/users" />} nativeButton={false} variant="outline">
                Limpar filtros
              </Button>
            ) : null}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Departamentos</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{user.name}</p>
                      {user.isAdministrator ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-emphasis">
                          Administrador
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {user.username} · {user.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-80 flex-wrap gap-1.5 whitespace-normal">
                      {user.departments.map((department) => (
                        <span key={department} className="rounded-full border px-2 py-0.5 text-xs">
                          {getTenantDepartmentLabel(department)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {user.isAdministrator
                        ? 'Acesso administrativo completo'
                        : user.permissionCodes.length === 1
                          ? '1 permissão individual'
                          : `${user.permissionCodes.length} permissões individuais`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[user.status]}`}
                    >
                      {STATUS_LABELS[user.status]}
                    </span>
                    {user.status === 'suspended' && user.suspendedUntil ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Até {new Date(user.suspendedUntil).toLocaleString('pt-BR')}
                      </p>
                    ) : null}
                    {user.status === 'suspended' && user.suspensionReason ? (
                      <p className="mt-1 max-w-64 whitespace-normal text-xs text-muted-foreground">
                        {user.suspensionReason}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {canEdit || canManageAccess || canManageLifecycle || canDelete ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {canEdit ? (
                          <>
                            <Button
                              render={<Link href={`/users/${user.id}`} />}
                              nativeButton={false}
                              size="sm"
                              variant="outline"
                            >
                              {canManageAccess
                                ? 'Editar dados e acessos'
                                : 'Editar dados documentais'}
                            </Button>
                            {canResetPassword ? <PasswordResetButton userId={user.id} /> : null}
                          </>
                        ) : null}
                        {canManageLifecycle ? <UserStatusActions user={user} /> : null}
                        {canDelete && user.id !== currentUserId ? (
                          <DeleteUserButton user={user} />
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Somente consulta</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {users.meta.totalPages > 1 ? (
        <nav className="mt-5 flex items-center justify-between" aria-label="Paginação de usuários">
          <p className="text-sm text-muted-foreground">
            Página {users.meta.page} de {users.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              render={
                <Link
                  href={paginationHref(filters, Math.max(1, users.meta.page - 1))}
                  aria-disabled={users.meta.page === 1}
                />
              }
              nativeButton={false}
              variant="outline"
              size="sm"
              className={users.meta.page === 1 ? 'pointer-events-none opacity-50' : undefined}
            >
              <ChevronLeft />
              Anterior
            </Button>
            <Button
              render={
                <Link
                  href={paginationHref(
                    filters,
                    Math.min(users.meta.totalPages, users.meta.page + 1),
                  )}
                  aria-disabled={users.meta.page === users.meta.totalPages}
                />
              }
              nativeButton={false}
              variant="outline"
              size="sm"
              className={
                users.meta.page === users.meta.totalPages
                  ? 'pointer-events-none opacity-50'
                  : undefined
              }
            >
              Próxima
              <ChevronRight />
            </Button>
          </div>
        </nav>
      ) : null}
    </>
  );
}
