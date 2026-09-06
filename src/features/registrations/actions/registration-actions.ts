'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { RegistrationGatewayError } from '../application';
import { executeAuthenticatedRegistrationMutation } from '../server';

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(data: FormData, key: string): string[] {
  return data
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function jsonArray(data: FormData, key: string): Record<string, unknown>[] {
  try {
    const value = JSON.parse(text(data, key) || '[]') as unknown;
    return Array.isArray(value)
      ? value.filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && !Array.isArray(item),
        )
      : [];
  } catch {
    return [];
  }
}

function registrationPayload(data: FormData) {
  return {
    ...(data.get('hasDocumentProfile') === 'yes'
      ? {
          documentProfile: {
            jobTitle: text(data, 'documentJobTitle') || null,
            maritalStatus: text(data, 'documentMaritalStatus') || null,
            militaryDocumentStatus: text(data, 'documentMilitaryStatus'),
            dependents: jsonArray(data, 'documentDependents'),
          },
        }
      : {}),
    serviceInstructions: text(data, 'serviceInstructions') || null,
    address:
      data.get('hasAddress') === 'yes'
        ? {
            street: text(data, 'addressStreet'),
            number: text(data, 'addressNumber'),
            complement: text(data, 'addressComplement') || null,
            district: text(data, 'addressDistrict'),
            postalCode: text(data, 'addressPostalCode'),
            city: text(data, 'addressCity'),
            state: text(data, 'addressState'),
          }
        : null,
    type: text(data, 'type'),
    status: text(data, 'status') || 'active',
    avicExternalId: text(data, 'avicExternalId') || null,
    firstName: text(data, 'firstName') || null,
    lastName: text(data, 'lastName') || null,
    legalName: text(data, 'legalName') || null,
    tradeName: text(data, 'tradeName') || null,
    cpf: text(data, 'cpf') || null,
    cnpj: text(data, 'cnpj') || null,
    roleCodes: stringArray(data, 'roleCodes'),
    tagCodes: stringArray(data, 'tagCodes'),
    phones: jsonArray(data, 'phones'),
    emails: jsonArray(data, 'emails'),
  };
}

function registrationReviewPayload(data: FormData) {
  const primary = registrationPayload(data);
  const related = jsonArray(data, 'relatedRegistrationGraph');
  if (related.length === 0) return primary;
  return {
    primaryLocalId: 'primary',
    registrations: [
      { localId: 'primary', registration: primary },
      ...related.flatMap((entry) => {
        const localId = entry.localId;
        const registration = entry.registration;
        return typeof localId === 'string' && registration && typeof registration === 'object'
          ? [{ localId, registration }]
          : [];
      }),
    ],
    relationships: related.flatMap((entry) => {
      const relationship = entry.relationship;
      return relationship && typeof relationship === 'object' ? [relationship] : [];
    }),
  };
}

