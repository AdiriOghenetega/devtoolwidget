import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { RingBuffer } from './ring-buffer';

describe('RingBuffer', () => {
  it('rejects a capacity that is not a positive integer', () => {
    expect(() => new RingBuffer<number>(0)).toThrow(RangeError);
    expect(() => new RingBuffer<number>(-1)).toThrow(RangeError);
    expect(() => new RingBuffer<number>(1.5)).toThrow(RangeError);
  });

  it('keeps items in insertion order below capacity', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);

    expect(buffer.capacity).toBe(3);
    expect(buffer.size).toBe(2);
    expect(buffer.toArray()).toEqual([1, 2]);
  });

  it('drops the oldest item once full', () => {
    const buffer = new RingBuffer<number>(3);
    for (const value of [1, 2, 3, 4, 5]) {
      buffer.push(value);
    }

    expect(buffer.size).toBe(3);
    expect(buffer.toArray()).toEqual([3, 4, 5]);
  });

  it('is empty before any push and after clear', () => {
    const buffer = new RingBuffer<number>(2);
    expect(buffer.toArray()).toEqual([]);

    buffer.push(1);
    buffer.push(2);
    buffer.clear();

    expect(buffer.size).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });

  it('distinguishes a stored undefined value from an empty slot', () => {
    const buffer = new RingBuffer<number | undefined>(2);
    buffer.push(undefined);
    buffer.push(1);
    buffer.push(undefined);

    expect(buffer.toArray()).toEqual([1, undefined]);
  });

  it('keeps exactly the last N items for any capacity and input (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.array(fc.integer(), { maxLength: 100 }),
        (capacity: number, values: readonly number[]) => {
          const buffer = new RingBuffer<number>(capacity);
          for (const value of values) {
            buffer.push(value);
          }

          const expected = values.slice(Math.max(0, values.length - capacity));
          expect(buffer.toArray()).toEqual(expected);
          expect(buffer.size).toBe(Math.min(values.length, capacity));
        },
      ),
    );
  });

  it('never exceeds its capacity or loses sync between size and contents (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.anything(), { maxLength: 50 }),
        (capacity: number, values: readonly unknown[]) => {
          const buffer = new RingBuffer<unknown>(capacity);
          for (const value of values) {
            buffer.push(value);
          }

          expect(buffer.size).toBeLessThanOrEqual(capacity);
          expect(buffer.toArray()).toHaveLength(buffer.size);
        },
      ),
    );
  });
});
