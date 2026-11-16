import { describe, it, expect } from 'vitest';
import { parseMessage } from './messages.js';

describe('parseMessage', () => {
  it('accepts each well-formed message', () => {
    expect(parseMessage({ type: 'buryTab', tabId: 7 })).toEqual({ type: 'buryTab', tabId: 7 });
    expect(parseMessage({ type: 'buryIdle' })).toEqual({ type: 'buryIdle' });
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

  it('rejects a missing or empty graveId', () => {
    expect(parseMessage({ type: 'resurrect' })).toBeNull();
    expect(parseMessage({ type: 'resurrect', graveId: '' })).toBeNull();
    expect(parseMessage({ type: 'exorcise', graveId: 42 })).toBeNull();
  });
});
