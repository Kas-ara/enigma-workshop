import './style.css';
import * as engine from '../engine/enigma';
import { type Contact, type ModelId, type Reflector, type Settings, type State, type Trace } from '../engine/enigma';
import { localize, t, type MessageKey } from '../i18n';
import { normalize } from './normalize';
import type { MachineScene } from '../scene3d/machine';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('input');
const output = $<HTMLTextAreaElement>('output');
const feedback = $('feedback');
const canvas = $<HTMLCanvasElement>('machine');
const theme = $<HTMLSelectElement>('theme');
const language = $<HTMLSelectElement>('language');
const reflector = $<HTMLSelectElement>('reflector');
const plugs = $<HTMLInputElement>('plugs');
const fallback = $('scene-fallback');
const modelButtons = new Map<ModelId, HTMLButtonElement>();
const alphabet = [...engine.alphabet];

let scene: MachineScene | null = null;
let exploded = false;
let modelId: ModelId = 'I';
let mode: 'encode' | 'decode' = 'encode';
let settings: HTMLSelectElement[][] = [];
let session: State | null = null;
let cursor = 0;
let processed = '';
let last: Trace | null = null;
let timer: number | null = null;
let displayFeedback: { key: MessageKey; vars?: Record<string, string | number> } | null = null;
let errorKey: MessageKey | null = null;

const labelPosition = (letter: string) => modelId === 'I'
  ? String(engine.alphabet.indexOf(letter) + 1).padStart(2, '0') : letter;
const windowsText = (letters: readonly string[]) => letters.map(labelPosition).join(' · ');
const reflectorName = (value: string) => value === 'B-thin' ? t('bThin') : value === 'C-thin' ? t('cThin') : value;
const isModelId = (id: string): id is ModelId => Object.hasOwn(engine.models, id);

function readPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function savePreference(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Optional when storage is blocked. */ }
}

function applyTheme(value: string) {
  if (![...theme.options].some((option) => option.value === value)) return;
  document.documentElement.dataset.theme = value;
  theme.value = value;
  savePreference('enigma-workshop-theme', value);
  renderScene();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', value?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function options(select: HTMLSelectElement, values: string[], current: string, format = (value: string) => value) {
  select.replaceChildren(...values.map((value) => new Option(format(value), value, false, value === current)));
}

function renderSettings(config: Settings) {
  const grid = $('rotor-settings');
  const columns: HTMLDivElement[] = [];
  grid.style.setProperty('--wheel-count', String(config.wheels.length));
  settings = config.wheels.map((wheel, slot) => {
    const column = el('div', 'rotor-setting');
    const greek = modelId === 'M4' && slot === 0;
    const slotKeys = ['left', 'middle', 'right'] as const;
    const slotName = t(greek ? 'greek' : slotKeys[slot - (modelId === 'M4' ? 1 : 0)]);
    column.append(el('span', 'rotor-title', slotName));
    type Field = [name: MessageKey, values: string[], current: string, format?: (value: string) => string];
    const fields: Field[] = [
      ['rotor', engine.rotorOptions(modelId, slot), wheel],
      ['ring', alphabet, config.rings[slot], (letter) => String(alphabet.indexOf(letter) + 1).padStart(2, '0') + ' · ' + letter],
      ['start', alphabet, config.positions[slot], labelPosition],
    ];
    const selects = fields.map(([key, values, current, format]) => {
      const name = t(key);
      const label = el('label', '', name);
      const select = el('select');
      select.setAttribute('aria-label', name + ' · ' + slotName);
      options(select, values, current, format);
      select.addEventListener('change', invalidate);
      label.append(select);
      column.append(label);
      return select;
    });
    columns.push(column);
    return selects;
  });
  grid.replaceChildren(...columns);
  options(reflector, engine.models[modelId].reflectors, config.reflector, reflectorName);
  plugs.value = config.plugs;
}

