import { describe, it, expect } from 'vitest';
import { longDate, stoneDate, stoneDates, timeAgo, stoneName, stoneLabel, STAGE_LABEL } from './stone-text.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('longDate', () => {
  it('formats as the mockup fmtLong', () => {
    expect(longDate(new Date(2026, 10, 15, 12).getTime())).toBe('15 November 2026');
    expect(longDate(new Date(2026, 0, 3, 12).getTime())).toBe('3 January 2026');
  });
});

describe('stoneDate / stoneDates', () => {
  it('formats as the mockup: day and short month in capitals', () => {
    expect(stoneDate(new Date(2026, 10, 15, 12).getTime())).toBe('15 NOV');
    expect(stoneDate(new Date(2026, 8, 5, 12).getTime())).toBe('5 SEPT');
    expect(stoneDates(new Date(2026, 10, 15, 12).getTime(), new Date(2026, 10, 17, 12).getTime())).toBe('15 NOV — 17 NOV');
  });
});

describe('timeAgo', () => {
  const now = 1_800_000_000_000;

  it('reads "just now" under one hour', () => {
    expect(timeAgo(now, now)).toBe('just now');
    expect(timeAgo(now - HOUR + 1, now)).toBe('just now');
    expect(timeAgo(now + 5 * HOUR, now)).toBe('just now'); // a future time counts as 0
  });

  it('uses the cause-of-death units otherwise', () => {
    expect(timeAgo(now - HOUR, now)).toBe('1 hour ago');
    expect(timeAgo(now - 5 * HOUR, now)).toBe('5 hours ago');
    expect(timeAgo(now - 3 * DAY, now)).toBe('3 days ago');
    expect(timeAgo(now - 65 * DAY, now)).toBe('2 months ago');
  });

  it('moves with displayNow, so the Demo clock can shift it', () => {
    const buried = now - 2 * HOUR;
    expect(timeAgo(buried, now)).toBe('2 hours ago');
    expect(timeAgo(buried, now + 10 * DAY)).toBe('10 days ago');
  });
});

describe('stoneName', () => {
  it('keeps the title up to the first " · "', () => {
    expect(stoneName('Fix flaky auth test · Pull Request #482', 'github.com')).toBe('Fix flaky auth test');
    expect(stoneName('Q3 budget memo', 'docs.google.com')).toBe('Q3 budget memo');
  });

  it('falls back to the domain when there is no title', () => {
    expect(stoneName('', 'example.com')).toBe('example.com');
    expect(stoneName('   ', 'example.com')).toBe('example.com');
  });
});

describe('stoneLabel', () => {
  const now = 1_800_000_000_000;

  it('reads "Title. Condition. Buried 5 hours ago."', () => {
    const grave = { title: 'Fix flaky auth test · Pull Request #482', domain: 'github.com', buriedAt: now - 5 * HOUR };
    expect(stoneLabel(grave, 'fresh', now)).toBe('Fix flaky auth test · Pull Request #482. Fresh. Buried 5 hours ago.');
  });

  it('uses every condition label and "just now"', () => {
    const grave = { title: 'Page', domain: 'example.com', buriedAt: now };
    expect(stoneLabel(grave, 'weathered', now)).toBe('Page. Weathered. Buried just now.');
    expect(stoneLabel(grave, 'crumbling', now)).toBe('Page. Crumbling. Buried just now.');
    expect(Object.values(STAGE_LABEL)).toEqual(['Fresh', 'Weathered', 'Crumbling']);
  });

  it('uses the domain when the title is empty', () => {
    expect(stoneLabel({ title: '', domain: 'example.com', buriedAt: now }, 'fresh', now)).toBe('example.com. Fresh. Buried just now.');
  });
});
