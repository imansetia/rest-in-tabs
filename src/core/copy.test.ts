import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  errorText,
  blockReasonText,
  tabsAtRestText,
  lastBuriedText,
  NOTHING_BURIED_TEXT,
  buryIdleResultText,
  idleButtonState,
  formatCount,
  formatMemory,
  freedMemoryText,
  exorciseConfirmText,
  listCountText,
  BURY_TAB_DONE_TEXT,
  RESURRECT_DONE_TEXT,
  EXORCISE_DONE_TEXT,
} from './copy.js';
import { ERROR_CODES } from './messages.js';

describe('errorText', () => {
  it('gives every error code a short, distinct sentence', () => {
    const texts = ERROR_CODES.map(errorText);
    for (const text of texts) {
      expect(text).toBe(text.trim());
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(60);
      expect(text).toMatch(/\.$/);
    }
    expect(new Set(texts).size).toBe(ERROR_CODES.length);
  });

  it('uses the Graveyard wording for a failed resurrect (design Error Handling)', () => {
    expect(errorText('open-failed')).toBe('Could not reopen this page.');
  });
});

describe('blockReasonText', () => {
  it('explains each reason', () => {
    expect(blockReasonText('private')).toMatch(/private/i);
    expect(blockReasonText('unsupported-page')).toMatch(/http/);
    expect(blockReasonText('no-tab').length).toBeGreaterThan(0);
  });
});

describe('tabsAtRestText', () => {
  it('handles zero, one and many, as "<b>26</b> tabs at rest" in the mockup', () => {
    expect(tabsAtRestText(0)).toEqual({ number: '0', words: 'tabs at rest' });
    expect(tabsAtRestText(1)).toEqual({ number: '1', words: 'tab at rest' });
    expect(tabsAtRestText(26)).toEqual({ number: '26', words: 'tabs at rest' });
    expect(tabsAtRestText(2000)).toEqual({ number: '2,000', words: 'tabs at rest' });
  });
});

describe('lastBuriedText', () => {
  it('is the newest Epitaph, whatever the order', () => {
    const graves = [
      { buriedAt: 10, epitaph: 'Older.' },
      { buriedAt: 30, epitaph: 'Newest.' },
      { buriedAt: 20, epitaph: 'Middle.' },
    ];
    expect(lastBuriedText(graves)).toBe('Newest.');
    expect(lastBuriedText([...graves].reverse())).toBe('Newest.');
  });

  it('says "Nothing yet." when there are no graves', () => {
    expect(lastBuriedText([])).toBe(NOTHING_BURIED_TEXT);
    expect(NOTHING_BURIED_TEXT).toBe('Nothing yet.');
  });

  it('always returns the Epitaph of a grave with the latest burial time', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ buriedAt: fc.integer({ min: 0, max: 1e12 }), epitaph: fc.string({ minLength: 1 }) }), { minLength: 1, maxLength: 40 }), (graves) => {
        const latest = Math.max(...graves.map((g) => g.buriedAt));
        expect(graves.filter((g) => g.buriedAt === latest).map((g) => g.epitaph)).toContain(lastBuriedText(graves));
      }),
      { numRuns: 200 },
    );
  });
});

describe('buryIdleResultText', () => {
  it('handles zero, one and many', () => {
    expect(buryIdleResultText(0)).toBe('No idle tabs to bury.');
    expect(buryIdleResultText(1)).toBe('Buried 1 idle tab.');
    expect(buryIdleResultText(12)).toBe('Buried 12 idle tabs.');
  });

  it('"Bury this tab" has its own toast', () => {
    expect(BURY_TAB_DONE_TEXT).toBe('Tab buried.');
  });
});

describe('stats bar', () => {
  it('formats counts with thousands separators', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(46)).toBe('46');
    expect(formatCount(1204)).toBe('1,204');
  });

  it('shows memory as whole MB below 1,000 MB and GB with one decimal from there', () => {
    expect(formatMemory(0)).toBe('0 MB');
    expect(formatMemory(50)).toBe('50 MB');
    expect(formatMemory(950)).toBe('950 MB');
    expect(formatMemory(1000)).toBe('1.0 GB');
    expect(formatMemory(2300)).toBe('2.3 GB'); // 46 buried, as in the mockup
    expect(formatMemory(1_000_000)).toBe('1,000.0 GB');
  });

  it('always uses MB below 1,000 MB and a decimal point in GB', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }).map((buried) => buried * 50), (mb) => {
        const text = formatMemory(mb);
        if (mb < 1000) expect(text).toMatch(/^\d{1,3} MB$/);
        else expect(text).toMatch(/^[\d,]+\.\d GB$/);
      }),
      { numRuns: 300 },
    );
  });

  it('labels the figure as an estimate', () => {
    expect(freedMemoryText(2300)).toBe('≈ 2.3 GB freed (estimated)');
    expect(freedMemoryText(0)).toBe('≈ 0 MB freed (estimated)');
  });
});

describe('listCountText', () => {
  it('reads "N of M graves"', () => {
    expect(listCountText(3, 26)).toBe('3 of 26 graves');
    expect(listCountText(0, 0)).toBe('0 of 0 graves');
    expect(listCountText(1, 1)).toBe('1 of 1 grave');
    expect(listCountText(1204, 2000)).toBe('1,204 of 2,000 graves');
  });
});

describe('Plaque copy', () => {
  it('uses the steering file wording', () => {
    expect(RESURRECT_DONE_TEXT).toBe('Reopened in a new tab.');
    expect(EXORCISE_DONE_TEXT).toBe('Grave deleted permanently.');
    expect(exorciseConfirmText('Q3 budget memo')).toBe('“Q3 budget memo” will be deleted permanently. This cannot be undone.');
  });
});

describe('idleButtonState', () => {
  it('reads "Bury idle tabs" and stays usable before the first count', () => {
    expect(idleButtonState(null)).toEqual({ label: 'Bury idle tabs', available: true });
  });

  it('is unavailable with "No idle tabs to bury" when the count is 0', () => {
    expect(idleButtonState(0)).toEqual({ label: 'No idle tabs to bury', available: false });
  });

  it('shows the count otherwise', () => {
    expect(idleButtonState(1)).toEqual({ label: 'Bury 1 idle tab', available: true });
    expect(idleButtonState(12)).toEqual({ label: 'Bury 12 idle tabs', available: true });
    expect(idleButtonState(2000)).toEqual({ label: 'Bury 2,000 idle tabs', available: true });
  });
});
