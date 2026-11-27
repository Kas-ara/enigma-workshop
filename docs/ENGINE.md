# Engine contract

## 1. Principles
- Pure functions, explicit state: `step(state, letter, true) → { output, state, trace }`.
- No access to the DOM, time or randomness. Same input, same output.
- Alphabet A–Z in v1; other characters are normalized or dropped by the UI before entering the engine.

## 2. Types (indicative)
```ts
type Letter = number;                // 0..25
interface RotorSpec { id: string; wiring: string; notches: string; }
interface ReflectorSpec { id: string; wiring: string; settable?: boolean; }
interface MachineModel {
  id: string;                        // "enigma-i", "m3", "m4"…
  rotorSlots: number;                // 3 or 4 (the 4th never steps)
  rotors: RotorSpec[]; reflectors: ReflectorSpec[];
  plugboard: boolean;
  stepping: "double-step" | "cog";   // "cog" for Abwehr G
  entryWheel: string;                // ETW: "ABC…" military, "QWERTZ…" commercial
}
interface MachineSettings {
  model: string; reflector: string; rotors: string[];
  rings: number[]; positions: number[]; plugs: [Letter, Letter][];
}
interface StepTrace {
  before: number[]; after: number[]; stepped: boolean[];
  path: { stage: string; in: Letter; out: Letter }[];  // plugboard, ETW, rotors forward, reflector, back
}
```

## 3. Public API
- `createState(settings)` validates the key and returns compiled wiring and initial positions. Invalid keys raise a typed error translated by the interface.
- `step(state, letter, true)` returns the next state, output letter and trace. `encodeText(state, letters)` processes a sequence and returns its output and final state.

## 4. Test vectors
Well-known references (cross-check against a source cited in the test):
- Enigma I, reflector B, rotors I-II-III, rings A-A-A, positions A-A-A, no plugs: `AAAAA` → `BDZGO`.
- Double stepping, rotors I-II-III from `ADU`: `ADV`, `AEW`, `BFX`, `BFY`.
- Reciprocity: decrypting the output returns the input, for random settings (property test, fixed seed).
- No letter ever encrypts to itself.
- M4 with Beta at A and reflector B-thin equals M3 with reflector B (same rotors, rings, positions).
Historical test excerpts and full settings come from the 1930 manual and a U-264 message. See the [source register](CREDITS.md) and [engine tests](../tests/enigma.test.ts).
