// Where focus goes after a grave leaves (task 11.12). Pure.

/**
 * After the grave `removedId` is exorcised, focus moves to the nearest grave:
 * the next one, else the previous one (in the order the user tabs through).
 * Returns every candidate, nearest first, alternating forward first, so the
 * caller can skip graves that have left meanwhile:
 * next, previous, next but one, previous but one, …
 * Graves are in `order` (ids in tab order). Unknown id: no candidates.
 */
export function focusCandidates(order: readonly string[], removedId: string): string[] {
  const at = order.indexOf(removedId);
  if (at === -1) return [];
  const candidates: string[] = [];
  for (let step = 1; at + step < order.length || at - step >= 0; step++) {
    if (at + step < order.length) candidates.push(order[at + step]);
    if (at - step >= 0) candidates.push(order[at - step]);
  }
  return candidates;
}
