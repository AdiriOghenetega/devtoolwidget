import { describe, expect, it } from 'vitest';
import { isPlatformError, platformError } from './errors';

describe('platformError', () => {
  it('builds an error without a cause when none is given', () => {
    const error = platformError('unknown', 'something broke');
    expect(error.code).toBe('unknown');
    expect(error.message).toBe('something broke');
    expect(error.cause).toBeUndefined();
  });

  it('keeps a provided cause', () => {
    const cause = new Error('root');
    expect(platformError('unknown', 'something broke', cause).cause).toBe(cause);
  });
});

describe('isPlatformError', () => {
  it('accepts platform errors and platform-error-shaped objects', () => {
    expect(isPlatformError(platformError('not-found', 'gone'))).toBe(true);
    expect(isPlatformError({ code: 'not-found', message: 'gone' })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isPlatformError({ code: 'not-found' })).toBe(false);
    expect(isPlatformError(null)).toBe(false);
    expect(isPlatformError('nope')).toBe(false);
    expect(isPlatformError(42)).toBe(false);
  });
});
