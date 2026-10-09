import { describe, expect, it } from 'vitest';
import { platformLayerName } from './index';

describe('platform layer', () => {
  it('exposes its layer name', () => {
    expect(platformLayerName()).toBe('platform');
  });
});
