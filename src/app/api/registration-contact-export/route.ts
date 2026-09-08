import { WhatsAppConversationRepositoryError } from '@/features/whatsapp-conversations/application';
import { executeAuthenticatedWhatsAppMutation } from '@/features/whatsapp-conversations/server';
import { proxyRegistrationContactExport } from '@/features/whatsapp-contacts/infrastructure/registration-contact-export-gateway';

export const dynamic = 'force-dynamic';

async function proxy(request: Request) {
  try {
    return await executeAuthenticatedWhatsAppMutation((_repository, token) =>
      proxyRegistrationContactExport(token, request),
    );
  } catch (error) {
    const status =
      error instanceof WhatsAppConversationRepositoryError
        ? error.code === 'unauthorized'
          ? 401
          : error.code === 'forbidden'
            ? 403
            : 503
        : 503;
    return Response.json(
      { message: 'Não foi possível acessar a exportação de contatos.' },
      { status },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
