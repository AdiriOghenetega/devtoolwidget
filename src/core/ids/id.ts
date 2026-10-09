/** Clock and randomness injected so id generation is deterministic in tests. */
export interface IdFactoryDeps {
  /** Returns the current time in milliseconds. */
  readonly now: () => number;
  /** Returns a number in [0, 1). */
  readonly random: () => number;
}

const RANDOM_RANGE = 0x1000000;

/**
 * Creates a factory that yields ids from the injected clock, a monotonic
 * counter and injected randomness. Given the same dependency sequence the ids
 * are reproducible; the counter keeps them unique within a session.
 */
export function createIdFactory(deps: IdFactoryDeps): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    const time = Math.floor(deps.now()).toString(36);
    const entropy = Math.floor(deps.random() * RANDOM_RANGE).toString(36);
    return `${time}-${counter.toString(36)}-${entropy}`;
  };
}
