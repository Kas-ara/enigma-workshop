// Mechanical keyboards take only A–Z. This is an editor policy, not a cipher rule.
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[œŒ]/g, 'OE').replace(/[æÆ]/g, 'AE').toUpperCase().replace(/[^A-Z]/g, '');
}

// Restore spaces for display while keeping the processed letters separate.
export function withWordSpaces(source: string, letters: string): string {
  let offset = 0;
  let formatted = '';
  for (const part of source.split(/( +)/)) {
    if (part.startsWith(' ')) {
      formatted += part;
      continue;
    }
    const end = offset + normalize(part).length;
    formatted += letters.slice(offset, end);
    if (end > letters.length) break;
    offset = end;
  }
  return formatted;
}
