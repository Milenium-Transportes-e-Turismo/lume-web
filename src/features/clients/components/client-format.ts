export function formatClientDocument(value: string | null): string {
  if (!value) return 'Não informado';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14)
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return value;
}

export function formatClientPhone(value: string | null): string {
  if (!value) return 'Não informado';
  const local = value.replace(/\D/g, '').replace(/^55/, '');
  if (local.length === 11) return local.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (local.length === 10) return local.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return value;
}

export function clientDisplayName(client: {
  clientType: 'pf' | 'pj';
  individualName: string | null;
  tradeName: string | null;
  legalName: string;
}): string {
  return client.clientType === 'pf'
    ? client.individualName || 'Cliente pessoa física'
    : client.tradeName || client.legalName;
}
