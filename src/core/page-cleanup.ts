import type { PageInfo } from './types.js';
import { EXCERPT_MAX } from './types.js';

/**
 * Clean up raw page data extracted from a content script.
 *
 * Rules:
 * - Empty strings are converted to undefined.
 * - excerpt is truncated to EXCERPT_MAX characters (by UTF-16 code unit).
 * - All other fields are passed through as-is (trimming happens later in
 *   fallbackEpitaph).
 *
 * This is used by the platform extract adapter to normalize data before
 * it reaches the core burial logic.
 */
export function cleanupPageInfo(raw: {
  title?: string;
  metaDescription?: string;
  firstParagraph?: string;
  excerpt?: string;
}): PageInfo {
  const emptyToUndefined = (s: string | undefined): string | undefined => {
    if (s === undefined || s === '') return undefined;
    return s;
  };

  return {
    title: raw.title ?? '',
    metaDescription: emptyToUndefined(raw.metaDescription),
    firstParagraph: emptyToUndefined(raw.firstParagraph),
    excerpt: raw.excerpt !== undefined && raw.excerpt !== ''
      ? raw.excerpt.slice(0, EXCERPT_MAX)
      : undefined,
  };
}
