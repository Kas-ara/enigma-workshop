import { alphabet, index, models, reflectors, rotors, rotorOptions, type ModelId, type Reflector } from './models/service';
export { alphabet, models, rotorOptions, type ModelId, type Reflector } from './models/service';

export interface Settings {
  modelId: ModelId;
  wheels: string[];
  rings: string[];
  positions: string[];
  reflector: Reflector;
  plugs: string;
}

type ErrorCode = 'reflector' | 'rotors' | 'letters' | 'plugCount' | 'plugFormat' | 'plugDuplicate' | 'key';

export class SettingsError extends Error {
  constructor(readonly code: ErrorCode, readonly rotorSlots: readonly number[] = []) {
    super(code);
    this.name = 'SettingsError';
  }
}

export type Stage = 'plug' | 'entry' | 'forward' | 'reflector' | 'reverse';
export interface Contact {
  stage: Stage;
  label: string;
  from: string;
  to: string;
}
export interface Trace {
  input: string;
  output: string;
  before: readonly string[];
  positions: readonly string[];
  path: Contact[];
}

const mod = (value: number): number => (value + 26) % 26;
const isLetter = (letter: string): boolean => /^[A-Z]$/.test(letter);

export function defaults(modelId: ModelId): Settings {
  const model = models[modelId];
  return {
    modelId, wheels: [...model.defaultWheels], reflector: model.reflectors[0],
    rings: Array(model.slots).fill('A'), positions: Array(model.slots).fill('A'), plugs: '',
  };
}

function plugboard(source: string): number[] {
  const tokens = source.toUpperCase().trim().split(/[\s,]+/).filter(Boolean);
  const contacts = [...alphabet].map(index);
  const used = new Set<string>();
  if (tokens.length > 13) throw new SettingsError('plugCount');
  for (const token of tokens) {
    const [left, right] = token;
    if (!/^[A-Z]{2}$/.test(token) || left === right) throw new SettingsError('plugFormat');
    if (used.has(left) || used.has(right)) throw new SettingsError('plugDuplicate');
    used.add(left).add(right);
    contacts[index(left)] = index(right);
    contacts[index(right)] = index(left);
  }
  return contacts;
}

export function createState(config: Settings) {
  const { modelId, wheels, rings, positions, reflector, plugs } = config;
  const model = models[modelId];
  if (!model.reflectors.includes(reflector)) throw new SettingsError('reflector');
  const invalidSlots = wheels.flatMap((wheel, slot) => {
    const repeated = wheels.indexOf(wheel) !== wheels.lastIndexOf(wheel);
    return repeated || !rotorOptions(modelId, slot).includes(wheel) ? [slot] : [];
  });
  if (wheels.length !== model.slots || invalidSlots.length) throw new SettingsError('rotors', invalidSlots);
  if (rings.length !== model.slots || positions.length !== model.slots ||
    !rings.every(isLetter) || !positions.every(isLetter)) throw new SettingsError('letters');
  return {
    machine: {
      wheels: wheels.map((name, slot) => ({ name, ring: index(rings[slot]), ...rotors[name] })),
      contacts: plugboard(plugs), reflector, reflectorWiring: reflectors[reflector],
      entryToRotors: [...alphabet].map((letter) => model.entryWheel.indexOf(letter)),
      entryToKeys: [...model.entryWheel].map(index),
      advance: model.advance,
    },
    positions: positions.map(index),
  };
}

export type State = ReturnType<typeof createState>;

export function step(state: State, letter: string, trace: true): { state: State; output: string; trace: Trace };
export function step(state: State, letter: string, trace?: false): { state: State; output: string };
export function step(state: State, letter: string, trace: boolean = false): { state: State; output: string; trace?: Trace } {
  if (!isLetter(letter)) throw new SettingsError('key');
  const { machine } = state;
  const { wheels, contacts, reflector, reflectorWiring, entryToRotors, entryToKeys, advance } = machine;
  const positions = advance(state.positions, wheels);
  const right = wheels.length - 1;

  let value = index(letter);
  const path: Contact[] = [];
  function pass(stage: Stage, label: string, result: number) {
    if (trace) path.push({ stage, label, from: alphabet[value], to: alphabet[result] });
    value = result;
  }
  function cross(slot: number, direction: 'forward' | 'reverse') {
    const wheel = wheels[slot];
    const offset = positions[slot] - wheel.ring;
    pass(direction, wheel.name, mod(wheel[direction][mod(value + offset)] - offset));
  }
  pass('plug', '', contacts[value]);
  pass('entry', '', entryToRotors[value]);
  for (let slot = right; slot >= 0; slot -= 1) cross(slot, 'forward');
  pass('reflector', reflector, reflectorWiring[value]);
  for (let slot = 0; slot <= right; slot += 1) cross(slot, 'reverse');
  pass('entry', '', entryToKeys[value]);
  pass('plug', '', contacts[value]);

  const output = alphabet[value];
  const next = { machine, positions };
  return trace ? { state: next, output, trace: {
    input: letter, output, before: state.positions.map((position) => alphabet[position]),
    positions: positions.map((position) => alphabet[position]), path,
  } } : { state: next, output };
}

export function encodeText(state: State, letters: string) {
  let output = '';
  for (const letter of letters) {
    const result = step(state, letter);
    state = result.state;
    output += result.output;
  }
  return { state, output };
}
