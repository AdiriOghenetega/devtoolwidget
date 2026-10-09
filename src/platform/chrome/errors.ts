import { isPlatformError, platformError, type PlatformError } from '../ports/errors';

const QUOTA_PATTERN = /quota|exceeded|too much data/i;
const NOT_FOUND_PATTERN = /no tab with id|no tab|could not find|cannot find|not found/i;
const PERMISSION_PATTERN = /permission|not allowed|denied|cannot access/i;
const UNSUPPORTED_PATTERN = /not implemented|unsupported|is not a function|is not defined/i;

function messageOf(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(error);
}

/**
 * Converts a thrown browser error into a structured {@link PlatformError},
 * mapping common messages to codes so callers can branch on them.
 */
export function toPlatformError(error: unknown): PlatformError {
  if (isPlatformError(error)) {
    return error;
  }
  const message = messageOf(error);
  if (QUOTA_PATTERN.test(message)) {
    return platformError('quota-exceeded', message, error);
  }
  if (NOT_FOUND_PATTERN.test(message)) {
    return platformError('not-found', message, error);
  }
  if (PERMISSION_PATTERN.test(message)) {
    return platformError('permission-denied', message, error);
  }
  if (UNSUPPORTED_PATTERN.test(message)) {
    return platformError('unsupported', message, error);
  }
  return platformError('unknown', message, error);
}
