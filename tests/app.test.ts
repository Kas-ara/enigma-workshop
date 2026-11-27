// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import html from '../index.html?raw';

test('reselecting the archived model preserves its key and result until Reset', async () => {
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  localStorage.setItem('enigma-workshop-view', '2d');
  await import('../src/ui/app');

  const find = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const output = find<HTMLTextAreaElement>('#output');
  const plugs = find<HTMLInputElement>('#plugs');
  find('#naval-example').click();
  expect(plugs.value).not.toBe('');
  expect(output.value, find('#settings-error').textContent ?? undefined).toBe('VONVONJLOOKSJHFFTTTE');

  const archivePlugs = plugs.value;
  const activeModel = find('#models button[aria-pressed="true"]');
  activeModel.click();
  expect(plugs.value).toBe(archivePlugs);
  expect(output.value).toBe('VONVONJLOOKSJHFFTTTE');
  find('#run').click();
  expect(output.value).toBe('VONVONJLOOKSJHFFTTTE');

  find('#reset').click();
  expect(activeModel.getAttribute('aria-pressed')).toBe('true');
  expect(plugs.value).toBe('');
  expect(output.value).toBe('');
});
