// Mechanical keyboards take only A–Z. This is an editor policy, not a cipher rule.
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[œŒ]/g, 'OE').replace(/[æÆ]/g, 'AE').toUpperCase().replace(/[^A-Z]/g, '');
}
