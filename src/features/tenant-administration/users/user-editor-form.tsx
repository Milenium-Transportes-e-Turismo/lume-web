'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useTransition } from 'react';
import { Controller, useController, useForm, useWatch, type Control } from 'react-hook-form';

import { updateTenantUserFormAction } from '@/features/tenant-administration/actions';
import {
  TENANT_DEPARTMENTS,
  TENANT_DEPARTMENT_LABELS,
  type PermissionCatalog,
  type TenantUser,
} from '@/features/tenant-administration/domain';
import {
  getPermissionCodeLabel,
  getPermissionResourceLabel,
} from '@/features/tenant-administration/permissions/permission-labels';
import { Button } from '@/shared/ui/button';
import { formatActionResultDescription } from '@/shared/lib/action-result-feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
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
import { toast } from '@/shared/ui/toast';

import {
  compatiblePermissionCodes,
  groupPermissionsByResource,
  permissionResource,
} from './permission-assignment';
import { userEditorFormSchema, type UserEditorFormValues } from './user-form-schema';

const ACCESS_MODE_LABELS = {
  standard: 'Usuário interno',
  'document-portal': 'Candidato — acesso documental legado',
  client: 'Cliente — acesso legado',
} as const;

function classificationFromStoredValue(
  value: string | null,
): 'Administrativo' | 'Geral' | 'Motorista' {
  const normalized =
    value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase() ?? '';
  if (normalized.includes('motorista')) return 'Motorista';
  if (normalized.includes('administrativ')) return 'Administrativo';
  return 'Geral';
}

function DepartmentCheckboxes({
  control,
  disabled,
}: {
  readonly control: Control<UserEditorFormValues>;
  readonly disabled: boolean;
}) {
  const { field } = useController({ control, name: 'departments' });

  const available = TENANT_DEPARTMENTS.filter(
    (department) => department !== 'client-company' || field.value.includes(department),
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Field orientation="horizontal" className="sm:col-span-2 lg:col-span-3">
        <Checkbox
          id="edit-departments-all"
          disabled={disabled}
          checked={available.every((department) => field.value.includes(department))}
          indeterminate={
            available.some((department) => field.value.includes(department)) &&
            !available.every((department) => field.value.includes(department))
          }
          onCheckedChange={(checked) => field.onChange(checked ? [...available] : [])}
        />
        <FieldLabel htmlFor="edit-departments-all">Selecionar todos</FieldLabel>
      </Field>
      {TENANT_DEPARTMENTS.filter(
        (department) => department !== 'client-company' || field.value.includes(department),
      ).map((department) => {
        const id = `edit-user-department-${department}`;
        return (
          <Field
            key={department}
            orientation="horizontal"
            className="rounded-lg border border-border p-3"
          >
            <Checkbox
              id={id}
              disabled={disabled}
              checked={field.value.includes(department)}
              onCheckedChange={(checked) =>
                field.onChange(
                  checked
                    ? [...field.value, department]
                    : field.value.filter((candidate) => candidate !== department),
                )
              }
            />
            <FieldLabel htmlFor={id}>{TENANT_DEPARTMENT_LABELS[department]}</FieldLabel>
          </Field>
        );
      })}
    </div>
  );
}