function fail(path: string, error: unknown): never {
  if (error instanceof RegistrationGatewayError && error.code === 'unauthorized') {
    redirect('/auth/session-expired');
  }
  const message =
    error instanceof RegistrationGatewayError
      ? error.message
      : 'Não foi possível concluir a operação.';
  const separator = path.includes('?') ? '&' : '?';
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

export async function createRegistrationAction(data: FormData): Promise<void> {
  let registrationId = '';
  try {
    const registration = await executeAuthenticatedRegistrationMutation((gateway) =>
      gateway.create(registrationPayload(data)),
    );
    registrationId = registration.id;
  } catch (error) {
    fail('/registrations/new', error);
  }
  revalidatePath('/registrations');
  redirect(
    `/registrations/${registrationId}?success=${encodeURIComponent('Cadastro criado com sucesso.')}`,
  );
}

export async function updateRegistrationAction(data: FormData): Promise<void> {
  const registrationId = text(data, 'registrationId');
  try {
    await executeAuthenticatedRegistrationMutation((gateway) =>
      gateway.update(registrationId, {
        ...registrationPayload(data),
        expectedVersion: Number(text(data, 'expectedVersion') || '1'),
      }),
    );
  } catch (error) {
    fail(`/registrations/${registrationId}/edit`, error);
  }
  revalidatePath('/registrations');
  revalidatePath(`/registrations/${registrationId}`);
  redirect(
    `/registrations/${registrationId}?success=${encodeURIComponent('Cadastro atualizado.')}`,
  );
}

export async function createRegistrationRelationshipAction(data: FormData): Promise<void> {
  const registrationId = text(data, 'registrationId');
  try {
    await executeAuthenticatedRegistrationMutation((gateway) =>
      gateway.createRelationship(registrationId, {
        targetRegistrationId: text(data, 'targetRegistrationId'),
        type: text(data, 'relationshipType'),
        jobTitle: text(data, 'jobTitle') || null,
        department: text(data, 'department') || null,
        isPrimary: text(data, 'isPrimary') === 'on',
        notes: text(data, 'notes') || null,
      }),
    );
  } catch (error) {
    fail(`/registrations/${registrationId}?tab=relationships`, error);
  }
  revalidatePath(`/registrations/${registrationId}`);
  redirect(
    `/registrations/${registrationId}?tab=relationships&success=${encodeURIComponent('Relacionamento adicionado.')}`,
  );
}

export async function updateRegistrationRelationshipAction(data: FormData): Promise<void> {
  const registrationId = text(data, 'registrationId');
  const relationshipId = text(data, 'relationshipId');
  try {
    await executeAuthenticatedRegistrationMutation((gateway) =>
      gateway.updateRelationship(registrationId, relationshipId, {
        targetRegistrationId: text(data, 'targetRegistrationId'),
        type: text(data, 'relationshipType'),
        jobTitle: text(data, 'jobTitle') || null,
        department: text(data, 'department') || null,
        isPrimary: text(data, 'isPrimary') === 'on',
        notes: text(data, 'notes') || null,
        expectedVersion: Number(text(data, 'expectedVersion')),
      }),
    );
  } catch (error) {
    fail(`/registrations/${registrationId}?tab=relationships`, error);
  }
  revalidatePath(`/registrations/${registrationId}`);
  redirect(
    `/registrations/${registrationId}?tab=relationships&success=${encodeURIComponent('Relacionamento atualizado.')}`,
  );
}

export async function removeRegistrationRelationshipAction(data: FormData): Promise<void> {
  const registrationId = text(data, 'registrationId');
  try {
    await executeAuthenticatedRegistrationMutation((gateway) =>
      gateway.removeRelationship(
        registrationId,
        text(data, 'relationshipId'),
        Number(text(data, 'expectedVersion')),
      ),
    );
  } catch (error) {
    fail(`/registrations/${registrationId}?tab=relationships`, error);
  }
  revalidatePath(`/registrations/${registrationId}`);
  redirect(
    `/registrations/${registrationId}?tab=relationships&success=${encodeURIComponent('Relacionamento removido.')}`,
  );
}

export async function reviewRegistrationCandidateAction(data: FormData): Promise<void> {
  const candidateId = text(data, 'candidateId');
  const action = text(data, 'reviewAction');
  try {
    await executeAuthenticatedRegistrationMutation((gateway) =>
      gateway.reviewCandidate(candidateId, {
        action,
        expectedVersion: Number(text(data, 'expectedVersion')),
        note: text(data, 'note') || null,
        ...(['save-review', 'approve'].includes(action)
          ? { confirmedPayload: registrationReviewPayload(data) }
          : {}),
      }),
    );
  } catch (error) {
    fail(`/registration-reconciliation/${candidateId}`, error);
  }
  revalidatePath('/registrations');
  revalidatePath('/registration-reconciliation');
  revalidatePath(`/registration-reconciliation/${candidateId}`);
  redirect(
    `/registration-reconciliation/${candidateId}?success=${encodeURIComponent(
      action === 'approve' ? 'Candidato aprovado e incluído no Cadastro.' : 'Revisão registrada.',
    )}`,
  );
}

export async function promoteRegistrationCandidateAction(data: FormData): Promise<void> {
  const candidateId = text(data, 'candidateId');
  let promotedRegistrationId = '';
  try {
    const candidate = await executeAuthenticatedRegistrationMutation((gateway) =>
      gateway.promoteCandidate(candidateId, Number(text(data, 'expectedVersion'))),
    );
    if (!candidate.promotedRegistration) {
      throw new RegistrationGatewayError('invalid-response', 'A promoção não retornou o Cadastro.');
    }
    promotedRegistrationId = candidate.promotedRegistration.id;
  } catch (error) {
    fail(`/registration-reconciliation/${candidateId}`, error);
  }
  revalidatePath('/registrations');
  revalidatePath('/registration-reconciliation');
  revalidatePath('/registrations');
  redirect(
    `/registrations/${promotedRegistrationId}?success=${encodeURIComponent(
      'Candidato promovido ao Cadastro oficial.',
    )}`,
  );
}

export async function createRegistrationTagAction(input: { name: string; color?: string }) {
  try {
    const tag = await executeAuthenticatedRegistrationMutation((gateway) =>
      gateway.createTag(input),
    );
    revalidatePath('/registrations');
    return { success: true as const, tag };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof RegistrationGatewayError
          ? error.message
          : 'Não foi possível criar o marcador.',
    };
  }
}
