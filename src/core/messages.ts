// Messages that extension pages (Popup, Graveyard) send to the service worker.

export type Message =
  | { type: 'buryTab'; tabId: number }
  | { type: 'buryIdle' }
  | { type: 'countIdle' }
  | { type: 'resurrect'; graveId: string }
  | { type: 'exorcise'; graveId: string };

/**
 * - bad-request: message did not parse
 * - not-found:   tab or grave no longer exists
 * - not-allowed: private window or non-http(s) page
 * - open-failed: the resurrected tab could not be opened
 * - save-failed: storage write failed
 * - failed:      unexpected error, or no valid reply from the service worker
 */
export const ERROR_CODES = [
  'bad-request',
  'not-found',
  'not-allowed',
  'open-failed',
  'save-failed',
  'failed',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type MessageResponse = { ok: true; count?: number } | { ok: false; error: ErrorCode };

/**
 * Validate a reply from the service worker. Anything malformed (including
 * undefined, when no listener replied) becomes { ok: false, error: 'failed' }.
 */
export function parseResponse(raw: unknown): MessageResponse {
  if (raw !== null && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (r.ok === true) {
      const { count } = r;
      return typeof count === 'number' && Number.isInteger(count) && count >= 0
        ? { ok: true, count }
        : { ok: true };
    }
    if (r.ok === false && ERROR_CODES.includes(r.error as ErrorCode)) {
      return { ok: false, error: r.error as ErrorCode };
    }
  }
  return { ok: false, error: 'failed' };
}

/**
 * Validate an incoming message at the trust boundary.
 * Returns null for anything that is not a well-formed Message.
 */
export function parseMessage(raw: unknown): Message | null {
  if (raw === null || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const { tabId, graveId } = m;

  switch (m.type) {
    case 'buryTab':
      return typeof tabId === 'number' && Number.isInteger(tabId) && tabId >= 0
        ? { type: 'buryTab', tabId }
        : null;
    case 'buryIdle':
      return { type: 'buryIdle' };
    case 'countIdle':
      return { type: 'countIdle' };
    case 'resurrect':
      return typeof graveId === 'string' && graveId !== '' ? { type: 'resurrect', graveId } : null;
    case 'exorcise':
      return typeof graveId === 'string' && graveId !== '' ? { type: 'exorcise', graveId } : null;
    default:
      return null;
  }
}
