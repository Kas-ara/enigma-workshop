export type ModelId = 'I' | 'M3' | 'M4';

export const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const keyboardRows = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'] as const;
const wheelNames = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const rotorWiring: Record<string, readonly [wiring: string, notches: string]> = {
  I: ['EKMFLGDQVZNTOWYHXUSPAIBRCJ', 'Q'],
  II: ['AJDKSIRUXBLHWTMCQGZNPYFVOE', 'E'],
  III: ['BDFHJLCPRTXVZNYEIWGAKMUSQO', 'V'],
  IV: ['ESOVPZJAYQUIRHXLNFTGKDCMWB', 'J'],
  V: ['VZBRGITYUPSDNHLXAWMJQOFECK', 'Z'],
  VI: ['JPGVOUMFYQBENHZRDKASXLICTW', 'ZM'],
  VII: ['NZJHGRCXMYSWBOUFAIVLPEKQDT', 'ZM'],
  VIII: ['FKQHTLXOCBJSPDZRAMEWNIUYGV', 'ZM'],
  'β': ['LEYJVCNIXWPBQMDRTAKZGFUHOS', ''],
  'γ': ['FSOKANUERHMBTIYCWLQPZXVGJD', ''],
};

const reflectorWiring = {
  A: 'EJMZALYXVBWFCRQUONTSPIKHGD',
  B: 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
  C: 'FVPJIAOYEDRZXWGCTKUQSBNMHL',
  'B-thin': 'ENKQAUYWJICOPBLMDXZVFTHRGS',
  'C-thin': 'RDOBJNTKVEHMLFCWZAXGYIPSUQ',
};

export type Reflector = keyof typeof reflectorWiring;
export const index = (letter: string): number => alphabet.indexOf(letter);
export const rotors = Object.fromEntries(Object.entries(rotorWiring).map(([name, [wiring, notches]]) => [
  name, {
    notches,
    forward: [...wiring].map(index),
    reverse: [...alphabet].map((letter) => wiring.indexOf(letter)),
  },
]));
export const reflectors = Object.fromEntries(Object.entries(reflectorWiring).map(([name, wiring]) => [
  name, [...wiring].map(index),
]));

function advancePawls(current: readonly number[], wheels: readonly { notches: string }[]) {
  const positions = [...current];
  const right = positions.length - 1;
  const middle = right - 1;
  const left = middle - 1;
  const middleAtNotch = wheels[middle].notches.includes(alphabet[positions[middle]]);
  const rightAtNotch = wheels[right].notches.includes(alphabet[positions[right]]);
  if (middleAtNotch) positions[left] = (positions[left] + 1) % alphabet.length;
  if (middleAtNotch || rightAtNotch) positions[middle] = (positions[middle] + 1) % alphabet.length;
  positions[right] = (positions[right] + 1) % alphabet.length;
  return positions;
}

interface MachineModel {
  name: string;
  year: string;
  slots: number;
  defaultWheels: string[];
  reflectors: Reflector[];
  selectable: number;
  entryWheel: string;
  advance: typeof advancePawls;
}

export const models: Record<ModelId, MachineModel> = {
  I: { name: 'Enigma I', year: '1930', slots: 3, defaultWheels: ['I', 'II', 'III'],
    reflectors: ['B', 'A', 'C'], selectable: 5, entryWheel: alphabet, advance: advancePawls },
  M3: { name: 'Enigma M3', year: '1939', slots: 3, defaultWheels: ['II', 'IV', 'VI'],
    reflectors: ['B', 'C'], selectable: 8, entryWheel: alphabet, advance: advancePawls },
  M4: { name: 'Enigma M4', year: '1942', slots: 4, defaultWheels: ['β', 'I', 'II', 'III'],
    reflectors: ['B-thin', 'C-thin'], selectable: 8, entryWheel: alphabet, advance: advancePawls },
};

export function rotorOptions(modelId: ModelId, slot: number): string[] {
  if (modelId === 'M4' && slot === 0) return ['β', 'γ'];
  return wheelNames.slice(0, models[modelId].selectable);
}
