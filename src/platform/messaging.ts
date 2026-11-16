import type { Message, MessageResponse } from '../core/messages.js';
import { parseResponse } from '../core/messages.js';

/**
 * Send a message to the service worker and wait for its reply.
 *
 * Never rejects: if the service worker cannot be reached or replies with
 * something malformed, the result is { ok: false, error: 'failed' }.
 */
export async function sendMessage(message: Message): Promise<MessageResponse> {
  try {
    return parseResponse(await chrome.runtime.sendMessage(message));
  } catch (err) {
    console.error(`Message ${message.type} could not be delivered:`, err);
    return { ok: false, error: 'failed' };
  }
}
