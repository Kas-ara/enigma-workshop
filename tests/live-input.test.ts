// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { createLiveInput } from '../src/ui/live-input';

let workshop: HTMLElement;
let transcript: HTMLTextAreaElement;
let key: HTMLButtonElement;
let setting: HTMLInputElement;
let control: ReturnType<typeof createLiveInput>;
const accepted = vi.fn<(letter: string) => boolean>();
const released = vi.fn();
const exited = vi.fn();

beforeEach(() => {
  document.body.innerHTML = '<main><textarea readonly></textarea><input><div><button data-key="A">A</button></div></main>';
  workshop = document.querySelector('main')!;
  transcript = workshop.querySelector('textarea')!;
  setting = workshop.querySelector('input')!;
  key = workshop.querySelector('button')!;
  key.setPointerCapture = vi.fn();
  accepted.mockReset().mockReturnValue(true);
  released.mockReset();
  exited.mockReset();
  control = createLiveInput(workshop, key.parentElement!, transcript, accepted, released, exited);
  control.setEnabled(true);
});

afterEach(() => control.setEnabled(false));

function keyboard(target: EventTarget, type: 'keydown' | 'keyup', key: string, down: Partial<KeyboardEventInit> = {}) {
  return target.dispatchEvent(new KeyboardEvent(type, {
    key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true, ...down,
  }));
}

test('a held physical letter sends once and only its release switches the lamp off', () => {
  keyboard(transcript, 'keydown', 'a');
  keyboard(transcript, 'keydown', 'a', { repeat: true });
  keyboard(transcript, 'keydown', 'b');
  keyboard(transcript, 'keyup', 'b');
  expect(accepted.mock.calls).toEqual([['A']]);
  expect(released).not.toHaveBeenCalled();
  keyboard(transcript, 'keyup', 'A');
  expect(released).toHaveBeenCalledOnce();
  keyboard(transcript, 'keydown', 'a');
  expect(accepted.mock.calls).toEqual([['A'], ['A']]);
});

test('the physical keyboard leaves editable settings, shortcuts and IME alone', () => {
  expect(keyboard(setting, 'keydown', 'a')).toBe(true);
  expect(keyboard(transcript, 'keydown', 'a', { metaKey: true })).toBe(true);
  expect(keyboard(transcript, 'keydown', 'a', { isComposing: true })).toBe(true);
  expect(accepted).not.toHaveBeenCalled();
});

test('Space acts as a held key on the 2D keyboard button', () => {
  expect(keyboard(key, 'keydown', ' ', { code: 'Space' })).toBe(false);
  expect(accepted.mock.calls).toEqual([['A']]);
  expect(released).not.toHaveBeenCalled();
  keyboard(key, 'keyup', ' ', { code: 'Space' });
  expect(released).toHaveBeenCalledOnce();
});

test('pointer release, cancellation and loss of capture switch off the lamp', () => {
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    key.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0, bubbles: true }));
    expect(accepted).toHaveBeenCalledWith('A');
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3 }));
    expect(released).not.toHaveBeenCalled();
    key.dispatchEvent(new PointerEvent(type, { pointerId: 2, bubbles: true }));
    expect(released).toHaveBeenCalledOnce();
    released.mockClear();
  }
});

test('focus loss and disabling Live clear held keys', () => {
  keyboard(transcript, 'keydown', 'a');
  window.dispatchEvent(new Event('blur'));
  expect(released).toHaveBeenCalledOnce();
  keyboard(transcript, 'keydown', 'b');
  control.setEnabled(false);
  expect(released).toHaveBeenCalledTimes(2);
  keyboard(transcript, 'keydown', 'a');
  expect(accepted.mock.calls).toEqual([['A'], ['B']]);
});

test('physical Space separates words even during a held letter', () => {
  keyboard(transcript, 'keydown', 'a');
  expect(keyboard(transcript, 'keydown', ' ', { code: 'Space' })).toBe(false);
  keyboard(transcript, 'keydown', ' ', { code: 'Space', repeat: true });
  keyboard(transcript, 'keyup', ' ', { code: 'Space' });
  expect(accepted.mock.calls).toEqual([['A'], [' ']]);
  expect(released).not.toHaveBeenCalled();
  keyboard(transcript, 'keyup', 'a');
  expect(released).toHaveBeenCalledOnce();
});

test('the on-screen spacebar keeps focus ready for the physical keyboard', () => {
  const space = document.createElement('button');
  space.dataset.key = ' ';
  key.parentElement!.append(space);
  space.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 4, button: 0, bubbles: true }));
  expect(document.activeElement).toBe(transcript);
  expect(accepted.mock.calls).toEqual([[' ']]);
  space.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, bubbles: true }));
  expect(released).not.toHaveBeenCalled();
});

test('Space keeps ordinary buttons activatable', () => {
  const toggle = document.createElement('button');
  workshop.append(toggle);
  expect(keyboard(toggle, 'keydown', ' ', { code: 'Space' })).toBe(true);
  expect(accepted).not.toHaveBeenCalled();
});

test('typing and Escape work with focus outside the workshop', () => {
  const outside = document.createElement('button');
  document.body.append(outside);
  keyboard(document.body, 'keydown', 'a');
  keyboard(outside, 'keyup', 'a');
  expect(accepted.mock.calls).toEqual([['A']]);
  expect(released).toHaveBeenCalledOnce();
  expect(keyboard(outside, 'keydown', 'Escape', { code: 'Escape' })).toBe(false);
  expect(exited).toHaveBeenCalledOnce();
});
