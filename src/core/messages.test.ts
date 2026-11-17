import { describe, it, expect } from 'vitest';
import { parseMessage, parseResponse, ERROR_CODES, UPDATE_EPITAPH_MAX_CHARS } from './messages.js';

describe('parseResponse', () => {
  it('keeps well-formed replies', () => {
    expect(parseResponse({ ok: true })).toEqual({ ok: true });
    expect(parseResponse({ ok: true, count: 3 })).toEqual({ ok: true, count: 3 });
    for (const error of ERROR_CODES) {
      expect(parseResponse({ ok: false, error })).toEqual({ ok: false, error });
    }
  });

  it('drops a bad count but keeps ok: true', () => {
    expect(parseResponse({ ok: true, count: -1 })).toEqual({ ok: true });
    expect(parseResponse({ ok: true, count: '3' })).toEqual({ ok: true });
  });

  it('turns anything else into a generic failure', () => {
    for (const raw of [undefined, null, 'ok', {}, { ok: 'yes' }, { ok: false }, { ok: false, error: 'boom' }]) {
      expect(parseResponse(raw)).toEqual({ ok: false, error: 'failed' });
    }
  });
});

describe('parseMessage', () => {
  it('accepts each well-formed message', () => {
    expect(parseMessage({ type: 'buryTab', tabId: 7 })).toEqual({ type: 'buryTab', tabId: 7 });
    expect(parseMessage({ type: 'buryIdle' })).toEqual({ type: 'buryIdle' });
    expect(parseMessage({ type: 'countIdle' })).toEqual({ type: 'countIdle' });
    expect(parseMessage({ type: 'resurrect', graveId: 'g1' })).toEqual({ type: 'resurrect', graveId: 'g1' });
    expect(parseMessage({ type: 'exorcise', graveId: 'g1' })).toEqual({ type: 'exorcise', graveId: 'g1' });
  });

  it('drops extra fields', () => {
    expect(parseMessage({ type: 'buryIdle', autoBury: false })).toEqual({ type: 'buryIdle' });
  });

  it('rejects non-objects and unknown types', () => {
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage('buryIdle')).toBeNull();
    expect(parseMessage({ type: 'deleteEverything' })).toBeNull();
  });

  it('rejects a bad tabId', () => {
    expect(parseMessage({ type: 'buryTab' })).toBeNull();
    expect(parseMessage({ type: 'buryTab', tabId: '7' })).toBeNull();
    expect(parseMessage({ type: 'buryTab', tabId: 1.5 })).toBeNull();
    expect(parseMessage({ type: 'buryTab', tabId: -1 })).toBeNull();
  });

  it('accepts updateEpitaph with a grave id and some text, and drops extra fields', () => {
    expect(parseMessage({ type: 'updateEpitaph', graveId: 'g1', epitaph: 'A short summary.', epitaphSource: 'meta' }))
      .toEqual({ type: 'updateEpitaph', graveId: 'g1', epitaph: 'A short summary.' });
  });

  it('rejects updateEpitaph without an id, without text, or with too much text', () => {
    expect(parseMessage({ type: 'updateEpitaph', epitaph: 'x' })).toBeNull();
    expect(parseMessage({ type: 'updateEpitaph', graveId: 'g1' })).toBeNull();
    expect(parseMessage({ type: 'updateEpitaph', graveId: 'g1', epitaph: '   \n ' })).toBeNull();
    expect(parseMessage({ type: 'updateEpitaph', graveId: 'g1', epitaph: 42 })).toBeNull();
    expect(parseMessage({ type: 'updateEpitaph', graveId: 'g1', epitaph: 'x'.repeat(UPDATE_EPITAPH_MAX_CHARS) })).not.toBeNull();
    expect(parseMessage({ type: 'updateEpitaph', graveId: 'g1', epitaph: 'x'.repeat(UPDATE_EPITAPH_MAX_CHARS + 1) })).toBeNull();
  });

  it('rejects a missing or empty graveId', () => {
    expect(parseMessage({ type: 'resurrect' })).toBeNull();
    expect(parseMessage({ type: 'resurrect', graveId: '' })).toBeNull();
    expect(parseMessage({ type: 'exorcise', graveId: 42 })).toBeNull();
  });
});
