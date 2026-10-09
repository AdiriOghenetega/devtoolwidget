import { describe, expect, it } from 'vitest';
import { andThen, err, fromPromise, map, mapErr, ok, unwrapOr } from './result';

describe('Result', () => {
  it('wraps a success value with ok', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it('wraps a failure value with err', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it('maps a success value', () => {
    expect(map(ok(2), (n) => n * 2)).toEqual({ ok: true, value: 4 });
  });

  it('leaves a failure untouched when mapping the value', () => {
    expect(map(err('boom'), (n: number) => n * 2)).toEqual({ ok: false, error: 'boom' });
  });

  it('maps a failure value', () => {
    expect(mapErr(err('boom'), (error) => error.length)).toEqual({ ok: false, error: 4 });
  });

  it('leaves a success untouched when mapping the error', () => {
    expect(mapErr(ok(1), (error: string) => error.length)).toEqual({ ok: true, value: 1 });
  });

  it('chains successes with andThen', () => {
    expect(andThen(ok(2), (n) => ok(n + 1))).toEqual({ ok: true, value: 3 });
  });

  it('short-circuits andThen on a failure', () => {
    expect(andThen(err('boom'), (n: number) => ok(n + 1))).toEqual({ ok: false, error: 'boom' });
  });

  it('returns the value from unwrapOr for a success', () => {
    expect(unwrapOr(ok(1), 0)).toBe(1);
  });

  it('returns the fallback from unwrapOr for a failure', () => {
    expect(unwrapOr(err('boom'), 0)).toBe(0);
  });

  it('resolves fromPromise to ok', async () => {
    await expect(fromPromise(Promise.resolve(7))).resolves.toEqual({ ok: true, value: 7 });
  });

  it('converts a rejection from fromPromise into err', async () => {
    const result = await fromPromise(Promise.reject(new Error('nope')));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
