/**
 * Runs async operations one at a time, in the order they were enqueued.
 * A failed operation does not block the ones after it.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

/**
 * Chains whole burial runs (alarm, buryIdle, buryTab). A run starts only after
 * the previous one has finished and then queries tabs fresh, so two runs never
 * bury the same tab.
 */
export const runQueue = new SerialQueue();

/**
 * Serializes every read-modify-write of graves and stats (burial, resurrect,
 * exorcise, expiry). Separate from runQueue so a run can enqueue its own
 * writes without waiting on itself.
 */
export const writeQueue = new SerialQueue();
