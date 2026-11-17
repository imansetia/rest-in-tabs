import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  parseAvailability, aiPlan, gravesToUpgrade, cleanAiEpitaph, withoutOldExcerpts, downloadProgressText, upgradeEpitaphs,
} from './ai-epitaph.js';
import { DAY, makeGrave } from './test-fakes.js';
import type { Grave } from './types.js';
import type { MessageResponse } from './messages.js';

afterEach(() => vi.restoreAllMocks());

describe('parseAvailability and aiPlan', () => {
  it('keeps the four states; anything else is unavailable', () => {
    for (const s of ['available', 'downloadable', 'downloading', 'unavailable'] as const) expect(parseAvailability(s)).toBe(s);
    for (const s of ['readily', 'after-download', 'no', '', undefined, null, 42]) expect(parseAvailability(s)).toBe('unavailable');
  });

  it('upgrades when available, offers the button when downloadable, else does nothing', () => {
    expect(aiPlan('available')).toBe('upgrade');
    expect(aiPlan('downloadable')).toBe('offer');
    expect(aiPlan('downloading')).toBe('none');
    expect(aiPlan('unavailable')).toBe('none');
  });
});

describe('gravesToUpgrade', () => {
  it('only graves with a non-blank excerpt, newest first', () => {
    const graves = [
      makeGrave('old', { buriedAt: 1, excerpt: 'text' }),
      makeGrave('none', { buriedAt: 5 }),
      makeGrave('blank', { buriedAt: 6, excerpt: '  ' }),
      makeGrave('new', { buriedAt: 9, excerpt: 'text' }),
    ];
    expect(gravesToUpgrade(graves).map((g) => g.id)).toEqual(['new', 'old']);
  });
});

describe('cleanAiEpitaph', () => {
  it('drops a list marker or wrapping quotes, then collapses whitespace', () => {
    expect(cleanAiEpitaph('* A room in Ribeira.')).toBe('A room in Ribeira.');
    expect(cleanAiEpitaph('1. Lab-tested reviews\n of 40 keyboards.')).toBe('Lab-tested reviews of 40 keyboards.');
    expect(cleanAiEpitaph('“Select a parent element.”')).toBe('Select a parent element.');
    expect(cleanAiEpitaph('   ')).toBe('');
    expect(cleanAiEpitaph(' - ')).toBe(''); // a bullet with nothing after it
    expect(cleanAiEpitaph('-40% on keyboards today.')).toBe('-40% on keyboards today.'); // not a bullet
  });

  it('is never longer than 200 code points and never has outer whitespace', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 600 }), (s) => {
        const e = cleanAiEpitaph(s);
        expect([...e].length).toBeLessThanOrEqual(200);
        expect(e).toBe(e.trim());
        expect(e).not.toMatch(/\s{2}/);
      }),
      { numRuns: 300 },
    );
  });
});

describe('withoutOldExcerpts', () => {
  it('drops excerpts older than 7 days only; null when nothing changes', () => {
    const now = 100 * DAY;
    const graves = [makeGrave('old', { buriedAt: now - 7 * DAY - 1, excerpt: 'x' }), makeGrave('seven', { buriedAt: now - 7 * DAY, excerpt: 'y' })];
    const next = withoutOldExcerpts(graves, now)!;
    expect(next.map((g) => g.excerpt)).toEqual([undefined, 'y']);
    expect('excerpt' in next[0]).toBe(false);
    expect(next[1]).toBe(graves[1]);
    expect(withoutOldExcerpts(next, now)).toBeNull();
  });
});

describe('downloadProgressText', () => {
  it('shows whole percent and stays in 0 to 100', () => {
    expect(downloadProgressText(0, 1)).toBe('Downloading model… 0%');
    expect(downloadProgressText(0.425, 1)).toBe('Downloading model… 43%');
    expect(downloadProgressText(50, 200)).toBe('Downloading model… 25%');
    expect(downloadProgressText(1.2, 1)).toBe('Downloading model… 100%');
    expect(downloadProgressText(Number.NaN, 1)).toBe('Downloading model… 0%');
    expect(downloadProgressText(0.5, 0)).toBe('Downloading model… 50%'); // no total: loaded is a fraction
  });
});

