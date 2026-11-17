import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { faviconSrc, letterFor, discColor, samePixels, NO_ICON_PAGE_URL, DISC_COLORS, DISC_LETTER_COLOR } from './icon.js';
import { contrast } from './contrast.js';

describe('faviconSrc', () => {
  const base = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/';

  it('builds the _favicon URL under the extension origin', () => {
    expect(faviconSrc(base, 'https://example.com/', 32)).toBe(
      `${base}_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&size=32`,
    );
  });

  it('URL-encodes the page address so it survives a round trip', () => {
    const page = 'https://docs.example.com/a b?q=1&x=ä#frag';
    const url = new URL(faviconSrc(base, page, 32));
    expect(url.searchParams.get('pageUrl')).toBe(page);
    expect(url.searchParams.get('size')).toBe('32');
    expect(url.searchParams.getAll('x')).toEqual([]); // the page's own query stays inside pageUrl
  });
});

describe('samePixels', () => {
  it('is true only for identical pixel data', () => {
    expect(samePixels([1, 2, 3, 255], [1, 2, 3, 255])).toBe(true);
    expect(samePixels(new Uint8ClampedArray([0, 0, 0, 0]), [0, 0, 0, 0])).toBe(true);
    expect(samePixels([1, 2, 3, 255], [1, 2, 4, 255])).toBe(false);
    expect(samePixels([1, 2, 3, 255], [1, 2, 3])).toBe(false); // a different size is a different image
  });

  it('agrees with element-wise equality', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), fc.uint8Array({ maxLength: 64 }), (a, b) => {
        expect(samePixels(a, b)).toBe(a.length === b.length && a.every((v, i) => v === b[i]));
        expect(samePixels(a, Uint8Array.from(a))).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('uses a reserved domain that can never have an icon', () => {
    expect(new URL(NO_ICON_PAGE_URL).hostname.endsWith('.invalid')).toBe(true);
  });
});

describe('letterFor', () => {
  it('takes the first letter after a leading www., upper-cased', () => {
    expect(letterFor('www.github.com')).toBe('G');
    expect(letterFor('docs.google.com')).toBe('D');
    expect(letterFor('WWW.example.com')).toBe('E');
    expect(letterFor('élan.fr')).toBe('É');
    expect(letterFor('')).toBe('');
  });
});

describe('discColor', () => {
  it('matches the mockup colorFor (char-code sum mod 8)', () => {
    // "a" = 97 → 97 mod 8 = 1
    expect(discColor('a')).toBe(DISC_COLORS[1]);
    expect(discColor('github.com')).toBe(DISC_COLORS[[...'github.com'].reduce((s, c) => s + c.charCodeAt(0), 0) % 8]);
  });

  it('is always one of the disc colours, and stable', () => {
    for (const d of ['github.com', 'kiro.dev', 'en.wikipedia.org', 'x']) {
      expect(DISC_COLORS).toContain(discColor(d));
      expect(discColor(d)).toBe(discColor(d));
    }
  });

  it('the letter meets AA (4.5:1) on every disc colour', () => {
    for (const color of DISC_COLORS) expect(contrast(DISC_LETTER_COLOR, color)).toBeGreaterThanOrEqual(4.5);
  });
});
