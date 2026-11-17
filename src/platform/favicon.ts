import { faviconSrc } from '../core/icon.js';

/** Icon URL for a page, from Chrome's _favicon endpoint under this extension's origin. */
export function iconSrc(pageUrl: string): string {
  return faviconSrc(chrome.runtime.getURL('/'), pageUrl, 32);
}
