import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseDemoDays, demoNow, demoLabel, DEMO_DAYS_MAX } from './demo-clock.js';
import { decayStage } from './decay.js';
import { timeAgo, stoneLabel } from './stone-text.js';

const HOUR = 3_600_000, DAY = 24 * HOUR;

describe('parseDemoDays', () => {
  it('whole days from 0 to 14; anything else becomes 0 or is clamped', () => {
    expect(parseDemoDays('3')).toBe(3);
    expect(parseDemoDays(7)).toBe(7);
    expect(parseDemoDays('20')).toBe(DEMO_DAYS_MAX);
    expect(parseDemoDays(-2)).toBe(0);
    expect(parseDemoDays('2.6')).toBe(3);
    for (const v of ['', 'x', null, undefined, Number.NaN, Infinity]) expect(parseDemoDays(v)).toBe(0);
  });
});

describe('demoLabel', () => {
  it('"+N days", singular for one, as the mockup', () => {
    expect(demoLabel(0)).toBe('+0 days');
    expect(demoLabel(1)).toBe('+1 day');
    expect(demoLabel(14)).toBe('+14 days');
  });
});

describe('demoNow (Requirement 8.6: stages and "x ago" move together)', () => {
  it('moves the displayed time forward by whole days, never back', () => {
    expect(demoNow(1000, 0)).toBe(1000);
    expect(demoNow(1000, 3)).toBe(1000 + 3 * DAY);
    expect(demoNow(1000, 99)).toBe(1000 + 14 * DAY);
  });

  it('a grave buried 2 hours ago reads Fresh at +0, Weathered at +2, Crumbling at +8, and the text agrees', () => {
    const now = 1_800_000_000_000, buriedAt = now - 2 * HOUR;
    const at = (days: number) => {
      const shown = demoNow(now, days);
      const stage = decayStage(buriedAt, shown);
      return { stage, ago: timeAgo(buriedAt, shown), label: stoneLabel({ title: 'T', domain: 'd', buriedAt }, stage, shown) };
    };
    expect(at(0)).toEqual({ stage: 'fresh', ago: '2 hours ago', label: 'T. Fresh. Buried 2 hours ago.' });
    expect(at(1)).toEqual({ stage: 'weathered', ago: '26 hours ago', label: 'T. Weathered. Buried 26 hours ago.' });
    expect(at(2)).toEqual({ stage: 'weathered', ago: '2 days ago', label: 'T. Weathered. Buried 2 days ago.' }); // 50 h: days from 48 h
    expect(at(8)).toEqual({ stage: 'crumbling', ago: '8 days ago', label: 'T. Crumbling. Buried 8 days ago.' });
  });

  it('never makes a Crumbling stone say it was buried less than 7 days ago', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 * DAY }), fc.integer({ min: 0, max: 14 }), (age, days) => {
        const now = 1_800_000_000_000;
        const shown = demoNow(now, days);
        const stage = decayStage(now - age, shown);
        const ago = timeAgo(now - age, shown);
        if (stage === 'crumbling') expect(ago).toMatch(/^(\d+ days|\d+ months?) ago$/);
        if (stage === 'fresh') expect(ago).toMatch(/^(just now|\d+ hours? ago)$/);
      }),
      { numRuns: 300 },
    );
  });
});
