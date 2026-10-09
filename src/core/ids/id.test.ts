import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createIdFactory } from './id';

describe('createIdFactory', () => {
  it('produces deterministic ids from the injected clock and randomness', () => {
    const factory = createIdFactory({ now: () => 1000, random: () => 0 });

    expect(factory()).toBe('rs-1-0');
    expect(factory()).toBe('rs-2-0');
  });

  it('reflects injected randomness', () => {
    const factory = createIdFactory({ now: () => 0, random: () => 0.5 });
    expect(factory()).toBe('0-1-4zsow');
  });

  it('reproduces the same sequence for identical injected values (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { maxLength: 25 }),
        (randoms: readonly number[]) => {
          const run = (): string[] => {
            let index = 0;
            const factory = createIdFactory({
              now: () => 1_700_000_000_000,
              random: () => randoms[index++] ?? 0,
            });
            return randoms.map(() => factory());
          };

          expect(run()).toEqual(run());
        },
      ),
    );
  });

  it('never repeats an id in a session (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { maxLength: 500 }),
        (count: number, randoms: readonly number[]) => {
          let index = 0;
          const factory = createIdFactory({ now: () => 0, random: () => randoms[index++] ?? 0 });
          const ids = new Set<string>();
          for (let i = 0; i < count; i += 1) {
            ids.add(factory());
          }

          expect(ids.size).toBe(count);
        },
      ),
    );
  });
});
