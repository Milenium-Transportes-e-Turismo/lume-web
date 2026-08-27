import { onlyDigits } from './digits';

/**
 * Remove a formatação do CPF.
 *
 * @example
 * normalizeCpf("123.456.789-00");
 * // "12345678900"
 */
export function normalizeCpf(value: string): string {
  return onlyDigits(value);
}

/**
 * Formata um CPF que contenha 11 dígitos.
 *
 * @example
 * formatCpf("12345678900");
 * // "123.456.789-00"
 */
export function formatCpf(value: string): string {
  const cpf = normalizeCpf(value).slice(0, 11);

  if (cpf.length !== 11) {
    return cpf;
  }

  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/** Aplica a máscara progressivamente enquanto o CPF é digitado. */
export function formatCpfInput(value: string): string {
  const cpf = normalizeCpf(value).slice(0, 11);
  if (cpf.length <= 3) return cpf;
  if (cpf.length <= 6) return `${cpf.slice(0, 3)}.${cpf.slice(3)}`;
  if (cpf.length <= 9) {
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6)}`;
  }
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function calculateCheckDigit(cpf: string, factor: number): number {
  let total = 0;

  for (const digit of cpf) {
    if (factor < 2) {
      break;
    }

    total += Number(digit) * factor;
    factor -= 1;
  }

  const remainder = total % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Verifica se o CPF possui estrutura e dígitos verificadores válidos.
 */
export function validateCpf(value: string): boolean {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const firstCheckDigit = calculateCheckDigit(cpf.slice(0, 9), 10);
  const secondCheckDigit = calculateCheckDigit(`${cpf.slice(0, 9)}${firstCheckDigit}`, 11);

  return cpf.endsWith(`${firstCheckDigit}${secondCheckDigit}`);
}
