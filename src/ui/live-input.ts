interface ActiveKey {
  source: 'keyboard' | 'pointer' | 'activation';
  id: string | number;
  letter: string;
}

export function createLiveInput(
  workshop: HTMLElement,
  keyboard: HTMLElement,
  transcript: HTMLTextAreaElement,
  accept: (letter: string) => boolean,
  onRelease: () => void,
) {
  let enabled = false;
  let active: ActiveKey | null = null;

  function press(key: ActiveKey) {
    if (!enabled) return false;
    if (key.letter === ' ') return accept(key.letter);
    if (active || !accept(key.letter)) return false;
    active = key;
    return true;
  }

  function release() {
    if (!active) return;
    active = null;
    onRelease();
  }

  function releaseMatching(source: ActiveKey['source'], id: ActiveKey['id']) {
    if (active?.source === source && active.id === id) release();
  }

  function keyButton(target: EventTarget | null) {
    return target instanceof Element ? target.closest<HTMLButtonElement>('button[data-key]') : null;
  }

  function keyId(event: KeyboardEvent) {
    return event.code && event.code !== 'Unidentified' ? event.code : event.key.toUpperCase();
  }

  workshop.addEventListener('keydown', (event) => {
    if (!enabled || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target !== transcript && (target.isContentEditable || target.closest('input, textarea, select'))) return;
    const button = keyButton(target);
    let letter: string | undefined;
    if (button && (event.key === 'Enter' || event.key === ' ')) {
      letter = button.dataset.key;
    } else if (event.key === ' ' && !target.closest('button, [role="button"]')) {
      letter = ' ';
    } else if (/^[a-z]$/i.test(event.key)) {
      letter = event.key.toUpperCase();
    }
    if (!letter) return;

    event.preventDefault();
    if (!event.repeat) press({ source: 'keyboard', id: keyId(event), letter });
  });

  window.addEventListener('keyup', (event) => {
    releaseMatching('keyboard', keyId(event));
  });

  keyboard.addEventListener('pointerdown', (event) => {
    const button = keyButton(event.target);
    const letter = button?.dataset.key;
    if (!button || !letter || event.button !== 0) return;
    if (press({ source: 'pointer', id: event.pointerId, letter })) {
      // A pointer key sends the next physical keystroke back to the transcript.
      transcript.focus({ preventScroll: true });
      if (letter !== ' ') button.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  for (const name of ['pointerup', 'pointercancel'] as const) {
    window.addEventListener(name, (event) => releaseMatching('pointer', event.pointerId));
  }
  keyboard.addEventListener('lostpointercapture', (event) => releaseMatching('pointer', event.pointerId));
  keyboard.addEventListener('contextmenu', (event) => { if (enabled && keyButton(event.target)) event.preventDefault(); });
  keyboard.addEventListener('click', (event) => {
    const letter = keyButton(event.target)?.dataset.key;
    // Assistive activation commands can deliver a click without a press and release.
    if (event.detail === 0 && letter && press({ source: 'activation', id: letter, letter }) && letter !== ' ') {
      window.setTimeout(() => releaseMatching('activation', letter), 180);
    }
  });

  workshop.addEventListener('focusout', (event) => {
    if (active?.source === 'keyboard' &&
      (!(event.relatedTarget instanceof Node) || !workshop.contains(event.relatedTarget))) release();
  });
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) release();
    },
    release,
  };
}
