import { describe, expect, it } from 'vitest';
import { protocolLayerName } from './index';

describe('protocol layer', () => {
  it('exposes its layer name', () => {
    expect(protocolLayerName()).toBe('protocol');
  });
});
