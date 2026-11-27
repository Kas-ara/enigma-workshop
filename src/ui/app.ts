import './style.css';
import * as engine from '../engine/enigma';
import { type Contact, type ModelId, type Reflector, type Settings, type State, type Trace } from '../engine/enigma';
import { localize, t, type MessageKey } from '../i18n';
import { normalize, withWordSpaces } from './normalize';
import { keyboardRows } from '../engine/models/service';
import { createLiveInput } from './live-input';
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
const workshop = $('workshop');
const keyboard = $('machine-keyboard');
const lamps = new Map<string, HTMLElement>();
const keys = new Map<string, HTMLButtonElement>();
const lampReading = $('live-lamp');
const view2D = $<HTMLButtonElement>('view-2d');
const view3D = $<HTMLButtonElement>('view-3d');
const modelButtons = new Map<ModelId, HTMLButtonElement>();
const alphabet = [...engine.alphabet];

let scene: MachineScene | null = null;
let exploded = false;
let view: '2d' | '3d' = '3d';
let nearViewport = false;
let sceneLoading = false;
let webglUnavailable = false;
let live = false;
let modelId: ModelId = 'I';
let mode: 'encode' | 'decode' = 'encode';
let settings: HTMLSelectElement[][] = [];
let session: State | null = null;
let cursor = 0;
let processed = '';
let last: Trace | null = null;
let lit: Trace | null = null;
let timer: number | null = null;
let displayFeedback: { key: MessageKey; vars?: Record<string, string | number> } | null = null;
let settingsIssue: engine.SettingsError | null = null;

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
      if (key === 'rotor') select.setAttribute('aria-describedby', 'settings-error');
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

function renderIndicators(updateSceneKeys = true) {
  if (updateSceneKeys) scene?.setKeys(lit?.input, lit?.output);
  for (const [letter, lamp] of lamps) lamp.toggleAttribute('data-lit', lit?.output === letter);
  for (const [letter, key] of keys) key.toggleAttribute('data-pressed', lit?.input === letter);
  lampReading.textContent = lit?.output ?? '—';
  lampReading.toggleAttribute('data-active', Boolean(lit));
}

function turnOffLamp() {
  lit = null;
  renderIndicators();
}

function renderScene(animate = false) {
  const config = currentConfig();
  const positions = last?.positions ?? config.positions;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  renderIndicators(false);
  if (view === '3d') scene?.update({ modelId, positions,
    before: animate ? last?.before ?? positions : positions, input: lit?.input, output: lit?.output, accent });
  const chips = positions.map((letter, slot) => {
    const changed = last && last.before[slot] !== letter;
    const chip = el('span', changed ? 'advanced' : '', labelPosition(letter));
    chip.title = t('rotor') + ' ' + config.wheels[slot] + ' · ' + letter;
    return chip;
  });
  $('windows').replaceChildren(...chips);
  $('flat-windows').replaceChildren(...chips.map((chip) => chip.cloneNode(true)));
}

function initializeBoard() {
  for (const row of keyboardRows) {
    const lampRow = el('div', 'board-row');
    const keyRow = el('div', 'board-row');
    for (const letter of row) {
      const lamp = el('span', 'board-lamp', letter);
      const key = el('button', 'board-key', letter);
      key.type = 'button';
      key.disabled = true;
      key.dataset.key = letter;
      lamps.set(letter, lamp);
      keys.set(letter, key);
      lampRow.append(lamp);
      keyRow.append(key);
    }
    $('lampboard').append(lampRow);
    keyboard.append(keyRow);
  }
  const space = el('button', 'board-key board-space');
  space.id = 'live-space';
  space.type = 'button';
  space.dataset.key = ' ';
  space.dataset.l10n = 'spaceKey';
  keys.set(' ', space);
  keyboard.append(space);
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
  $<HTMLButtonElement>('run').disabled = live;
  $<HTMLButtonElement>('step').disabled = live || remaining <= 0;
  $<HTMLButtonElement>('play').disabled = live || (remaining <= 0 && !timer);
  $('play').setAttribute('aria-pressed', String(Boolean(timer)));
  $('play').textContent = t(timer ? 'pause' : 'play');
  $('console-status').textContent = t(live ? 'live' : timer ? 'playing' : remaining === 0 && processed ? 'done' : 'ready');
  $('count').textContent = t(length === 1 ? 'lettersOne' : 'lettersMany', { count: length });
}

function stop() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  updateControls();
}

function markInvalid(field: HTMLElement, invalid: boolean) {
  if (invalid) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
}

function renderFeedback() {
  feedback.textContent = displayFeedback ? t(displayFeedback.key, displayFeedback.vars) : '';
  $('settings-error').textContent = settingsIssue ? t(errors[settingsIssue.code]) : '';
  markInvalid(plugs, settingsIssue?.code.startsWith('plug') === true);
  settings.forEach(([rotor], slot) => markInvalid(rotor, settingsIssue?.rotorSlots.includes(slot) === true));
}

