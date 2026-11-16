import { describe, it, expect } from 'vitest';
import { cleanupPageInfo } from './page-cleanup.js';
import { EXCERPT_MAX } from './types.js';

describe('cleanupPageInfo', () => {
  it('passes through all fields when valid', () => {
    const result = cleanupPageInfo({
      title: 'Page Title',
      metaDescription: 'A description',
      firstParagraph: 'First paragraph text',
      excerpt: 'Some excerpt',
    });

    expect(result).toEqual({
      title: 'Page Title',
      metaDescription: 'A description',
      firstParagraph: 'First paragraph text',
      excerpt: 'Some excerpt',
    });
  });

  it('defaults title to empty string when missing', () => {
    const result = cleanupPageInfo({});
    expect(result.title).toBe('');
  });

  it('converts empty title to empty string (not undefined)', () => {
    const result = cleanupPageInfo({ title: '' });
    expect(result.title).toBe('');
  });

  it('converts empty metaDescription to undefined', () => {
    const result = cleanupPageInfo({ title: 'T', metaDescription: '' });
    expect(result.metaDescription).toBeUndefined();
  });

  it('converts empty firstParagraph to undefined', () => {
    const result = cleanupPageInfo({ title: 'T', firstParagraph: '' });
    expect(result.firstParagraph).toBeUndefined();
  });

  it('converts empty excerpt to undefined', () => {
    const result = cleanupPageInfo({ title: 'T', excerpt: '' });
    expect(result.excerpt).toBeUndefined();
  });

  it('converts undefined metaDescription to undefined', () => {
    const result = cleanupPageInfo({ title: 'T' });
    expect(result.metaDescription).toBeUndefined();
  });

  it('converts undefined firstParagraph to undefined', () => {
    const result = cleanupPageInfo({ title: 'T' });
    expect(result.firstParagraph).toBeUndefined();
  });

  it('converts undefined excerpt to undefined', () => {
    const result = cleanupPageInfo({ title: 'T' });
    expect(result.excerpt).toBeUndefined();
  });

  it('truncates excerpt to EXCERPT_MAX characters', () => {
    const longExcerpt = 'x'.repeat(EXCERPT_MAX + 100);
    const result = cleanupPageInfo({ title: 'T', excerpt: longExcerpt });
    expect(result.excerpt?.length).toBe(EXCERPT_MAX);
  });

  it('does not truncate excerpt shorter than EXCERPT_MAX', () => {
    const shortExcerpt = 'x'.repeat(EXCERPT_MAX - 10);
    const result = cleanupPageInfo({ title: 'T', excerpt: shortExcerpt });
    expect(result.excerpt).toBe(shortExcerpt);
  });

  it('does not truncate excerpt exactly EXCERPT_MAX characters', () => {
    const exactExcerpt = 'x'.repeat(EXCERPT_MAX);
    const result = cleanupPageInfo({ title: 'T', excerpt: exactExcerpt });
    expect(result.excerpt).toBe(exactExcerpt);
  });

  it('does not trim or collapse whitespace (done later in fallbackEpitaph)', () => {
    const result = cleanupPageInfo({
      title: '  Title  ',
      metaDescription: '  Meta  ',
      firstParagraph: '  Para  ',
      excerpt: '  Excerpt  ',
    });

    expect(result.title).toBe('  Title  ');
    expect(result.metaDescription).toBe('  Meta  ');
    expect(result.firstParagraph).toBe('  Para  ');
    expect(result.excerpt).toBe('  Excerpt  ');
  });
});
