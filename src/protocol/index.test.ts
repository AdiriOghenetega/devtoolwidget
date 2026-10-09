import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, parseMessage } from './index';

describe('protocol public API barrel', () => {
  it('re-exports the version and parse helpers', () => {
    expect(PROTOCOL_VERSION).toBe(1);

    const result = parseMessage({
      type: 'event.storage',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: { areas: [] },
    });
    expect(result.ok).toBe(true);
  });
});
