import type { PageInfo } from '../core/types.js';
import { cleanupPageInfo } from '../core/page-cleanup.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTRACTION_TIMEOUT_MS = 2000;

// ---------------------------------------------------------------------------
// extractPageInfo
// ---------------------------------------------------------------------------

/**
 * Extract page information (title, meta description, first paragraph, excerpt)
 * from a tab using chrome.scripting.executeScript.
 *
 * Rejects if:
 * - The tab is discarded
 * - The script cannot be injected (e.g., chrome:// pages, extension pages)
 * - The extraction times out (2 seconds)
 * - The script throws an error
 *
 * The caller should catch rejections and fall back to using the tab title
 * as the epitaph (Requirement 3.7).
 */
export async function extractPageInfo(tabId: number): Promise<PageInfo> {
  // Check if the tab is discarded first.
  const tab = await chrome.tabs.get(tabId);
  if (tab.discarded) {
    throw new Error('Tab is discarded');
  }

  // Race the extraction against a timeout.
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const extractionPromise = executeExtraction(tabId);
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Page extraction timed out')), EXTRACTION_TIMEOUT_MS);
  });

  try {
    const raw = await Promise.race([extractionPromise, timeoutPromise]);
    return cleanupPageInfo(raw);
  } finally {
    // Clear the timeout when the extraction settles.
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

// ---------------------------------------------------------------------------
// executeExtraction
// ---------------------------------------------------------------------------

/**
 * Execute the extraction script in the target tab.
 *
 * Throws if the tab is discarded or the script cannot be injected.
 */
async function executeExtraction(tabId: number): Promise<{
  title: string;
  metaDescription?: string;
  firstParagraph?: string;
  excerpt?: string;
}> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractFromPage,
  });

  // The script should return exactly one result.
  if (!results || results.length === 0) {
    throw new Error('No extraction result returned');
  }

  const result = results[0];

  // Check for script execution errors.
  if ('error' in result || !result.result) {
    throw new Error('Script execution failed');
  }

  return result.result;
}

// ---------------------------------------------------------------------------
// extractFromPage (injected script)
// ---------------------------------------------------------------------------

/**
 * Extraction function injected into the page context.
 *
 * This function runs in the page's DOM and returns the extracted data.
 * It must be serializable (no closure variables).
 */
function extractFromPage(): {
  title: string;
  metaDescription?: string;
  firstParagraph?: string;
  excerpt?: string;
} {
  // Title: prefer <title> tag content (if non-empty), fall back to document.title.
  const titleEl = document.querySelector('title');
  const titleText = titleEl?.textContent?.trim() || '';
  const title = titleText || document.title;

  // Meta description.
  const metaEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  const metaDescription = metaEl?.content;

  // First paragraph: first non-empty <p> tag.
  const paragraphs = Array.from(document.querySelectorAll('p'));
  const firstParagraph = paragraphs.find((p) => p.textContent?.trim())?.textContent ?? undefined;

  // Excerpt: first 8000 characters of visible text from body.
  // This is a rough estimate; exact limit is enforced by cleanupPageInfo.
  let excerpt: string | undefined;
  if (document.body) {
    const bodyText = document.body.innerText || document.body.textContent || '';
    excerpt = bodyText.slice(0, 8000);
  }

  return { title, metaDescription, firstParagraph, excerpt };
}
