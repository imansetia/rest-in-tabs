import { describe, it, expect, vi, afterEach } from 'vitest';
import { resurrect, exorcise, expireGraves, updateEpitaph, pruneExcerpts } from './grave-actions.js';
import { DAY, makeGrave, fakeStorage, fakeTabs } from './test-fakes.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resurrect', () => {
  it('opens the page, removes the grave and counts the resurrection', async () => {
    const storage = fakeStorage({
      graves: [makeGrave('a'), makeGrave('b')],
      stats: { buried: 2, resurrected: 0 },
    });
    const tabs = fakeTabs([]);

    expect(await resurrect(storage.adapter, tabs.adapter, 'a')).toEqual({ ok: true });
    expect(tabs.createdUrls).toEqual(['https://grave-a.example.com/']);
    expect(storage.graves().map((g) => g.id)).toEqual(['b']);
    expect(storage.stats()).toEqual({ buried: 2, resurrected: 1 });
  });

  it('keeps the grave when the tab cannot be opened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = fakeStorage({ graves: [makeGrave('a')] });
    const tabs = fakeTabs([], { failCreate: true });

    expect(await resurrect(storage.adapter, tabs.adapter, 'a')).toEqual({ ok: false, error: 'open-failed' });
    expect(storage.graves().map((g) => g.id)).toEqual(['a']);
    expect(storage.stats().resurrected).toBe(0);
  });

  it('reports an unknown grave without opening a tab', async () => {
    const storage = fakeStorage({ graves: [makeGrave('a')] });
    const tabs = fakeTabs([]);

    expect(await resurrect(storage.adapter, tabs.adapter, 'zzz')).toEqual({ ok: false, error: 'not-found' });
    expect(tabs.createdUrls).toEqual([]);
  });
});

describe('exorcise', () => {
  it('deletes only the chosen grave and leaves stats alone', async () => {
    const storage = fakeStorage({
      graves: [makeGrave('a'), makeGrave('b')],
      stats: { buried: 2, resurrected: 0 },
    });

    expect(await exorcise(storage.adapter, 'a')).toEqual({ ok: true });
    expect(storage.graves().map((g) => g.id)).toEqual(['b']);
    expect(storage.stats()).toEqual({ buried: 2, resurrected: 0 });
  });
});

describe('expireGraves', () => {
  it('removes graves past the Retention Period and keeps the rest', async () => {
    const now = Date.now();
    const storage = fakeStorage({
      settings: { retentionDays: 30 },
      graves: [makeGrave('old', { buriedAt: now - 31 * DAY }), makeGrave('new', { buriedAt: now - 29 * DAY })],
    });

    expect(await expireGraves(storage.adapter)).toBe(1);
    expect(storage.graves().map((g) => g.id)).toEqual(['new']);
  });

  it('removes nothing when the Retention Period is Never', async () => {
    const storage = fakeStorage({
      settings: { retentionDays: null },
      graves: [makeGrave('ancient', { buriedAt: 0 })],
    });

    expect(await expireGraves(storage.adapter)).toBe(0);
    expect(storage.graves()).toHaveLength(1);
  });
});

describe('updateEpitaph (task 13.2)', () => {
  it('cleans the text, marks it "ai", deletes the excerpt and keeps everything else', async () => {
    const storage = fakeStorage({
      graves: [makeGrave('a', { excerpt: 'Long page text.', epitaphSource: 'meta' }), makeGrave('b', { excerpt: 'Other text.' })],
      stats: { buried: 2, resurrected: 0 },
    });

    expect(await updateEpitaph(storage.adapter, 'a', '  - A riverside   room\nin Ribeira.  ')).toEqual({ ok: true });
    const [a, b] = storage.graves();
    expect(a.epitaph).toBe('A riverside room in Ribeira.');
    expect(a.epitaphSource).toBe('ai');
    expect('excerpt' in a).toBe(false);
    expect({ ...a, epitaph: '', epitaphSource: '' }).toEqual({ ...makeGrave('a', { buriedAt: a.buriedAt, lastAccessed: a.lastAccessed }), epitaph: '', epitaphSource: '' });
    expect(b.excerpt).toBe('Other text.'); // other graves untouched
    expect(storage.stats()).toEqual({ buried: 2, resurrected: 0 });
  });

  it('cuts the Epitaph to 200 code points, as fallbackEpitaph does', async () => {
    const storage = fakeStorage({ graves: [makeGrave('a', { excerpt: 'x' })] });
    await updateEpitaph(storage.adapter, 'a', '👻 '.repeat(300));
    const epitaph = storage.graves()[0].epitaph;
    expect([...epitaph].length).toBeLessThanOrEqual(200);
    expect(epitaph).toBe(epitaph.trim());
  });

  it('refuses text with nothing left after cleaning, and a grave that left', async () => {
    const storage = fakeStorage({ graves: [makeGrave('a', { excerpt: 'x' })] });
    expect(await updateEpitaph(storage.adapter, 'a', ' - ')).toEqual({ ok: false, error: 'bad-request' });
    expect(await updateEpitaph(storage.adapter, 'gone', 'Summary.')).toEqual({ ok: false, error: 'not-found' });
    expect(storage.graves()[0].excerpt).toBe('x');
  });

  it('reports a failed write and changes nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = fakeStorage({ graves: [makeGrave('a', { excerpt: 'x', epitaph: 'Old.' })], failWrites: true });
    expect(await updateEpitaph(storage.adapter, 'a', 'New.')).toEqual({ ok: false, error: 'save-failed' });
    expect(storage.graves()[0].epitaph).toBe('Old.');
  });

  it('waits for the write queue: a resurrect queued first removes the grave, so the update finds nothing', async () => {
    const storage = fakeStorage({ graves: [makeGrave('a', { excerpt: 'x' })] });
    const [res, upd] = await Promise.all([
      resurrect(storage.adapter, fakeTabs([]).adapter, 'a'),
      updateEpitaph(storage.adapter, 'a', 'Summary.'),
    ]);
    expect(res).toEqual({ ok: true });
    expect(upd).toEqual({ ok: false, error: 'not-found' });
    expect(storage.graves()).toEqual([]);
  });
});

describe('pruneExcerpts (task 13.4)', () => {
  it('drops excerpts of graves buried more than 7 days ago and keeps the graves', async () => {
    const now = Date.now();
    const storage = fakeStorage({
      graves: [
        makeGrave('old', { buriedAt: now - 8 * DAY, excerpt: 'old text' }),
        makeGrave('edge', { buriedAt: now - 7 * DAY + 60_000, excerpt: 'edge text' }),
        makeGrave('new', { buriedAt: now - DAY, excerpt: 'new text' }),
      ],
    });
    expect(await pruneExcerpts(storage.adapter)).toBe(1);
    expect(storage.graves().map((g) => [g.id, g.excerpt])).toEqual([['old', undefined], ['edge', 'edge text'], ['new', 'new text']]);
    expect(await pruneExcerpts(storage.adapter)).toBe(0);
  });
});
