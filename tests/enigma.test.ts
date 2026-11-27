import { expect, test } from 'vitest';
import { alphabet, createState, defaults, encodeText, models, rotorOptions, SettingsError, step, type ModelId, type Settings } from '../src/engine/enigma';
import { normalize } from '../src/ui/normalize';

const transform = (settings: Settings, message: string) => encodeText(createState(settings), message).output;

test('Enigma I reference setting and ring offset', () => {
  const config = defaults('I');
  expect(transform(config, 'AAAAA')).toBe('BDZGO');
  expect(transform(config, 'BDZGO')).toBe('AAAAA');
  expect(transform({ ...config, rings: [...'BBB'] }, 'AAAAA')).toBe('EWTYX');
});

test('authentic 1930 Enigma I manual, indicator and opening', () => {
  // https://cryptocellar.org/enigma/e-message-1930.html
  const config: Settings = { ...defaults('I'), wheels: ['II', 'I', 'III'], reflector: 'A',
    rings: [...'XMV'], positions: [...'FOL'], plugs: 'AM FI NV PS TU WZ' };
  const key = transform(config, 'PKPJXI');
  expect(key).toBe('ABLABL');
  expect(transform({ ...config, positions: [...key.slice(0, 3)] }, 'GCDSEAHUGWTQGRK')).toBe('FEINDLIQEINFANT');
});

test('authentic M4 signal from U-264, with a stationary Beta rotor', () => {
  // https://www.bytereef.org/m4-project-first-break.html
  const config = { ...defaults('M4'), wheels: ['β', 'II', 'IV', 'I'],
    rings: [...'AAAV'], positions: [...'VJNA'], plugs: 'AT BL DF GJ HM NW OP QY RZ VX' };
  const result = encodeText(createState(config), 'NCZWVUSXPNYMINHZXMQX');
  expect(result.output).toBe('VONVONJLOOKSJHFFTTTE');
  expect(alphabet[result.state.positions[0]]).toBe('V');
});

test('a compatible M4 reproduces the M3 result', () => {
  const common = { rings: [...'KBC'], positions: [...'RZM'], plugs: 'GS AP DV EH' };
  const wheels = ['VI', 'VIII', 'VII'];
  const m3 = { ...defaults('M3'), ...common, wheels };
  for (const [greek, reflector, thin] of [['β', 'B', 'B-thin'], ['γ', 'C', 'C-thin']] as const) {
    const m4 = { ...defaults('M4'), wheels: [greek, ...wheels], reflector: thin,
      rings: ['A', ...common.rings], positions: ['A', ...common.positions], plugs: common.plugs };
    expect(transform(m4, 'TESTOFCOMPATIBILITY'.repeat(20)))
      .toBe(transform({ ...m3, reflector }, 'TESTOFCOMPATIBILITY'.repeat(20)));
  }
});

test('double stepping is driven by the visible position, independent of ring settings', () => {
  let state = createState({ ...defaults('I'), positions: [...'ADU'], rings: [...'QWE'] });
  const positions = Array.from({ length: 4 }, () => {
    const result = step(state, 'A', true);
    state = result.state;
    return result.trace.positions.join('');
  });
  expect(positions).toEqual(['ADV', 'AEW', 'BFX', 'BFY']);
});

test('the two naval notches each advance the middle rotor', () => {
  for (const notch of ['M', 'Z']) {
    const state = createState({ ...defaults('M3'), wheels: ['I', 'II', 'VI'], positions: ['A', 'A', notch] });
    expect(step(state, 'A', true).trace.positions[1]).toBe('B');
  }
});

