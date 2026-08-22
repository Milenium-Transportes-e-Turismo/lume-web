'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { RoutingError } from '@/features/routing/application';
import { executeAuthenticatedRoutingMutation } from '@/features/routing/server';
import { normalizePhone } from '@/shared/utils/brazilian-data';

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function phones(data: FormData, key: string) {
  try {
    const parsed = JSON.parse(text(data, key) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clientPayload(data: FormData) {
  return {
    clientType: text(data, 'clientType'),
    status: text(data, 'status') || 'active',
    avicExternalId: text(data, 'avicExternalId') || null,
    individualName: text(data, 'individualName') || null,
    cpf: text(data, 'cpf') || null,
    individualEmail: text(data, 'individualEmail') || null,
    individualWhatsapp: text(data, 'individualWhatsapp') || null,
    individualPhones: phones(data, 'individualPhones'),
    legalName: text(data, 'legalName') || null,
    tradeName: text(data, 'tradeName') || null,
    cnpj: text(data, 'cnpj') || null,
    legalEmail: text(data, 'legalEmail') || null,
    legalWhatsapp: text(data, 'legalWhatsapp') || null,
    legalPhones: phones(data, 'legalPhones'),
  };
}

function fail(path: string, error: unknown): never {
  if (error instanceof RoutingError && error.code === 'unauthorized') {
    redirect('/auth/session-expired');
  }
  const message =
    error instanceof RoutingError ? error.message : 'Não foi possível concluir a operação.';
  const separator = path.includes('?') ? '&' : '?';
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

export async function createClientAction(data: FormData): Promise<void> {
  let clientId = '';
  try {
    const client = await executeAuthenticatedRoutingMutation((gateway) =>
      gateway.createCompany(clientPayload(data)),
    );
    clientId = client.id;
  } catch (error) {
    fail('/clients/new', error);
  }
  revalidatePath('/clients');
  redirect(`/clients/${clientId}?success=${encodeURIComponent('Cliente cadastrado.')}`);
}

export type ClientLookupResult =
  | { readonly status: 'found'; readonly clientId: string }
  | { readonly status: 'not-found' }
  | { readonly status: 'error'; readonly message: string };

export async function findClientByPhoneAction(phone: string): Promise<ClientLookupResult> {
  const searchedPhone = normalizePhone(phone);
  if (searchedPhone.length < 10) return { status: 'not-found' };

  try {
    const result = await executeAuthenticatedRoutingMutation((gateway) =>
      gateway.listCompanies({ search: searchedPhone, page: 1, pageSize: 100 }),
    );
    const comparablePhone = (value: string | null | undefined) => {
      const digits = normalizePhone(value ?? '');
      return digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
    };
    const target = comparablePhone(searchedPhone);
    const client = result.items.find((item) =>
      [
        item.individualWhatsapp,
        item.legalWhatsapp,
        ...item.individualPhones.map((entry) => entry.number),
        ...item.legalPhones.map((entry) => entry.number),
      ].some((candidate) => comparablePhone(candidate) === target),
    );
    return client ? { status: 'found', clientId: client.id } : { status: 'not-found' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof RoutingError ? error.message : 'Não foi possível consultar clientes.',
    };
  }
}

export async function updateClientAction(data: FormData): Promise<void> {
  const clientId = text(data, 'clientId');
  try {
    await executeAuthenticatedRoutingMutation((gateway) =>
      gateway.updateCompany(clientId, {
        ...clientPayload(data),
        expectedVersion: Number(text(data, 'expectedVersion') || '1'),
      }),
    );
  } catch (error) {
    fail(`/clients/${clientId}/edit`, error);
  }
  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?success=${encodeURIComponent('Dados do cliente atualizados.')}`);
}

export async function changeClientStatusAction(data: FormData): Promise<void> {
  const clientId = text(data, 'clientId');
  try {
    const current = await executeAuthenticatedRoutingMutation((gateway) =>
      gateway.getCompany(clientId),
    );
    await executeAuthenticatedRoutingMutation((gateway) =>
      gateway.updateCompany(clientId, {
        clientType: current.clientType,
        avicExternalId: current.avicExternalId,
        individualName: current.individualName,
        cpf: current.cpf,
        individualEmail: current.individualEmail,
        individualWhatsapp: current.individualWhatsapp,
        individualPhones: current.individualPhones,
        legalName: current.legalName,
        tradeName: current.tradeName,
        cnpj: current.cnpj,
        legalEmail: current.legalEmail,
        legalWhatsapp: current.legalWhatsapp,
        legalPhones: current.legalPhones,
        status: text(data, 'status'),
        expectedVersion: current.version,
      }),
    );
  } catch (error) {
    fail(`/clients/${clientId}`, error);
  }
  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?success=${encodeURIComponent('Situação do cliente atualizada.')}`);
}

export async function addClientCommentAction(data: FormData): Promise<void> {
  const clientId = text(data, 'clientId');
  try {
    await executeAuthenticatedRoutingMutation((gateway) =>
      gateway.addCompanyComment(clientId, text(data, 'comment')),
    );
  } catch (error) {
    fail(`/clients/${clientId}?tab=profile`, error);
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(
    `/clients/${clientId}?tab=profile&success=${encodeURIComponent('Comentário registrado.')}`,
  );
}

export async function updateClientCommentAction(data: FormData): Promise<void> {
  const clientId = text(data, 'clientId');
  try {
    await executeAuthenticatedRoutingMutation((gateway) =>
      gateway.updateCompanyComment(clientId, text(data, 'commentId'), text(data, 'comment')),
    );
  } catch (error) {
    fail(`/clients/${clientId}?tab=profile`, error);
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(
    `/clients/${clientId}?tab=profile&success=${encodeURIComponent('Comentário atualizado.')}`,
  );
}

export async function removeClientCommentAction(data: FormData): Promise<void> {
  const clientId = text(data, 'clientId');
  try {
    await executeAuthenticatedRoutingMutation((gateway) =>
      gateway.removeCompanyComment(clientId, text(data, 'commentId')),
    );
  } catch (error) {
    fail(`/clients/${clientId}?tab=profile`, error);
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(
    `/clients/${clientId}?tab=profile&success=${encodeURIComponent('Comentário removido.')}`,
  );
}