function PermissionCheckboxes({
  control,
  permissions,
  disabled,
}: {
  readonly control: Control<UserEditorFormValues>;
  readonly permissions: readonly string[];
  readonly disabled: boolean;
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
        const selectAllId = `edit-user-permission-${resource}-all`;

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
              <FieldLabel htmlFor={selectAllId}>
                Selecionar todas
                <span className="sr-only"> em {resourceLabel}</span>
              </FieldLabel>
            </Field>
            <div className="space-y-2">
              {codes.map((code) => {
                const action = code.slice(permissionResource(code).length + 1);
                const id = `edit-user-permission-${code}`;
                return (
                  <Field key={code} orientation="horizontal">
                    <Checkbox
                      id={id}
                      checked={field.value.includes(code)}
                      disabled={disabled}
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

export function UserEditorForm({
  user,
  permissionCatalog,
  canManageAccess,
  routingCompanies = [],
}: {
  readonly user: TenantUser;
  readonly permissionCatalog: PermissionCatalog;
  readonly canManageAccess: boolean;
  readonly routingCompanies?: readonly { readonly id: string; readonly label: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<UserEditorFormValues>({
    resolver: zodResolver(userEditorFormSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      isAdministrator: user.isAdministrator,
      documentAccessMode: user.documentAccessMode ?? 'standard',
      clientCategory: user.clientCategory ?? null,
      routingCompanyId: user.routingCompanyId ?? null,
      departments: [...user.departments],
      permissionCodes: [...user.permissionCodes],
      jobTitle: classificationFromStoredValue(user.jobTitle),
      maritalStatus: user.maritalStatus ?? 'not-informed',
      militaryDocumentStatus: user.militaryDocumentStatus ?? 'pending-confirmation',
      dependents: (user.dependents ?? []).map((dependent) => ({ ...dependent })),
    },
  });
  const isAdministrator = user.isAdministrator;
  const departments = useWatch({ control: form.control, name: 'departments' });
  const documentAccessMode = useWatch({
    control: form.control,
    name: 'documentAccessMode',
  });
  const clientCategory = useWatch({ control: form.control, name: 'clientCategory' });
  const standardPermissions = useMemo(
    () => compatiblePermissionCodes(permissionCatalog, departments),
    [departments, permissionCatalog],
  );
  const visiblePermissions = isAdministrator ? permissionCatalog.permissions : standardPermissions;

  useEffect(() => {
    if (!canManageAccess) return;
    if (isAdministrator) {
      const currentDepartments = form.getValues('departments');
      const currentPermissions = form.getValues('permissionCodes');
      if (
        currentDepartments.length !== TENANT_DEPARTMENTS.length ||
        TENANT_DEPARTMENTS.some((department) => !currentDepartments.includes(department))
      ) {
        form.setValue('departments', [...TENANT_DEPARTMENTS]);
      }
      if (
        currentPermissions.length !== permissionCatalog.permissions.length ||
        permissionCatalog.permissions.some((permission) => !currentPermissions.includes(permission))
      ) {
        form.setValue('permissionCodes', [...permissionCatalog.permissions]);
      }
      return;
    }

    const allowed = new Set(standardPermissions);
    const current = form.getValues('permissionCodes');
    const filtered = current.filter((permission) => allowed.has(permission));
    if (current.length !== filtered.length) {
      form.setValue('permissionCodes', filtered, { shouldValidate: true });
    }
  }, [canManageAccess, form, isAdministrator, permissionCatalog.permissions, standardPermissions]);

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const scopedValues =
        values.documentAccessMode === 'client'
          ? values
          : Object.fromEntries(
              Object.entries(values).filter(
                ([key]) => !['clientCategory', 'routingCompanyId'].includes(key),
              ),
            );
      const result = await updateTenantUserFormAction(
        user.id,
        Object.fromEntries(
          Object.entries(scopedValues).filter(
            ([key]) =>
              !['jobTitle', 'maritalStatus', 'militaryDocumentStatus', 'dependents'].includes(key),
          ),
        ),
      );
      toast.add({
        title: result.success ? 'Usuário atualizado' : 'Alteração não concluída',
        description: formatActionResultDescription(result),
        type: result.success ? 'success' : 'error',
      });
    });
  });

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          {canManageAccess ? 'Dados e acessos do usuário' : 'Dados documentais do usuário'}
        </CardTitle>
        <CardDescription>
          {canManageAccess
            ? 'Os departamentos definem quais permissões individuais podem ser concedidas.'
            : 'As permissões de acesso continuam sob gestão exclusiva dos administradores.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field data-invalid={Boolean(form.formState.errors.name)}>
              <FieldLabel htmlFor="edit-user-name">Nome</FieldLabel>
              <Input id="edit-user-name" className="h-11" {...form.register('name')} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Field data-invalid={Boolean(form.formState.errors.email)}>
              <FieldLabel htmlFor="edit-user-email">E-mail</FieldLabel>
              <Input
                id="edit-user-email"
                type="email"
                className="h-11"
                {...form.register('email')}
              />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-user-username">Usuário</FieldLabel>
              <Input
                id="edit-user-username"
                value={user.username}
                className="h-11"
                disabled
                readOnly
              />
              <FieldDescription>O identificador de acesso não é alterado.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-user-access-mode">Modo de acesso</FieldLabel>
              <Input
                id="edit-user-access-mode"
                value={ACCESS_MODE_LABELS[documentAccessMode ?? 'standard']}
                className="h-11"
                readOnly
              />
              <FieldDescription>
                O modo atual é preservado. Conversões aguardam uma regra explícita de migração.
              </FieldDescription>
            </Field>
            {canManageAccess && documentAccessMode === 'client' ? (
              <>
                <Field data-invalid={Boolean(form.formState.errors.clientCategory)}>
                  <FieldLabel htmlFor="edit-user-client-category">Tipo de cliente</FieldLabel>
                  <Controller
                    control={form.control}
                    name="clientCategory"
                    render={({ field }) => (
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger id="edit-user-client-category" className="w-full">
                          <SelectValue>
                            {field.value === 'legal-entity'
                              ? 'Pessoa jurídica (PJ)'
                              : field.value === 'individual'
                                ? 'Pessoa física (PF)'
                                : 'Selecione'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="legal-entity">Pessoa jurídica (PJ)</SelectItem>
                          <SelectItem value="individual">Pessoa física (PF)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[form.formState.errors.clientCategory]} />
                </Field>
                {clientCategory ? (
                  <Field data-invalid={Boolean(form.formState.errors.routingCompanyId)}>
                    <FieldLabel htmlFor="edit-user-routing-company">Cliente vinculado</FieldLabel>
                    <Controller
                      control={form.control}
                      name="routingCompanyId"
                      render={({ field }) => (
                        <Select value={field.value ?? ''} onValueChange={field.onChange}>
                          <SelectTrigger id="edit-user-routing-company" className="w-full">
                            <SelectValue>
                              {routingCompanies.find((company) => company.id === field.value)
                                ?.label ?? 'Selecione o cliente'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {routingCompanies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldDescription>
                      O cliente PF ou PJ permanece isolado neste cadastro.
                    </FieldDescription>
                    <FieldError errors={[form.formState.errors.routingCompanyId]} />
                  </Field>
                ) : null}
              </>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            Perfil documental e dependentes são gerenciados na pessoa do Cadastro.
          </p>

          {canManageAccess && isAdministrator ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-medium">Conta administradora</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Este vínculo foi provisionado fora do Tenant Web e não pode ser concedido, removido
                ou transferido por esta interface.
              </p>
            </div>
          ) : null}

          {canManageAccess ? (
            <FieldSet>
              <FieldLegend>Departamentos</FieldLegend>
              <FieldDescription>
                {isAdministrator
                  ? 'Todos os departamentos estão incluídos automaticamente.'
                  : documentAccessMode === 'document-portal'
                    ? 'O departamento pode ser preparado agora ou definido ao promover o candidato.'
                    : 'O usuário deve permanecer vinculado a ao menos um departamento.'}
              </FieldDescription>
              <DepartmentCheckboxes
                control={form.control}
                disabled={isAdministrator || documentAccessMode === 'client'}
              />
              <FieldError errors={[form.formState.errors.departments]} />
            </FieldSet>
          ) : null}

          {canManageAccess ? (
            <FieldSet>
              <FieldLegend>Permissões individuais</FieldLegend>
              <FieldDescription>
                {isAdministrator
                  ? 'Todas as permissões atuais e futuras são concedidas automaticamente.'
                  : 'Ao remover um departamento, permissões fora do novo limite também são removidas.'}
              </FieldDescription>
              {!isAdministrator ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Dashboard, Agentes de IA, Perfil e Suporte são acessos comuns automáticos e não
                  fazem parte da seleção individual.
                </p>
              ) : null}
              <PermissionCheckboxes
                control={form.control}
                permissions={visiblePermissions}
                disabled={isAdministrator}
              />
              <FieldError errors={[form.formState.errors.permissionCodes]} />
            </FieldSet>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
            <Button
              render={<Link href="/users" />}
              nativeButton={false}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <LoaderCircle className="animate-spin" /> : null}
              Salvar alterações
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