test('reciprocity and no self-encryption across 60 reproducible configurations', () => {
  let seed = 1;
  const pick = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 2 ** 32 * n);
  };
  const slots = (id: ModelId) => Array.from({ length: models[id].slots }, () => alphabet[pick(26)]);
  const plain = alphabet.repeat(4);
  for (const id of ['I', 'M3', 'M4'] as const) {
    for (let trial = 0; trial < 20; trial += 1) {
      const used = new Set<string>();
      const wheels = slots(id).map((_, slot) => {
        const available = rotorOptions(id, slot).filter((wheel) => !used.has(wheel));
        const wheel = available[pick(available.length)];
        used.add(wheel);
        return wheel;
      });
      const reflectors = models[id].reflectors;
      const config = { ...defaults(id), wheels, rings: slots(id), positions: slots(id),
        reflector: reflectors[pick(reflectors.length)], plugs: 'KO TM VX NZ' };
      const cipher = transform(config, plain);
      expect(transform(config, cipher)).toBe(plain);
      expect([...cipher].every((letter, i) => letter !== plain[i])).toBe(true);
    }
  }
});

test('normalization remains a UI policy', () => {
  expect(normalize('À l’aube, cœur et cæcum ! 123')).toBe('ALAUBECOEURETCAECUM');
  expect(normalize('Grüße aus Köln')).toBe('GRUSSEAUSKOLN');
  expect(normalize('Łódź, Øl, groẞ')).toBe('LODZOLGROSS');
  expect(() => encodeText(createState(defaults('I')), 'A!')).toThrow('key');
});

test('invalid settings fail before stepping', () => {
  const config = defaults('I');
  expect(() => createState({ ...config, wheels: ['I', 'I', 'III'] })).toThrow('rotors');
  expect(() => createState({ ...config, reflector: 'B-thin' })).toThrow('reflector');
  expect(() => createState({ ...config, plugs: 'AM AB' })).toThrow('plugDuplicate');
  expect(() => createState({ ...config, plugs: 'AA' })).toThrow('plugFormat');
  expect(() => createState({ ...config, positions: ['A', '', 'C'] })).toThrow('letters');
});

test('the trace runs from key to lamp without mutating the original state', () => {
  const initial = createState(defaults('M4'));
  const { trace, state } = step(initial, 'R', true);
  expect(initial.positions).toEqual([0, 0, 0, 0]);
  expect(state.positions).toEqual([0, 0, 0, 1]);
  expect(trace.path.filter(({ stage }) => stage === 'forward')).toHaveLength(4);
  expect(trace.path.filter(({ stage }) => stage === 'reverse')).toHaveLength(4);
  expect(trace.path.filter(({ stage }) => stage === 'reflector')).toHaveLength(1);
  expect(trace.path[0].from).toBe(trace.input);
  expect(trace.path.at(-1)?.to).toBe(trace.output);
  for (let i = 1; i < trace.path.length; i += 1) expect(trace.path[i - 1].to).toBe(trace.path[i].from);
});

test.each(['β', 'γ'])('double stepping leaves the M4 Greek rotor %s stationary', (greek) => {
  let state = createState({ ...defaults('M4'), wheels: [greek, 'I', 'II', 'III'], positions: [...'ZADU'] });
  const positions = Array.from({ length: 4 }, () => {
    const result = step(state, 'A', true);
    state = result.state;
    return result.trace.positions.join('');
  });
  expect(positions).toEqual(['ZADV', 'ZAEW', 'ZBFX', 'ZBFY']);
});

test('the plugboard accepts 13 disjoint pairs and rejects a fourteenth', () => {
  const plugs = 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ';
  expect(() => createState({ ...defaults('I'), plugs })).not.toThrow();
  expect(() => createState({ ...defaults('I'), plugs: plugs + ' AB' })).toThrow('plugCount');
});

test('the engine identifies incompatible and repeated rotor slots', () => {
  expect(() => createState({ ...defaults('I'), wheels: ['VI', 'II', 'III'] }))
    .toThrow(expect.objectContaining({ code: 'rotors', rotorSlots: [0] }));
  expect(() => createState({ ...defaults('I'), wheels: ['I', 'I', 'III'] }))
    .toThrow(expect.objectContaining({ code: 'rotors', rotorSlots: [0, 1] }));
  expect(() => createState({ ...defaults('I'), wheels: ['VI', 'II', 'III'] })).toThrow(SettingsError);
});