function currentConfig(): Settings {
  const columns = settings.map((selects) => selects.map(({ value }) => value));
  return {
    modelId, wheels: columns.map((values) => values[0]), rings: columns.map((values) => values[1]),
    positions: columns.map((values) => values[2]), reflector: reflector.value as Reflector, plugs: plugs.value,
  };
}

function renderModel() {
  const model = engine.models[modelId];
  for (const [id, button] of modelButtons) {
    const entry = engine.models[id];
    button.setAttribute('aria-pressed', String(id === modelId));
    button.replaceChildren(el('span', 'model-date', entry.year), el('strong', '', entry.name),
      el('span', 'model-detail', t('rotorsCount', { count: entry.slots })));
  }
  $('model-use').textContent = t('model' + modelId + 'Use' as MessageKey);
  $('scene-title').textContent = model.name;
  $('scene-index').textContent = t('rotorsMoving', { count: model.slots });
  $('model-description').textContent = t('model' + modelId + 'Detail' as MessageKey);
}

function selectModel(next: ModelId, config = engine.defaults(next)) {
  modelId = next;
  renderModel();
  renderSettings(config);
  invalidate();
}

function renderScene(animate = false) {
  const config = currentConfig();
  const positions = last?.positions ?? config.positions;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  scene?.update({ modelId, positions,
    before: animate ? last?.before ?? positions : positions, input: last?.input, output: last?.output, accent });
  $('windows').replaceChildren(...positions.map((letter, slot) => {
    const changed = last && last.before[slot] !== letter;
    const chip = el('span', changed ? 'advanced' : '', labelPosition(letter));
    chip.title = t('rotor') + ' ' + config.wheels[slot] + ' · ' + letter;
    return chip;
  }));
  $('fallback-key').textContent = last?.input ?? '—';
  $('fallback-positions').textContent = windowsText(positions);
  $('fallback-lamp').textContent = last?.output ?? '—';
}

function contactTitle({ stage, label }: Contact): string {
  switch (stage) {
    case 'plug': return t('plugs');
    case 'entry': return t('entry');
    case 'reflector': return t('reflector') + ' ' + reflectorName(label);
    case 'forward': return t('forward') + ' · ' + label;
    case 'reverse': return t('back') + ' · ' + label;
  }
}

function renderSignal() {
  const path = $('signal-path');
  $('signal-focus').textContent = last ? last.input + ' → ' + last.output : '— → —';
  if (!last) {
    $('signal-note').textContent = t('signalInitial');
    path.replaceChildren();
    return;
  }
  const before = windowsText(last.before);
  const after = windowsText(last.positions);
  const left = last.positions.length - 3;
  const leftMoved = last.before[left] !== last.positions[left];
  $('signal-note').textContent = t('positionTransition', { before, after }) + ' ' +
    t(leftMoved ? 'middleMoves' : 'rightMoves');
  const moves = [{ title: t('keyStage'), from: last.input, to: last.input, stage: 'start' },
    ...last.path.map((contact) => ({ ...contact, title: contactTitle(contact) })),
    { title: t('lamp'), from: last.output, to: last.output, stage: 'end' }];
  path.replaceChildren(...moves.map(({ title, from, to, stage }) => {
    const item = el('li', 'signal-node ' + stage);
    item.append(el('span', '', title), el('strong', '', from === to ? to : from + ' → ' + to));
    return item;
  }));
}

function updateControls() {
  const length = normalize(input.value).length;
  const remaining = length - cursor;
  $<HTMLButtonElement>('copy').disabled = !processed;
  $<HTMLButtonElement>('reverse').disabled = !processed || remaining !== 0;
  $<HTMLButtonElement>('step').disabled = remaining <= 0;
  $<HTMLButtonElement>('play').disabled = remaining <= 0 && !timer;
  $('play').setAttribute('aria-pressed', String(Boolean(timer)));
  $('play').textContent = t(timer ? 'pause' : 'play');
  $('console-status').textContent = t(timer ? 'playing' : remaining === 0 && processed ? 'done' : 'ready');
  $('count').textContent = t(length === 1 ? 'lettersOne' : 'lettersMany', { count: length });
}

