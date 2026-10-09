import { describe, expectTypeOf, it } from 'vitest';
import { andThen, err, fromPromise, map, mapErr, ok, unwrapOr, type Result } from './result';

describe('Result type-level API', () => {
  it('discriminates on the ok flag', () => {
    const result: Result<number, string> = ok(1);
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<number>();
    } else {
      expectTypeOf(result.error).toEqualTypeOf<string>();
    }
  });

  it('infers ok and err type parameters', () => {
    expectTypeOf(ok(1)).toEqualTypeOf<Result<number, never>>();
    expectTypeOf(err('x')).toEqualTypeOf<Result<never, string>>();
  });

  it('changes the value type and preserves the error type in map', () => {
    expectTypeOf(map<number, string, Error>(ok(1), (n) => String(n))).toEqualTypeOf<
      Result<string, Error>
    >();
  });

  it('changes the error type and preserves the value type in mapErr', () => {
    expectTypeOf(
      mapErr<number, Error, string>(err(new Error()), (error) => error.message),
    ).toEqualTypeOf<Result<number, string>>();
  });

  it('flattens nested results in andThen', () => {
    expectTypeOf(andThen<number, string, Error>(ok(1), (n) => ok(String(n)))).toEqualTypeOf<
      Result<string, Error>
    >();
  });

  it('returns the value type from unwrapOr', () => {
    expectTypeOf(unwrapOr(ok(1), 0)).toEqualTypeOf<number>();
  });

  it('resolves fromPromise to a Result', () => {
    expectTypeOf(fromPromise(Promise.resolve(1))).toEqualTypeOf<Promise<Result<number, unknown>>>();
  });
});
