import { cva } from 'class-variance-authority';

export const whatsAppConversationsPageStyles = {
  content: cva('h-[calc(100dvh-3.5rem)] min-h-[34rem] w-full min-w-0 overflow-hidden p-0'),

  eyebrow: cva('text-sm font-semibold text-primary-emphasis'),

  title: cva('mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl'),

  description: cva('mt-1 max-w-3xl text-sm leading-5 text-muted-foreground'),
};
