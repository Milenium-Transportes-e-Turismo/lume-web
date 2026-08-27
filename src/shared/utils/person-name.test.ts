import { formatPersonName } from './person-name';

describe('formatPersonName', () => {
  it('normaliza caixa e preserva partículas de nomes em português', () => {
    expect(formatPersonName('  MARIA D\u2019\u00c1VILA DOS SANTOS DE SOUZA  ')).toBe(
      'Maria D\u2019\u00c1vila dos Santos de Souza',
    );
  });
});
