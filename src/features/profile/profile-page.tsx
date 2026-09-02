'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, LoaderCircle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { TenantProfile } from '@/features/tenant-administration/domain';
import { publishCurrentUserProfilePicture } from '@/shared/current-user-avatar';
import { formatActionResultDescription } from '@/shared/lib/action-result-feedback';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/toast';

import { changeOwnPasswordAction, updateProfilePictureAction } from './profile-actions';
import { prepareProfilePicture } from './profile-picture-client';
import { ownPasswordSchema, type OwnPasswordForm, type ProfilePictureForm } from './profile-schema';

export function ProfilePage({ profile }: { readonly profile: TenantProfile }) {
  const { push: pushRoute } = useRouter();
  const [picture, setPicture] = useState(profile.profilePictureDataUrl);
  const [picturePending, setPicturePending] = useState(false);
  const pictureForm = useForm<ProfilePictureForm>({
    defaultValues: { dataUrl: picture },
  });
  const passwordForm = useForm<OwnPasswordForm>({
    resolver: zodResolver(ownPasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmation: '',
    },
  });
  const initials = profile.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  async function savePicture(dataUrl: string | null) {
    setPicturePending(true);
    const result = await updateProfilePictureAction({ dataUrl });
    toast.add({
      title: result.success ? 'Perfil atualizado' : 'Atualização não concluída',
      description: formatActionResultDescription(result),
      type: result.success ? 'success' : 'error',
    });
    if (result.success) {
      setPicture(dataUrl);
      pictureForm.setValue('dataUrl', dataUrl);
      publishCurrentUserProfilePicture(profile.id, dataUrl);
    }
    setPicturePending(false);
  }

  const submitPassword = passwordForm.handleSubmit(async (values) => {
    const result = await changeOwnPasswordAction(values);
    toast.add({
      title: result.success ? 'Senha alterada' : 'Alteração não concluída',
      description: formatActionResultDescription(result),
      type: result.success ? 'success' : 'error',
    });
    if (result.success) pushRoute('/login');
  });

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-medium text-primary-emphasis">Conta</p>
        <h1 className="text-3xl font-bold tracking-tight">Meu perfil</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Foto e dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="size-24" size="lg">
                {picture ? <AvatarImage src={picture} alt="" /> : null}
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={picturePending}
                  render={<label htmlFor="profile-picture" />}
                  nativeButton={false}
                >
                  <Camera />
                  Escolher foto
                </Button>
                <input
                  id="profile-picture"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-describedby="profile-picture-requirements"
                  onChange={async (event) => {
                    const input = event.currentTarget;
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      await savePicture(await prepareProfilePicture(file));
                    } catch (error) {
                      toast.add({
                        title: 'Imagem não aceita',
                        description:
                          error instanceof Error ? error.message : 'Selecione outra imagem.',
                        type: 'error',
                      });
                    } finally {
                      input.value = '';
                    }
                  }}
                />
                {picture ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={picturePending}
                    onClick={() => savePicture(null)}
                  >
                    <Trash2 />
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
            <p id="profile-picture-requirements" className="text-sm text-muted-foreground">
              JPEG, PNG ou WebP. Dimensões entre 128 × 128 e 2048 × 2048 pixels. Tamanho máximo de
              512 KB.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Nome</dt>
                <dd className="mt-1 text-sm font-medium">{profile.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Usuário</dt>
                <dd className="mt-1 text-sm font-medium">{profile.username}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-muted-foreground">E-mail</dt>
                <dd className="mt-1 text-sm font-medium">{profile.email}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alterar senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitPassword} className="space-y-4" noValidate>
              <Field data-invalid={Boolean(passwordForm.formState.errors.currentPassword)}>
                <FieldLabel htmlFor="current-password">Senha atual</FieldLabel>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  className="h-11"
                  {...passwordForm.register('currentPassword')}
                />
                <FieldError errors={[passwordForm.formState.errors.currentPassword]} />
              </Field>
              <Field data-invalid={Boolean(passwordForm.formState.errors.newPassword)}>
                <FieldLabel htmlFor="own-new-password">Nova senha</FieldLabel>
                <Input
                  id="own-new-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-11"
                  {...passwordForm.register('newPassword')}
                />
                <FieldDescription>
                  Use ao menos 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.
                </FieldDescription>
                <FieldError errors={[passwordForm.formState.errors.newPassword]} />
              </Field>
              <Field data-invalid={Boolean(passwordForm.formState.errors.confirmation)}>
                <FieldLabel htmlFor="own-password-confirmation">Confirmar nova senha</FieldLabel>
                <Input
                  id="own-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  className="h-11"
                  {...passwordForm.register('confirmation')}
                />
                <FieldError errors={[passwordForm.formState.errors.confirmation]} />
              </Field>
              <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                {passwordForm.formState.isSubmitting ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                Alterar senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
