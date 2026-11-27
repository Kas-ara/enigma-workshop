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

interface MachineModel {
  name: string;
  year: string;
  slots: number;
  defaultWheels: string[];
  reflectors: Reflector[];
  selectable: number;
}

export const models: Record<ModelId, MachineModel> = {
  I: { name: 'Enigma I', year: '1930', slots: 3, defaultWheels: ['I', 'II', 'III'],
    reflectors: ['B', 'A', 'C'], selectable: 5 },
  M3: { name: 'Enigma M3', year: '1939', slots: 3, defaultWheels: ['II', 'IV', 'VI'],
    reflectors: ['B', 'C'], selectable: 8 },
  M4: { name: 'Enigma M4', year: '1942', slots: 4, defaultWheels: ['β', 'I', 'II', 'III'],
    reflectors: ['B-thin', 'C-thin'], selectable: 8 },
};

export function rotorOptions(modelId: ModelId, slot: number): string[] {
  if (modelId === 'M4' && slot === 0) return ['β', 'γ'];
  return wheelNames.slice(0, models[modelId].selectable);
}
