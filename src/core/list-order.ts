// List view sort orders, as renderList in design/mockup.html (Requirement 4.3).

import type { Grave } from './types.js';

export const LIST_ORDERS = ['new', 'old', 'name'] as const;
export type ListOrder = (typeof LIST_ORDERS)[number];

/** Parse a sort select value; anything unknown is the default, newest first. */
export function parseListOrder(value: string): ListOrder {
  return (LIST_ORDERS as readonly string[]).includes(value) ? (value as ListOrder) : 'new';
}

/**
 * A sorted copy:
 * - 'new': most recently buried first (the default)
 * - 'old': least recently buried first
 * - 'name': by title, A to Z (English collation, so case and accents sort naturally)
 * Ties keep their input order.
 */
export function sortForList(graves: Grave[], order: ListOrder): Grave[] {
  const sorted = [...graves];
  if (order === 'old') sorted.sort((a, b) => a.buriedAt - b.buriedAt);
  else if (order === 'name') sorted.sort((a, b) => a.title.localeCompare(b.title, 'en'));
  else sorted.sort((a, b) => b.buriedAt - a.buriedAt);
  return sorted;
}
