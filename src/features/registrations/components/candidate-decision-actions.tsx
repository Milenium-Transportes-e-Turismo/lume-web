'use client';

import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';

export function CandidateDecisionActions({ formId }: { readonly formId: string }) {
  const [ignoreOpen, setIgnoreOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="submit"
          form={formId}
          name="reviewAction"
          value="mark-unidentified"
          variant="outline"
          formNoValidate
        >
          Não identificado
        </Button>
        <Button type="button" variant="outline" onClick={() => setIgnoreOpen(true)}>
          Ignorar
        </Button>
        <Button
          type="submit"
          form={formId}
          name="reviewAction"
          value="save-review"
          variant="secondary"
          formNoValidate
        >
          Salvar revisão
        </Button>
        <Button type="submit" form={formId} name="reviewAction" value="approve">
          Aprovar candidato
        </Button>
      </div>

      <AlertDialog open={ignoreOpen} onOpenChange={setIgnoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignorar este candidato?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro continuará preservado e auditável, mas sairá da fila principal. Use “Não
              identificado” quando os dados puderem ser úteis em uma revisão futura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </AlertDialogClose>
            <Button
              type="submit"
              form={formId}
              name="reviewAction"
              value="ignore"
              variant="destructive"
              formNoValidate
            >
              Confirmar e ignorar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PromoteCandidateButton({ formId }: { readonly formId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="w-full" type="button" onClick={() => setOpen(true)}>
        Promover Cadastro
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover ao Cadastro oficial?</AlertDialogTitle>
            <AlertDialogDescription>
              As identidades e os relacionamentos confirmados serão criados juntos. Depois da
              promoção, este candidato não poderá ser promovido novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="outline" />}>
              Voltar à revisão
            </AlertDialogClose>
            <Button type="submit" form={formId}>
              Confirmar promoção
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function RemoveRelationshipButton({
  formId,
  relatedName,
}: {
  readonly formId: string;
  readonly relatedName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Remover vínculo
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este relacionamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O vínculo com {relatedName} será inativado e a alteração ficará registrada no
              histórico. Os Cadastros não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </AlertDialogClose>
            <Button type="submit" form={formId} variant="destructive">
              Confirmar remoção
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
