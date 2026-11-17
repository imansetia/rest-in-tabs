import { describe, it, expect } from 'vitest';
import { contrast } from './contrast.js';

describe('contrast', () => {
  it('gives the known WCAG values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
  });

  it('does not depend on the order of the colours', () => {
    expect(contrast('#ece6d8', '#4b5361')).toBe(contrast('#4b5361', '#ece6d8'));
  });
});
