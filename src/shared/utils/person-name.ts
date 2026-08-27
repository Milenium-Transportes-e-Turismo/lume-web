const LOWERCASE_PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

function capitalizeWord(value: string): string {
  return value.replace(/(^|[-'\u2019])(\p{L})/gu, (_, prefix: string, letter: string) => {
    return `${prefix}${letter.toLocaleUpperCase('pt-BR')}`;
  });
}

export function formatPersonName(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((part, index) =>
      index > 0 && LOWERCASE_PARTICLES.has(part) ? part : capitalizeWord(part),
    )
    .join(' ');
}
