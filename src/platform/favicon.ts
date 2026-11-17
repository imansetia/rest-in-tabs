import { faviconSrc, samePixels, NO_ICON_PAGE_URL } from '../core/icon.js';

/** Icon URL for a page, from Chrome's _favicon endpoint under this extension's origin. */
export function iconSrc(pageUrl: string): string {
  return faviconSrc(chrome.runtime.getURL('/'), pageUrl, 32);
}

/** RGBA bytes of a loaded image (same origin, so the canvas is readable), or null if it has no pixels. */
function pixels(img: HTMLImageElement): Uint8ClampedArray | null {
  const { naturalWidth: w, naturalHeight: h } = img;
  if (w === 0 || h === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return null;
  context.drawImage(img, 0, 0);
  try {
    return context.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
}

let placeholder: Promise<Uint8ClampedArray | null> | undefined;

/** The browser's placeholder icon, read once per page from a page that never has an icon. */
function placeholderPixels(): Promise<Uint8ClampedArray | null> {
  placeholder ??= new Promise((resolve) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(pixels(img)), { once: true });
    img.addEventListener('error', () => resolve(null), { once: true });
    img.src = iconSrc(NO_ICON_PAGE_URL);
  });
  return placeholder;
}

/**
 * True when a loaded icon is not a real favicon: the endpoint's generic
 * placeholder (no icon stored for the page) or an image without pixels. The
 * caller then removes it so the letter shows. If the placeholder itself cannot
 * be read, every loaded icon counts as real.
 */
export async function isMissingIcon(img: HTMLImageElement): Promise<boolean> {
  const own = pixels(img);
  if (own === null) return true;
  const reference = await placeholderPixels();
  return reference !== null && samePixels(own, reference);
}
