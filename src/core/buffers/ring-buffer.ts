/**
 * A fixed-capacity buffer that keeps the most recent items and drops the oldest
 * when full (PRD FR-3). Push is O(1); reading the contents is O(size).
 */
export class RingBuffer<T> {
  readonly #capacity: number;
  #items: T[] = [];
  #next = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(
        `RingBuffer capacity must be a positive integer, received ${String(capacity)}`,
      );
    }
    this.#capacity = capacity;
  }

  /** The maximum number of items held. */
  get capacity(): number {
    return this.#capacity;
  }

  /** The number of items currently held (never above the capacity). */
  get size(): number {
    return this.#items.length;
  }

  /** Adds an item, evicting the oldest when the buffer is already full. */
  push(item: T): void {
    if (this.#items.length < this.#capacity) {
      this.#items.push(item);
    } else {
      this.#items[this.#next] = item;
    }
    this.#next = (this.#next + 1) % this.#capacity;
  }

  /** Returns the items in insertion order, oldest first. */
  toArray(): readonly T[] {
    if (this.#items.length < this.#capacity || this.#next === 0) {
      return [...this.#items];
    }
    return [...this.#items.slice(this.#next), ...this.#items.slice(0, this.#next)];
  }

  /** Removes every item. */
  clear(): void {
    this.#items = [];
    this.#next = 0;
  }
}
