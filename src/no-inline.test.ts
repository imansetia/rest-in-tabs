/// <reference types="vite/client" />
// Repository-wide guard: the extension's content security policy forbids
// inline styles and inline event handlers, so they must not appear in the
// source at all (tasks 10.5 and 11).

import { describe, it, expect } from 'vitest';

/**
 * Patterns that the CSP (`style-src 'self'`, `script-src 'self'`) would block:
 * - a `style="…"` / `style='…'` attribute (not a `.style = …` property write)
 * - an inline handler attribute such as `onclick="…"` or `onerror='…'`
 * - `setAttribute('style' | 'on…', …)`, which creates the same attributes
 */
const RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'style attribute', pattern: /(?<![.\w-])style\s*=\s*["']/g },
  { name: 'inline event handler', pattern: /(?<![.\w-])on[a-z]+\s*=\s*["']/g },
  { name: 'setAttribute style/handler', pattern: /setAttribute\(\s*["'](?:style|on[a-z]+)["']/g },
];

export function findInlineViolations(text: string): Array<{ rule: string; line: number; snippet: string }> {
  const found: Array<{ rule: string; line: number; snippet: string }> = [];
  for (const { name, pattern } of RULES) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const line = text.slice(0, index).split('\n').length;
      const snippet = text.split('\n')[line - 1].trim().slice(0, 100);
      found.push({ rule: name, line, snippet });
    }
  }
  return found;
}

const SELF = './no-inline.test.ts';
const sources = import.meta.glob<string>('./**/*.{ts,html}', { query: '?raw', import: 'default', eager: true });

describe('no inline styles or event handlers in src/', () => {
  it('scans the source files', () => {
    const files = Object.keys(sources).filter((f) => f !== SELF);
    expect(files).toContain('./popup/index.html');
    expect(files).toContain('./popup/popup.ts');
    expect(files.length).toBeGreaterThan(20);
  });

  it('finds no style attributes, inline handlers or setAttribute equivalents', () => {
    const violations = Object.entries(sources)
      .filter(([file]) => file !== SELF)
      .flatMap(([file, text]) => findInlineViolations(text).map((v) => `${file}:${v.line} ${v.rule}: ${v.snippet}`));
    expect(violations).toEqual([]);
  });
});

describe('findInlineViolations (the detector itself)', () => {
  it('flags inline styles and handlers', () => {
    const bad = [
      '<div style="color: red">',
      "<p style='x'>",
      '<img src="a.png" onerror="this.remove()">',
      '<button onclick=\'go()\'>',
      'el.innerHTML = `<span style="--c:${color}">`;',
      "el.setAttribute('style', 'color: red');",
      'el.setAttribute("onclick", "go()");',
    ];
    for (const text of bad) expect(findInlineViolations(text)).not.toEqual([]);
  });

  it('allows CSSOM writes, listeners and similar-looking names', () => {
    const fine = [
      "el.style.setProperty('--s', '0.78');",
      "el.style = 'color: red';", // CSSOM setter, allowed by the CSP
      "button.addEventListener('click', go);",
      "el.onclick = () => go();", // property, not an attribute
      '<div data-style="x" data-onclick="y">',
      "chrome.runtime.onMessage.addListener(handler);",
      '<link rel="stylesheet" href="./popup.css" />',
      'const response = { ok: true };',
    ];
    for (const text of fine) expect(findInlineViolations(text)).toEqual([]);
  });
});
