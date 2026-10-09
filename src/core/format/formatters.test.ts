import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatPercent } from './formatters';

describe('formatBytes', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1000)).toBe('1.0 KB');
    expect(formatBytes(1500)).toBe('1.5 KB');
    expect(formatBytes(150_000)).toBe('150 KB');
    expect(formatBytes(1_500_000)).toBe('1.5 MB');
  });

  it('handles negatives and non-finite values', () => {
    expect(formatBytes(-1000)).toBe('-1.0 KB');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('\u2014');
  });

  it('always produces a value with a known unit (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000_000_000_000, max: 1_000_000_000_000_000 }),
        (bytes: number) => {
          expect(formatBytes(bytes)).toMatch(/^-?\d+(\.\d+)? (B|KB|MB|GB|TB)$/);
        },
      ),
    );
  });
});

describe('formatDuration', () => {
  it('formats milliseconds, seconds and minutes', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(999)).toBe('999 ms');
    expect(formatDuration(1000)).toBe('1.0 s');
    expect(formatDuration(1500)).toBe('1.5 s');
    expect(formatDuration(60_000)).toBe('1.0 min');
    expect(formatDuration(-1500)).toBe('-1.5 s');
    expect(formatDuration(Number.NaN)).toBe('\u2014');
  });

  it('keeps sub-second values in milliseconds (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), (milliseconds: number) => {
        expect(formatDuration(milliseconds)).toMatch(/^\d+ ms$/);
      }),
    );
  });
});

describe('formatPercent', () => {
  it('formats a fraction as a percentage', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.123)).toBe('12%');
    expect(formatPercent(0.123, { fractionDigits: 1 })).toBe('12.3%');
    expect(formatPercent(Number.NaN)).toBe('\u2014');
  });

  it('always ends in a percent sign for fractions in 0..1 (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (fraction: number) => {
        expect(formatPercent(fraction)).toMatch(/^\d+(\.\d+)?%$/);
      }),
    );
  });
});
