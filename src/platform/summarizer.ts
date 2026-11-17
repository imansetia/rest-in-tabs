// Adapter for the browser's built-in Summarizer API (Chrome and Edge 138+,
// on-device: Gemini Nano in Chrome, Phi in Edge; nothing is sent anywhere).
// Window contexts only, so it runs in the Graveyard page, never the service worker.
// Follows https://developer.chrome.com/docs/ai/summarizer-api (July 2025) and the
// Aug 2026 guide: the same options go to availability() and create(); create()
// gets a monitor for downloadprogress; a download needs a user gesture.

import { parseAvailability, type AiAvailability } from '../core/ai-epitaph.js';

/** The parts of the API this extension uses (no typings package, so declared here). */
interface SummarizerOptions {
  type: 'tldr' | 'teaser' | 'key-points' | 'headline';
  format: 'plain-text' | 'markdown';
  length: 'short' | 'medium' | 'long';
  sharedContext?: string;
  expectedInputLanguages?: string[];
  outputLanguage?: string;
  monitor?: (m: EventTarget) => void;
}
interface SummarizerSession {
  summarize(input: string, options?: { context?: string }): Promise<string>;
  destroy(): void;
}
interface SummarizerStatic {
  availability(options: SummarizerOptions): Promise<string>;
  create(options: SummarizerOptions): Promise<SummarizerSession>;
}

/** One short factual sentence in English, as the epitaph steering rules ask. */
export const SUMMARIZER_OPTIONS: SummarizerOptions = {
  type: 'tldr',
  format: 'plain-text',
  length: 'short',
  sharedContext: 'A web page the user kept open to read later. Summarise what the page is about in one plain, factual sentence.',
  expectedInputLanguages: ['en', 'de', 'es', 'fr', 'ja'],
  outputLanguage: 'en',
};

function api(): SummarizerStatic | null {
  const candidate = (globalThis as { Summarizer?: unknown }).Summarizer;
  return (typeof candidate === 'object' && candidate !== null) || typeof candidate === 'function' ? (candidate as SummarizerStatic) : null;
}

/** 'unavailable' when the API is missing (older browsers) or the check throws. */
export async function checkAvailability(): Promise<AiAvailability> {
  const summarizer = api();
  if (summarizer === null) return 'unavailable';
  try {
    return parseAvailability(await summarizer.availability(SUMMARIZER_OPTIONS));
  } catch (err) {
    console.error('Could not check the Summarizer:', err);
    return 'unavailable';
  }
}

export interface OpenSummarizer {
  summarize(text: string): Promise<string>;
  destroy(): void;
}

/**
 * Create one summarizer session and reuse it for every grave (creating one per
 * grave would load the model each time). When the status is "downloadable",
 * call this from a click: create() starts the download, and `onProgress` gets
 * loaded and total (total may be absent, then loaded is a fraction). Throws when
 * the status is neither "available" nor "downloadable", or when create() fails.
 */
export async function openSummarizer(onProgress?: (loaded: number, total: number) => void): Promise<OpenSummarizer> {
  const summarizer = api();
  const status = await checkAvailability();
  if (summarizer === null || (status !== 'available' && status !== 'downloadable')) {
    throw new Error(`Summarizer not usable: ${status}`);
  }
  const session = await summarizer.create({
    ...SUMMARIZER_OPTIONS,
    monitor(m) {
      m.addEventListener('downloadprogress', (event) => {
        const e = event as Event & { loaded?: number; total?: number };
        onProgress?.(e.loaded ?? 0, e.total ?? 1);
      });
    },
  });
  return {
    async summarize(text) {
      try {
        return await session.summarize(text);
      } catch (err) {
        // A long excerpt can exceed the model's input quota: try once with the first half.
        if (err instanceof DOMException && err.name === 'QuotaExceededError' && text.length > 200) {
          return session.summarize(text.slice(0, Math.floor(text.length / 2)));
        }
        throw err;
      }
    },
    destroy: () => session.destroy(),
  };
}
