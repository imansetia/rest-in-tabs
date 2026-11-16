/**
 * Parse the hostname from a URL, lower-case it, and strip one trailing dot
 * (FQDN form like "example.com.").
 *
 * Returns null when the URL cannot be parsed.
 *
 * Used by isProtected, canBuryManually, and createGrave to ensure consistent
 * hostname normalization across the extension.
 */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}
