/**
 * Pesos utilizados no cálculo dos dígitos verificadores do CNPJ.
 */
const FIRST_CHECK_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const SECOND_CHECK_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Remove a máscara e padroniza as letras em maiúsculas.
 *
 * Aceita tanto o CNPJ numérico quanto o novo CNPJ alfanumérico.
 *
 * @example
 * normalizeCnpj("12.345.678/0001-90");
 * // "12345678000190"
 *
 * @example
 * normalizeCnpj("34.6nc.d4e/0001-92");
 * // "346NCD4E000192"
 */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Aplica a máscara visual do CNPJ.
 *
 * @example
 * formatCnpj("12345678000190");
 * // "12.345.678/0001-90"
 *
 * @example
 * formatCnpj("346NCD4E000192");
 * // "34.6NC.D4E/0001-92"
 */
export function formatCnpj(value: string): string {
  const cnpj = normalizeCnpj(value).slice(0, 14);

  if (cnpj.length !== 14) {
    return cnpj;
  }

  return cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/** Aplica a máscara progressivamente ao CNPJ numérico ou alfanumérico. */
export function formatCnpjInput(value: string): string {
  const cnpj = normalizeCnpj(value).slice(0, 14);
  if (cnpj.length <= 2) return cnpj;
  if (cnpj.length <= 5) return `${cnpj.slice(0, 2)}.${cnpj.slice(2)}`;
  if (cnpj.length <= 8) {
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5)}`;
  }
  if (cnpj.length <= 12) {
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8)}`;
  }
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

/**
 * Converte um caractere do CNPJ para o valor usado no cálculo.
 *
 * A Receita Federal utiliza o código ASCII do caractere menos 48.
 *
 * Exemplos:
 * 0 = 0
 * 9 = 9
 * A = 17
 * B = 18
 */
function getCharacterValue(character: string): number {
  return character.charCodeAt(0) - 48;
}

function calculateCheckDigit(characters: string, weights: number[]): number {
  const total = characters.split('').reduce((sum, character, index) => {
    return sum + getCharacterValue(character) * weights[index];
  }, 0);

  const remainder = total % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Verifica a estrutura e os dígitos verificadores do CNPJ.
 *
 * Suporta:
 * - CNPJ numérico tradicional;
 * - CNPJ alfanumérico.
 */
export function validateCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);

  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) {
    return false;
  }

  if (/^(.)\1{13}$/.test(cnpj)) {
    return false;
  }

  const base = cnpj.slice(0, 12);

  const firstCheckDigit = calculateCheckDigit(base, FIRST_CHECK_DIGIT_WEIGHTS);

  const secondCheckDigit = calculateCheckDigit(
    `${base}${firstCheckDigit}`,
    SECOND_CHECK_DIGIT_WEIGHTS,
  );

  const expectedCheckDigits = `${firstCheckDigit}${secondCheckDigit}`;

  return cnpj.slice(-2) === expectedCheckDigits;
}
