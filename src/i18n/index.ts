/// <reference types="vite/client" />
import { en, type MessageKey } from './en';
import { fr } from './fr';
import { de } from './de';
import englishHistory from '../../content/history/en.md?raw';
import frenchHistory from '../../content/history/fr.md?raw';
import germanHistory from '../../content/history/de.md?raw';

const messages = { en, fr, de };
const history = { en: englishHistory, fr: frenchHistory, de: germanHistory };
export type Locale = keyof typeof messages;
export type { MessageKey };

let locale: Locale = 'en';
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return messages[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => name in vars ? String(vars[name]) : match);
}

export function localize(value: string) {
  locale = Object.hasOwn(messages, value) ? value as Locale : 'en';
  document.documentElement.lang = locale;
  const attributes = {
    'data-l10n': null,
    'data-l10n-aria': 'aria-label',
    'data-l10n-placeholder': 'placeholder',
    'data-l10n-title': 'title',
    'data-l10n-content': 'content',
  };
  for (const [selector, attribute] of Object.entries(attributes)) {
    document.querySelectorAll('[' + selector + ']').forEach((element) => {
      const key = element.getAttribute(selector) as MessageKey;
      if (attribute) element.setAttribute(attribute, t(key));
      else element.textContent = t(key);
    });
  }
  // Each archive entry has a stable ID, date, title and one paragraph.
  const strings = new Map<string, string>();
  for (const block of history[locale].trim().split(/\n\s*\n/)) {
    const [heading, date, title, body] = block.split('\n');
    const id = heading.slice(3);
    strings.set(id + '.date', date);
    strings.set(id + '.title', title);
    strings.set(id + '.body', body);
  }
  document.querySelectorAll<HTMLElement>('[data-history]').forEach((element) => {
    element.textContent = strings.get(element.dataset.history ?? '') ?? '';
  });
  return locale;
}
