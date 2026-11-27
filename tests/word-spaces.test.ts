import { expect, test } from 'vitest';
import { withWordSpaces } from '../src/ui/normalize';

test('word spaces stay aligned with the normalized output letters', () => {
  expect(withWordSpaces(' Œ A-ß  ', 'ABCDE')).toBe(' AB CDE  ');
  expect(withWordSpaces('A  B C', 'D')).toBe('D  ');
});