function invalidate() {
  stop();
  liveInput.release();
  session = null;
  cursor = 0;
  processed = '';
  last = null;
  lit = null;
  output.value = '';
  displayFeedback = null;
  settingsIssue = null;
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
function readSettings(): State | null {
  try {
    const state = engine.createState(currentConfig());
    settingsIssue = null;
    return state;
  } catch (error) {
    if (!(error instanceof engine.SettingsError)) throw error;
    settingsIssue = error;
    displayFeedback = { key: 'checkSettings' };
    renderFeedback();
    return null;
  }
}

function prepare(message: string): State | null {
  if (!message.length) {
    displayFeedback = { key: 'empty' };
    renderFeedback();
    input.focus();
    return null;
  }
  return session ??= readSettings();
}

function applyProgress(message: string, result: { state: State; output: string; trace: Trace }) {
  session = result.state;
  last = result.trace;
  lit = result.trace;
  cursor += 1;
  processed += result.output;
  output.value = live ? withWordSpaces(input.value, processed) : processed;
  displayFeedback = live
    ? { key: 'liveProgress', vars: { input: result.trace.input, output: result.output, total: cursor } }
    : { key: 'progress', vars: { current: cursor, total: message.length } };
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

function appendLiveCharacter(letter: string) {
  if (!live || input.value.length >= input.maxLength) return false;
  if (letter === ' ') {
    input.value += letter;
    output.value = withWordSpaces(input.value, processed);
    return true;
  }
  const state = prepare(letter);
  if (!state) return false;
  const existing = normalize(input.value);
  // Keep any pending text when entering Live or changing the settings.
  const prefix = engine.encodeText(state, existing.slice(cursor));
  processed += prefix.output;
  cursor = existing.length;
  input.value += letter;
  applyProgress(existing + letter, engine.step(prefix.state, letter, true));
  return true;
}

const liveInput = createLiveInput(workshop, keyboard, input, appendLiveCharacter, turnOffLamp, () => {
  setLive(false);
  $('live-toggle').focus({ preventScroll: true });
});

function renderLive() {
  $('live-toggle').setAttribute('aria-pressed', String(live));
  $('live-hint').textContent = live ? t('liveHint') : '';
  $('live-toolbar').hidden = !live;
  input.readOnly = live;
  if (live) input.setAttribute('aria-keyshortcuts', 'Escape Space');
  else input.removeAttribute('aria-keyshortcuts');
  input.setAttribute('aria-describedby', live ? 'live-hint normalization' : 'normalization');
  for (const key of keys.values()) key.disabled = !live;
  $('live-space').hidden = !live;
  $('normalization').textContent = t(live ? 'liveNormalization' : 'normalization');
  updateControls();
}

function setLive(value: boolean) {
  if (live === value) return;
  liveInput.setEnabled(value);
  stop();
  live = value;
  renderLive();
  turnOffLamp();
  if (value) {
    output.value = withWordSpaces(input.value, processed);
    input.focus({ preventScroll: true });
  }
}

function setLanguage(value: string) {
  const config = currentConfig();
  language.value = localize(value);
  savePreference('enigma-workshop-language', language.value);
  renderModel();
  renderSettings(config);
  renderMode();
  renderLive();
  renderFeedback();
  renderSignal();
  renderScene();
  updateControls();
}

initializeBoard();
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

function renderView() {
  const flat = view === '2d';
  canvas.hidden = flat;
  $('machine-2d').hidden = !flat;
  $('webgl-note').hidden = !webglUnavailable;
  $('camera').hidden = flat;
  $('windows').hidden = flat;
  $('scene-index').hidden = flat;
  $('explode').hidden = flat;
  view2D.setAttribute('aria-pressed', String(flat));
  view3D.setAttribute('aria-pressed', String(!flat));
  view3D.disabled = webglUnavailable;
}

function selectView(value: typeof view, persist = true) {
  view = webglUnavailable ? '2d' : value;
  if (persist) savePreference('enigma-workshop-view', view);
  renderView();
  renderScene();
  if (view === '3d' && nearViewport) loadScene();
}

function showFallback() {
  scene?.dispose();
  scene = null;
  delete canvas.dataset.renderer;
  webglUnavailable = true;
  if (document.activeElement === view3D || document.activeElement === $('explode') ||
    $('camera').contains(document.activeElement)) view2D.focus();
  selectView('2d', false);
}

function loadScene() {
  if (scene || sceneLoading || webglUnavailable) return;
  sceneLoading = true;
  void import('../scene3d/machine').then(({ createMachineScene }) => {
    if (view !== '3d') return;
    scene = createMachineScene(canvas);
    if (!scene) {
      showFallback();
      return;
    }
    canvas.dataset.renderer = 'webgl';
    scene.explode(exploded);
    renderScene();
  }).catch(showFallback).finally(() => { sceneLoading = false; });
}

selectView(readPreference('enigma-workshop-view') === '2d' ? '2d' : '3d', false);
const sceneObserver = new IntersectionObserver((entries) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  nearViewport = true;
  sceneObserver.disconnect();
  if (view === '3d') loadScene();
}, { rootMargin: '100px' });
sceneObserver.observe($('machine-viewport'));
view2D.addEventListener('click', () => selectView('2d'));
view3D.addEventListener('click', () => selectView('3d'));
canvas.addEventListener('webglcontextlost', showFallback);

$('live-toggle').addEventListener('click', () => setLive(!live));
$('live-clear').addEventListener('click', () => {
  input.value = '';
  invalidate();
  input.focus({ preventScroll: true });
});

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
    const exampleState = readSettings();
    if (!exampleState) return;
    input.value = engine.encodeText(exampleState, normalize(example)).output;
  }
  invalidate();
  input.focus();
});
$('reverse').addEventListener('click', () => {
  setLive(false);
  input.value = output.value;
  setMode(mode === 'encode' ? 'decode' : 'encode');
  run();
  output.value = withWordSpaces(input.value, processed);
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
  setLive(false);
  input.value = 'AAA';
  setMode('encode');
  selectModel('I', { ...engine.defaults('I'), positions: [...'ADU'] });
  step();
  displayFeedback = { key: 'doubleHelp' };
  renderFeedback();
});

function loadArchive(ciphertext: string, config: Settings) {
  setLive(false);
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
