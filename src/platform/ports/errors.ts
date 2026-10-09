/** Why a platform operation failed (PRD 8.2). */
export type PlatformErrorCode =
  | 'unavailable'
  | 'unsupported'
  | 'permission-denied'
  | 'not-found'
  | 'invalid-data'
  | 'invalid-argument'
  | 'quota-exceeded'
  | 'version-mismatch'
  | 'timeout'
  | 'unknown';

/** A structured, non-throwing platform error. */
export interface PlatformError {
  readonly code: PlatformErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

/**
 * An {@link PlatformError} that is also an `Error`, so adapters can `throw` it
 * internally (lint requires throwing errors) and still match `Result` errors by
 * shape. Callers should treat it as data, not throw it across a port boundary.
 */
class PlatformErrorInstance extends Error implements PlatformError {
  readonly code: PlatformErrorCode;

  constructor(code: PlatformErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/** Builds a {@link PlatformError}, omitting `cause` when it is undefined. */
export function platformError(
  code: PlatformErrorCode,
  message: string,
  cause?: unknown,
): PlatformErrorInstance {
  return new PlatformErrorInstance(code, message, cause);
}

/** True when a value looks like a {@link PlatformError}. */
export function isPlatformError(value: unknown): value is PlatformError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { code?: unknown; message?: unknown };
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}
