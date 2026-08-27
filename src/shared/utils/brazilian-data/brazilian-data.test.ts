import {
  formatCnpj,
  formatCnpjInput,
  formatCpf,
  formatCpfInput,
  formatPhone,
  normalizeCnh,
  normalizeCnpj,
  normalizeCpf,
  normalizePhone,
  normalizeRg,
  onlyDigits,
  validateCnh,
  validateCnpj,
  validateCpf,
  validatePhone,
} from '.';

describe('onlyDigits', () => {
  it('deve remover todos os caracteres que não sejam números', () => {
    expect(onlyDigits('(34) 99999-9999')).toBe('34999999999');
  });
});

describe('CPF', () => {
  it('deve normalizar um CPF', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
  });

  it('deve formatar um CPF', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });

  it('deve aplicar a máscara enquanto o CPF é digitado', () => {
    expect(formatCpfInput('5299822')).toBe('529.982.2');
  });

  it('deve aceitar um CPF válido', () => {
    expect(validateCpf('529.982.247-25')).toBe(true);
  });

  it('deve rejeitar um CPF inválido', () => {
    expect(validateCpf('111.111.111-11')).toBe(false);
  });
});

describe('CNPJ', () => {
  it('deve normalizar um CNPJ numérico', () => {
    expect(normalizeCnpj('04.252.011/0001-10')).toBe('04252011000110');
  });

  it('deve normalizar um CNPJ alfanumérico', () => {
    expect(normalizeCnpj('34.6nc.d4e/0001-92')).toBe('346NCD4E000192');
  });

  it('deve formatar um CNPJ numérico', () => {
    expect(formatCnpj('04252011000110')).toBe('04.252.011/0001-10');
  });

  it('deve formatar um CNPJ alfanumérico', () => {
    expect(formatCnpj('346NCD4E000192')).toBe('34.6NC.D4E/0001-92');
  });

  it('deve aplicar a máscara enquanto o CNPJ é digitado', () => {
    expect(formatCnpjInput('346ncd4e0001')).toBe('34.6NC.D4E/0001');
  });

  it('deve aceitar um CNPJ numérico válido', () => {
    expect(validateCnpj('04.252.011/0001-10')).toBe(true);
  });

  it('deve aceitar um CNPJ alfanumérico válido', () => {
    expect(validateCnpj('34.6NC.D4E/0001-92')).toBe(true);
  });

  it('deve rejeitar um CNPJ inválido', () => {
    expect(validateCnpj('11.111.111/1111-11')).toBe(false);
  });
});

describe('telefone', () => {
  it('deve normalizar um telefone', () => {
    expect(normalizePhone('(34) 99999-9999')).toBe('34999999999');
  });

  it('deve formatar um celular com DDD', () => {
    expect(formatPhone('34999999999')).toBe('(34) 99999-9999');
  });

  it('deve formatar um celular com código do Brasil', () => {
    expect(formatPhone('5534999999999')).toBe('+55 (34) 99999-9999');
  });

  it('deve aceitar um telefone válido', () => {
    expect(validatePhone('(34) 99999-9999')).toBe(true);
  });

  it('deve rejeitar um celular sem o nono dígito', () => {
    expect(validatePhone('(34) 89999-9999')).toBe(false);
  });
});

describe('CNH', () => {
  it('deve normalizar uma CNH', () => {
    expect(normalizeCnh('012 345 678 07')).toBe('01234567807');
  });

  it('deve aceitar uma CNH com dígitos verificadores válidos', () => {
    expect(validateCnh('01234567807')).toBe(true);
  });

  it('deve rejeitar uma CNH inválida', () => {
    expect(validateCnh('11111111111')).toBe(false);
  });
});

describe('RG', () => {
  it('deve remover a formatação e preservar letras', () => {
    expect(normalizeRg('12.345.678-X')).toBe('12345678X');
  });

  it('deve preservar a sigla do estado quando informada', () => {
    expect(normalizeRg('18.787.6-5 MG')).toBe('1878765MG');
  });
});
