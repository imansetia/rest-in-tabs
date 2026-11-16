// Messages that extension pages (Popup, Graveyard) send to the service worker.

export type Message =
  | { type: 'buryTab'; tabId: number }
  | { type: 'buryIdle' }
  | { type: 'resurrect'; graveId: string }
  | { type: 'exorcise'; graveId: string };

export type ErrorCode =
  | 'bad-request' // message did not parse
  | 'not-found' // tab or grave no longer exists
  | 'not-allowed' // private window or non-http(s) page
  | 'open-failed' // the resurrected tab could not be opened
  | 'save-failed' // storage write failed
  | 'failed'; // unexpected error

export type MessageResponse = { ok: true; count?: number } | { ok: false; error: ErrorCode };

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
    case 'resurrect':
      return typeof graveId === 'string' && graveId !== '' ? { type: 'resurrect', graveId } : null;
    case 'exorcise':
      return typeof graveId === 'string' && graveId !== '' ? { type: 'exorcise', graveId } : null;
    default:
      return null;
  }
}
