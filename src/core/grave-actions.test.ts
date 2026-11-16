import { describe, it, expect, vi, afterEach } from 'vitest';
import { resurrect, exorcise, expireGraves } from './grave-actions.js';
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
