import { describe, expect, it } from 'vitest';
import { stableFindingId } from './ids';

describe('stableFindingId', () => {
  it('is deterministic for the same rule and key', () => {
    expect(stableFindingId('R01', 'https://a.test')).toBe(stableFindingId('R01', 'https://a.test'));
  });

  it('differs across keys and rules', () => {
    expect(stableFindingId('R01', 'https://a.test')).not.toBe(
      stableFindingId('R01', 'https://b.test'),
    );
    expect(stableFindingId('R01', 'https://a.test')).not.toBe(
      stableFindingId('R02', 'https://a.test'),
    );
  });
});
