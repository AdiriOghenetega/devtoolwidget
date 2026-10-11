import { describe, expect, it } from 'vitest';
import { hostOriginFromPattern, toHostOrigin, toHostPattern } from './origin';

describe('toHostOrigin', () => {
  it('drops the port and the path', () => {
    expect(toHostOrigin('http://127.0.0.1:4178')).toBe('http://127.0.0.1');
    expect(toHostOrigin('https://example.com/a/b?c=d')).toBe('https://example.com');
    expect(toHostOrigin('http://localhost:3000')).toBe('http://localhost');
  });

  it('is idempotent for an already-normalised origin', () => {
    expect(toHostOrigin('https://example.com')).toBe('https://example.com');
  });

  it('returns unparseable input unchanged', () => {
    expect(toHostOrigin('not a url')).toBe('not a url');
  });
});

describe('toHostPattern', () => {
  it('produces the any-port match pattern for the host', () => {
    expect(toHostPattern('http://127.0.0.1:4178')).toBe('http://127.0.0.1/*');
    expect(toHostPattern('http://localhost:3000')).toBe('http://localhost/*');
  });
});

describe('hostOriginFromPattern', () => {
  it('recovers a host origin from a concrete pattern, ignoring the port and path', () => {
    expect(hostOriginFromPattern('http://127.0.0.1/*')).toBe('http://127.0.0.1');
    expect(hostOriginFromPattern('https://example.com/*')).toBe('https://example.com');
    expect(hostOriginFromPattern('http://localhost:4178/*')).toBe('http://localhost');
  });

  it('returns undefined for wildcard patterns', () => {
    expect(hostOriginFromPattern('<all_urls>')).toBeUndefined();
    expect(hostOriginFromPattern('http://*/*')).toBeUndefined();
    expect(hostOriginFromPattern('https://*.example.com/*')).toBeUndefined();
  });
});
