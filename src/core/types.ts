// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of Graves kept in storage. */
export const GRAVE_CAP = 2_000;

/** Maximum length of an Epitaph string in characters. */
export const EPITAPH_MAX = 200;

/**
 * Estimated memory freed per buried tab, in megabytes.
 * Shown in the stats bar labelled as an estimate ("≈ N MB").
 */
export const EST_MB_PER_TAB = 50;

/**
 * Maximum length of the page excerpt stored alongside the fallback Epitaph,
 * in characters. Dropped after an AI upgrade or after 7 days.
 */
export const EXCERPT_MAX = 4_000;

/** Number of days after which a stored excerpt is pruned regardless of AI upgrade. */
export const EXCERPT_MAX_AGE_DAYS = 7;

// ---------------------------------------------------------------------------
// Tab information (read from chrome.tabs.Tab by the platform adapter)
// ---------------------------------------------------------------------------

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  active: boolean;
  pinned: boolean;
  audible: boolean;
  incognito: boolean;
  /** Milliseconds since Unix epoch, taken from chrome.tabs.Tab.lastAccessed. */
  lastAccessed: number;
}

// ---------------------------------------------------------------------------
// Page information (extracted by content script / scripting.executeScript)
// ---------------------------------------------------------------------------

export interface PageInfo {
  title: string;
  metaDescription?: string;
  firstParagraph?: string;
  /** Raw text excerpt for the AI summarizer, up to EXCERPT_MAX characters. */
  excerpt?: string;
}

// ---------------------------------------------------------------------------
// Grave (the saved record of one buried tab)
// ---------------------------------------------------------------------------

export type EpitaphSource = 'ai' | 'meta' | 'paragraph' | 'title';

export interface Grave {
  /** Unique identifier, produced by crypto.randomUUID(). */
  id: string;
  url: string;
  title: string;
  /** Lower-cased hostname from new URL(url).hostname, e.g. "docs.example.com". */
  domain: string;
  favIconUrl?: string;
  /** Milliseconds since Unix epoch when the tab was buried. */
  buriedAt: number;
  /** Milliseconds since Unix epoch when the tab was last accessed before burial. */
  lastAccessed: number;
  /** Summary text shown on the tombstone. 1–EPITAPH_MAX characters. */
  epitaph: string;
  epitaphSource: EpitaphSource;
  /**
   * Raw page excerpt stored at burial for later AI summarisation.
   * Deleted after the Epitaph is upgraded by the AI, or after EXCERPT_MAX_AGE_DAYS.
   */
  excerpt?: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
  /** When true, the extension buries idle tabs automatically. Default: true. */
  autoBury: boolean;
  /**
   * How long (in whole minutes) a tab must go unused before it is buried
   * automatically. Range: 5–10080 (7 days). Default: 180 (3 hours).
   */
  idleMinutes: number;
  /**
   * Lower-cased domains whose tabs are never buried automatically.
   * A domain entry also covers all its subdomains. Default: [].
   */
  protectedSites: string[];
  /**
   * Number of days a Grave is kept before automatic removal.
   * null means "Never" — Graves are kept indefinitely. Range: 1–365 | null.
   * Default: 30.
   */
  retentionDays: number | null;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface Stats {
  /** Cumulative count of tabs buried since the extension was installed. */
  buried: number;
  /** Cumulative count of tabs resurrected since the extension was installed. */
  resurrected: number;
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  graves: 'graves',
  settings: 'settings',
  stats: 'stats',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