function stop() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  updateControls();
}

function renderFeedback() {
  feedback.textContent = displayFeedback ? t(displayFeedback.key, displayFeedback.vars) : '';
  $('settings-error').textContent = errorKey ? t(errorKey) : '';
}

function invalidate() {
  stop();
  session = null;
  cursor = 0;
  processed = '';
  last = null;
  output.value = '';
  displayFeedback = null;
  errorKey = null;
  plugs.removeAttribute('aria-invalid');
  renderFeedback();
  renderScene();
  renderSignal();
  updateControls();
}

function renderMode() {
  const encode = mode === 'encode';
  $('encode').setAttribute('aria-pressed', String(encode));
  $('decode').setAttribute('aria-pressed', String(!encode));
  $('input-label').textContent = t(encode ? 'clear' : 'cipher');
  $('output-label').textContent = t(encode ? 'cipher' : 'clear');
  $('run-label').textContent = t(encode ? 'runEncode' : 'runDecode');
}
function setMode(next: typeof mode) {
  mode = next;
  renderMode();
  invalidate();
}

const errors: Record<engine.SettingsError['code'], MessageKey> = {
  reflector: 'invalidReflector', rotors: 'invalidRotors', letters: 'invalidLetters',
  plugCount: 'invalidPlugCount', plugFormat: 'invalidPlugFormat', plugDuplicate: 'invalidPlugDuplicate', key: 'invalidKey',
};
function prepare(message: string): State | null {
  errorKey = null;
  plugs.removeAttribute('aria-invalid');
  if (!message.length) {
    displayFeedback = { key: 'empty' };
    renderFeedback();
    input.focus();
    return null;
  }
  try {
    return session ??= engine.createState(currentConfig());
  } catch (error) {
    if (!(error instanceof engine.SettingsError)) throw error;
    errorKey = errors[error.code];
    if (error.code.startsWith('plug')) plugs.setAttribute('aria-invalid', 'true');
    displayFeedback = { key: 'checkSettings' };
    renderFeedback();
    return null;
  }
}

function applyProgress(message: string, result: { state: State; output: string; trace: Trace }) {
  session = result.state;
  last = result.trace;
  cursor += 1;
  processed += result.output;
  output.value = processed;
  displayFeedback = { key: 'progress', vars: { current: cursor, total: message.length } };
  if (cursor === message.length) stop();
  renderFeedback();
  renderScene(true);
  renderSignal();
  updateControls();
}

function run() {
  invalidate();
  const message = normalize(input.value);
  const state = prepare(message);
  if (!state) return;
  const prefix = engine.encodeText(state, message.slice(0, -1));
  processed = prefix.output;
  cursor = message.length - 1;
  applyProgress(message, engine.step(prefix.state, message[message.length - 1], true));
}

function step() {
  const message = normalize(input.value);
  if (cursor >= message.length) return false;
  const state = prepare(message);
  if (!state) return false;
  applyProgress(message, engine.step(state, message[cursor], true));
  return true;
}

function togglePlay() {
  if (timer !== null) {
    stop();
    return;
  }
  if (!step() || cursor === normalize(input.value).length) return;
  timer = window.setInterval(() => { if (!step()) stop(); }, 390);
  updateControls();
}

function setLanguage(value: string) {
  const config = currentConfig();
  language.value = localize(value);
  savePreference('enigma-workshop-language', language.value);
  renderModel();
  renderSettings(config);
  renderMode();
  renderFeedback();
  renderSignal();
  renderScene();
  updateControls();
}

for (const id of Object.keys(engine.models).filter(isModelId)) {
  const button = el('button', 'model');
  button.type = 'button';
  button.addEventListener('click', () => selectModel(id));
  modelButtons.set(id, button);
  $('models').append(button);
}
selectModel(modelId);
setLanguage(readPreference('enigma-workshop-language') ?? 'en');
applyTheme(readPreference('enigma-workshop-theme') ?? 'de');

