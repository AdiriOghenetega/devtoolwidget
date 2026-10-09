import { describe, expect, it } from 'vitest';
import { captureLayerName } from './index';

describe('capture layer', () => {
  it('exposes its layer name', () => {
    expect(captureLayerName()).toBe('capture');
  });
});
