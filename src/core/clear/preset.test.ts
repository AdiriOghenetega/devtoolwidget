import { describe, expect, it } from 'vitest';
import { presetToClearRequest } from './preset';

describe('presetToClearRequest', () => {
  it('clears the current origin for the fresh-visitor preset', () => {
    const request = presetToClearRequest('fresh-visitor', 'https://a.test');
    expect(request.scope).toBe('origin');
    expect(request.origin).toBe('https://a.test');
    expect(request.types).toContain('cookies');
    expect(request.types).not.toContain('httpCache');
  });

  it('falls back to everything when no origin is known', () => {
    const request = presetToClearRequest('fresh-visitor');
    expect(request.scope).toBe('all');
    expect(request.origin).toBeUndefined();
  });

  it('clears all origins including the HTTP cache for clear-everything-and-reload', () => {
    const request = presetToClearRequest('clear-everything-and-reload', 'https://a.test');
    expect(request.scope).toBe('all');
    expect(request.types).toContain('httpCache');
  });
});