function showFallback() {
  scene = null;
  canvas.hidden = true;
  fallback.hidden = false;
  for (const id of ['explode', 'turn-left', 'turn-right', 'reset-view']) $<HTMLButtonElement>(id).disabled = true;
}

function loadScene() {
  void import('../scene3d/machine').then(({ createMachineScene }) => {
    scene = createMachineScene(canvas);
    if (!scene) {
      showFallback();
      return;
    }
    canvas.dataset.renderer = 'webgl';
    scene.explode(exploded);
    renderScene();
  }).catch(showFallback);
}
const sceneObserver = new IntersectionObserver((entries) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  sceneObserver.disconnect();
  loadScene();
}, { rootMargin: '100px' });
sceneObserver.observe(canvas);

theme.addEventListener('change', () => applyTheme(theme.value));
language.addEventListener('change', () => setLanguage(language.value));
$('encode').addEventListener('click', () => { if (mode !== 'encode') setMode('encode'); });
$('decode').addEventListener('click', () => { if (mode !== 'decode') setMode('decode'); });
reflector.addEventListener('change', invalidate);
plugs.addEventListener('input', invalidate);
input.addEventListener('input', invalidate);
$('run').addEventListener('click', run);
$('step').addEventListener('click', () => { stop(); step(); });
$('play').addEventListener('click', togglePlay);
$('reset').addEventListener('click', () => selectModel(modelId));
$('example').addEventListener('click', () => {
  const example = t('sample');
  if (mode === 'encode') input.value = example;
  else {
    try {
      input.value = engine.encodeText(engine.createState(currentConfig()), normalize(example)).output;
    } catch (error) {
      if (!(error instanceof engine.SettingsError)) throw error;
      errorKey = errors[error.code];
      displayFeedback = { key: 'checkSettings' };
      renderFeedback();
      return;
    }
  }
  invalidate();
  input.focus();
});
$('reverse').addEventListener('click', () => {
  input.value = processed;
  setMode(mode === 'encode' ? 'decode' : 'encode');
  run();
});
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(output.value);
    displayFeedback = { key: 'copied' };
  } catch {
    output.focus();
    output.select();
    displayFeedback = { key: 'copySelected' };
  }
  renderFeedback();
});
$('explode').addEventListener('click', () => {
  exploded = !exploded;
  $('explode').setAttribute('aria-pressed', String(exploded));
  scene?.explode(exploded);
});
$('turn-left').addEventListener('click', () => scene?.rotate(-1));
$('turn-right').addEventListener('click', () => scene?.rotate(1));
$('reset-view').addEventListener('click', () => scene?.reset());
$('double-step').addEventListener('click', () => {
  input.value = 'AAA';
  setMode('encode');
  selectModel('I', { ...engine.defaults('I'), positions: [...'ADU'] });
  step();
  displayFeedback = { key: 'doubleHelp' };
  renderFeedback();
});

function loadArchive(ciphertext: string, config: Settings) {
  input.value = ciphertext;
  setMode('decode');
  selectModel(config.modelId, config);
  run();
  $('workshop').scrollIntoView({ block: 'start' });
  $('run').focus({ preventScroll: true });
}
$('historic-example').addEventListener('click', () => {
  loadArchive('GCDSE AHUGW TQGRK', { ...engine.defaults('I'), wheels: ['II', 'I', 'III'], reflector: 'A',
    rings: [...'XMV'], positions: [...'ABL'], plugs: 'AM FI NV PS TU WZ' });
});
$('naval-example').addEventListener('click', () => {
  loadArchive('NCZW VUSX PNYM INHZ XMQX', { ...engine.defaults('M4'), wheels: ['β', 'II', 'IV', 'I'],
    rings: [...'AAAV'], positions: [...'VJNA'], plugs: 'AT BL DF GJ HM NW OP QY RZ VX' });
});
