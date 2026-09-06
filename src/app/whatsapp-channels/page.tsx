import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { hasPermission } from '@/features/auth/domain';
import { getCurrentAuthenticatedSession } from '@/features/auth/server';
import { AuthenticatedShell } from '@/features/navigation';
import { WhatsAppChannelGatewayError } from '@/features/whatsapp-channels/application';
import { WhatsAppChannelManagement } from '@/features/whatsapp-channels/components';
import { executeAuthenticatedWhatsAppChannelRequest } from '@/features/whatsapp-channels/server';

export const metadata: Metadata = {
  title: 'Canais WhatsApp | Lume',
  description: 'Administração dos canais WhatsApp do tenant.',
};

export default async function WhatsAppChannelsPage() {
  const session = await getCurrentAuthenticatedSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.user, 'whatsapp-channels:view')) redirect('/dashboard');

  const { channels, initialError } = await executeAuthenticatedWhatsAppChannelRequest((gateway) =>
    gateway.list(),
  )
    .then((loadedChannels) => ({ channels: loadedChannels, initialError: '' }))
    .catch((error: unknown) => {
      if (error instanceof WhatsAppChannelGatewayError && error.code === 'unauthorized') {
        redirect('/auth/session-expired');
      }
      return {
        channels: [],
        initialError:
          error instanceof WhatsAppChannelGatewayError
            ? `${error.message} Código do erro: ${error.publicCode}.`
            : 'Não foi possível carregar os canais WhatsApp.',
      };
    });

  const { departments, departmentError } = await executeAuthenticatedWhatsAppChannelRequest(
    (gateway) => gateway.listDepartments(),
  )
    .then((departments) => ({ departments, departmentError: '' }))
    .catch(() => ({
      departments: [],
      departmentError:
        'Não foi possível carregar os departamentos. Recarregue a página para provisionar ou editar canais.',
    }));

  return (
    <AuthenticatedShell user={session.user}>
      <div className="lume-page ">
        <WhatsAppChannelManagement
          initialChannels={channels}
          initialError={[initialError, departmentError].filter(Boolean).join(' ')}
          departments={departments}
          permissions={{
            canView: hasPermission(session.user, 'whatsapp-channels:view'),
            canCreate: hasPermission(session.user, 'whatsapp-channels:create'),
            canManage: hasPermission(session.user, 'whatsapp-channels:manage'),
            canConnect: hasPermission(session.user, 'whatsapp-channels:connect'),
            canDisconnect: hasPermission(session.user, 'whatsapp-channels:disconnect'),
            isAdministrator: session.user.isAdministrator === true,
          }}
        />
      </div>
    </AuthenticatedShell>
  );
}
