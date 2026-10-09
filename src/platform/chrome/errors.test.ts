import { describe, expect, it } from 'vitest';
import { platformError } from '../ports/errors';
import { toPlatformError } from './errors';

describe('toPlatformError', () => {
  it('passes an existing platform error through unchanged', () => {
    const original = platformError('not-found', 'gone');
    expect(toPlatformError(original)).toBe(original);
  });

  it('maps known browser error messages to codes', () => {
    expect(toPlatformError(new Error('QUOTA_BYTES quota exceeded')).code).toBe('quota-exceeded');
    expect(toPlatformError(new Error('No tab with id 7')).code).toBe('not-found');
    expect(toPlatformError(new Error('Permission denied')).code).toBe('permission-denied');
    expect(toPlatformError(new Error('Runtime.evaluate is not implemented')).code).toBe(
      'unsupported',
    );
  });

  it('falls back to unknown for unrecognised inputs', () => {
    expect(toPlatformError(new Error('boom')).code).toBe('unknown');
    expect(toPlatformError({ message: 'object with message' }).code).toBe('unknown');
    expect(toPlatformError(42).code).toBe('unknown');
  });

  it('reads a thrown string', () => {
    expect(toPlatformError('Permission required').code).toBe('permission-denied');
  });
});
