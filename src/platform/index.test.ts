import { describe, expect, it } from 'vitest';
import { createChromePorts, createFakePorts } from './index';

describe('platform public API barrel', () => {
  it('exposes the fake ports and the chrome adapter factory', () => {
    const fakes = createFakePorts({ now: 42 });
    expect(fakes.clock.now()).toBe(42);
    expect(typeof createChromePorts).toBe('function');
  });
});