describe('upgradeEpitaphs', () => {
  function world(graves: Grave[], reply: (id: string) => MessageResponse = () => ({ ok: true })) {
    let list = graves;
    const sent: Array<[string, string]> = [];
    return {
      sent,
      set: (next: Grave[]) => (list = next),
      deps: {
        graves: () => list,
        summarize: vi.fn(async (excerpt: string) => `- Summary of ${excerpt}`),
        send: async (id: string, epitaph: string) => {
          sent.push([id, epitaph]);
          // Like the live update: the saved grave loses its excerpt.
          const r = reply(id);
          if (r.ok) list = list.map((g) => (g.id === id ? { ...g, excerpt: undefined, epitaph } : g));
          return r;
        },
      },
    };
  }

  it('summarises every grave with an excerpt, newest first, and sends the cleaned text', async () => {
    const w = world([makeGrave('a', { buriedAt: 1, excerpt: 'page A' }), makeGrave('b', { buriedAt: 2, excerpt: 'page B' }), makeGrave('c', { buriedAt: 3 })]);
    expect(await upgradeEpitaphs(w.deps)).toEqual({ upgraded: 2, failed: 0 });
    expect(w.sent).toEqual([['b', 'Summary of page B'], ['a', 'Summary of page A']]);
  });

  it('a failed summary keeps the fallback and moves on; each grave is tried once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world([makeGrave('a', { buriedAt: 2, excerpt: 'bad' }), makeGrave('b', { buriedAt: 1, excerpt: 'good' })]);
    w.deps.summarize.mockImplementation(async (x: string) => {
      if (x === 'bad') throw new DOMException('The model failed', 'OperationError');
      return 'Fine.';
    });
    expect(await upgradeEpitaphs(w.deps)).toEqual({ upgraded: 1, failed: 1 });
    expect(w.sent).toEqual([['b', 'Fine.']]);
    expect(w.deps.summarize).toHaveBeenCalledTimes(2);
  });

  it('an empty summary or a refused update counts as failed and is not retried', async () => {
    const w = world([makeGrave('a', { buriedAt: 2, excerpt: 'x' }), makeGrave('b', { buriedAt: 1, excerpt: 'y' })], (id) => (id === 'b' ? { ok: false, error: 'not-found' } : { ok: true }));
    w.deps.summarize.mockImplementation(async (x: string) => (x === 'x' ? '  ' : 'Text.'));
    expect(await upgradeEpitaphs(w.deps)).toEqual({ upgraded: 0, failed: 2 });
    expect(w.sent).toEqual([['b', 'Text.']]);
  });

  it('with a shared tried set, a failed grave is not retried by the next call (the next live update)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world([makeGrave('a', { buriedAt: 1, excerpt: 'bad' })]);
    w.deps.summarize.mockRejectedValue(new DOMException('The model failed', 'OperationError'));
    const tried = new Set<string>();
    expect(await upgradeEpitaphs({ ...w.deps, tried })).toEqual({ upgraded: 0, failed: 1 });
    expect(await upgradeEpitaphs({ ...w.deps, tried })).toEqual({ upgraded: 0, failed: 0 });
    expect(w.deps.summarize).toHaveBeenCalledTimes(1);
    expect(await upgradeEpitaphs(w.deps)).toEqual({ upgraded: 0, failed: 1 }); // no set: a fresh try
  });

  it('skips graves that left and includes graves buried meanwhile', async () => {
    const w = world([makeGrave('a', { buriedAt: 3, excerpt: 'A' }), makeGrave('b', { buriedAt: 2, excerpt: 'B' })]);
    w.deps.summarize.mockImplementation(async (x: string) => {
      // While "A" is summarised, "b" is exorcised and "n" is buried.
      if (x === 'A') w.set([...w.deps.graves().filter((g) => g.id !== 'b'), makeGrave('n', { buriedAt: 9, excerpt: 'N' })]);
      return `S${x}`;
    });
    expect(await upgradeEpitaphs(w.deps)).toEqual({ upgraded: 2, failed: 0 });
    expect(w.sent.map(([id]) => id)).toEqual(['a', 'n']);
  });
});
