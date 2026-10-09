import { describe, expect, it } from 'vitest';
import { coreLayerName } from './index';

describe('core layer', () => {
  it('exposes its layer name', () => {
    expect(coreLayerName()).toBe('core');
  });
});
