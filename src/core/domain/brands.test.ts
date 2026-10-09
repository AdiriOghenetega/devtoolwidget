import { describe, expect, it } from 'vitest';
import { toBytes, toMillis, toTabId } from './brands';

describe('branded number constructors', () => {
  it('preserve the underlying runtime value', () => {
    expect(toMillis(123)).toBe(123);
    expect(toTabId(7)).toBe(7);
    expect(toBytes(2048)).toBe(2048);
  });
});
