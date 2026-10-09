/**
 * A discriminated union for expected failures (PRD section 8.5, AGENTS.md
 * section 6). Success is `{ ok: true, value }`; failure is
 * `{ ok: false, error }`. Nothing here throws: exceptions are reserved for
 * programmer errors, so fallible operations return a `Result` instead.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Wraps a success value. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Wraps a failure value. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Transforms the success value, leaving a failure untouched. */
export function map<T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> {
  return result.ok ? ok(transform(result.value)) : result;
}

/** Transforms the failure value, leaving a success untouched. */
export function mapErr<T, E, F>(result: Result<T, E>, transform: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(transform(result.error));
}

/** Chains another fallible step onto a success, leaving a failure untouched. */
export function andThen<T, U, E>(
  result: Result<T, E>,
  transform: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? transform(result.value) : result;
}

/** Returns the success value, or `fallback` when the result is a failure. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

/** Awaits a promise, converting a rejection into `err(error)`. */
export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, unknown>> {
  try {
    return ok(await promise);
  } catch (error: unknown) {
    return err(error);
  }
}
