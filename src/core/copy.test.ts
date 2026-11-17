import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  errorText,
  blockReasonText,
  graveCountText,
  buryIdleResultText,
  idleButtonState,
  formatCount,
  formatMemory,
  freedMemoryText,
  exorciseConfirmText,
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

describe('graveCountText', () => {
  it('handles zero, one and many', () => {
    expect(graveCountText(0)).toBe('No graves yet.');
    expect(graveCountText(1)).toBe('1 grave');
    expect(graveCountText(2)).toBe('2 graves');
    expect(graveCountText(2000)).toBe('2,000 graves');
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
