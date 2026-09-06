'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { executeWhatsAppChannelAction, loadWhatsAppChannelPairingAction } from '../actions';
import {
  whatsappChannelQrDataUrl,
  type ManagedWhatsAppChannel,
  type WhatsAppChannelQrCode,
} from '../domain';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

export function WhatsAppChannelPairingDialog({
  channelId,
  initialQrCode,
  onClose,
  onConnected,
}: {
  readonly channelId: string;
  readonly initialQrCode: WhatsAppChannelQrCode | null;
  readonly onClose: () => void;
  readonly onConnected: (channel: ManagedWhatsAppChannel) => void;
}) {
  const [qrCode, setQrCode] = useState(initialQrCode);
  const [message, setMessage] = useState('Aguardando leitura do QR code no celular.');
  const [attempt, setAttempt] = useState(0);
  const [stopped, setStopped] = useState(false);
  const callbacks = useRef({ onConnected });
  useEffect(() => {
    callbacks.current = { onConnected };
  }, [onConnected]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 180_000;
    async function poll() {
      if (!active) return;
      if (Date.now() >= deadline) {
        setQrCode(null);
        setMessage('A sessão de leitura expirou. Atualize o código para tentar novamente.');
        setStopped(true);
        return;
      }
      try {
        const result = await loadWhatsAppChannelPairingAction(channelId);
        if (!active) return;
        if (!result.success) {
          setQrCode(null);
          setMessage(result.message);
          setStopped(true);
          return;
        }
        const { pairing } = result;
        if (pairing.connectionStatus === 'connected') {
          setQrCode(null);
          setMessage('Conexão confirmada. Atualizando o canal…');
          const synchronized = await executeWhatsAppChannelAction({
            channelId,
            action: 'synchronize-connection',
            commandId: globalThis.crypto.randomUUID(),
            expectedVersion: pairing.channel.version,
          });
          if (!active) return;
          if (
            synchronized.success &&
            synchronized.operation.channel.connectionStatus === 'connected'
          ) {
            callbacks.current.onConnected(synchronized.operation.channel);
            return;
          }
          setMessage('A conexão foi detectada. Aguardando a atualização do canal…');
        } else if (pairing.providerIssue) {
          setQrCode(null);
          setMessage(pairing.providerIssue.message);
          setStopped(true);
          return;
        } else {
          setQrCode(pairing.qrCode);
          setMessage(
            pairing.qrCode
              ? 'Aguardando leitura do QR code no celular. O código é atualizado automaticamente.'
              : 'Aguardando um novo QR code do WhatsApp…',
          );
        }
      } catch {
        if (!active) return;
        setQrCode(null);
        setMessage(
          'Não foi possível atualizar a conexão. Atualize o código para tentar novamente.',
        );
        setStopped(true);
        return;
      }
      if (active)
        timer = setTimeout(() => {
          void poll();
        }, 8_000);
    }
    timer = setTimeout(() => {
      void poll();
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [channelId, attempt]);

  function retry() {
    setQrCode(null);
    setStopped(false);
    setMessage('Solicitando um QR code atualizado…');
    setAttempt((value) => value + 1);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Conectar ao WhatsApp</DialogTitle>
          <DialogDescription>
            No celular, abra WhatsApp → Dispositivos conectados → Conectar dispositivo e escaneie o
            código.
          </DialogDescription>
        </DialogHeader>
        {qrCode ? (
          <div className="mx-auto max-w-full rounded-xl border bg-white p-3">
            <Image
              src={whatsappChannelQrDataUrl(qrCode)}
              alt="QR code para conectar o canal WhatsApp"
              width={280}
              height={280}
              className="h-auto max-w-full"
              unoptimized
            />
          </div>
        ) : null}
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {stopped ? (
            <Button type="button" onClick={retry}>
              Atualizar código
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
