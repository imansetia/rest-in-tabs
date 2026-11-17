// Grave icons: Chrome's _favicon endpoint over a letter disc (Requirement 4.12).

/** Muted disc colours, from design/mockup.html (COLORS). */
export const DISC_COLORS = ['#7d93ad', '#a08470', '#76967f', '#9384a6', '#a57b78', '#7493a0', '#a39a73', '#8d9aa8'] as const;

/** Letter colour on the disc, from the mockup (.fav). */
export const DISC_LETTER_COLOR = '#10141b';

/**
 * The icon for a page from the browser's own favicon store, served under the
 * extension's origin (no network request, no third party):
 * `${extensionBase}_favicon/?pageUrl=…&size=…`.
 */
export function faviconSrc(extensionBase: string, pageUrl: string, size: number): string {
  const url = new URL('_favicon/', extensionBase);
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}

/** First character of the domain after a leading "www.", upper-cased (mockup: initial). */
export function letterFor(domain: string): string {
  const first = [...domain.replace(/^www\./i, '')][0];
  return first === undefined ? '' : first.toUpperCase();
}

/** One of the disc colours, chosen by the sum of the domain's char codes (mockup: colorFor). */
export function discColor(domain: string): string {
  const sum = [...domain].reduce((total, c) => total + c.charCodeAt(0), 0);
  return DISC_COLORS[sum % DISC_COLORS.length];
}
