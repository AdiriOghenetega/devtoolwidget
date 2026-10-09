import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, RingBuffer, formatBytes, ok, redactString, toMillis } from './index';

describe('core public API barrel', () => {
  it('re-exports the domain, result and utility APIs', () => {
    expect(DEFAULT_THRESHOLDS.maxRequests).toBe(100);
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(toMillis(5)).toBe(5);
    expect(formatBytes(1000)).toBe('1.0 KB');
    expect(redactString('Bearer abcdef')).toBe('Bearer REDACTED');

    const buffer = new RingBuffer<number>(2);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    expect(buffer.toArray()).toEqual([2, 3]);
  });
});
