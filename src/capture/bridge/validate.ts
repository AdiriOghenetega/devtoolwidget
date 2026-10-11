import { BRIDGE_CHANNEL, MAX_BRIDGE_NONCE_LENGTH, err, ok, type Result } from '../../core';
import { platformError, type PlatformError } from '../../platform/ports/errors';

/**
 * A small table-driven validator shared by the four Zod-free bridge messages
 * (three bootstrap + `agent.config`, ADR 0018). Each message declares its name
 * and a table of field validators; {@link parseWith} owns the common envelope,
 * record and unknown-key rules, so the messages differ only by their table. The
 * hand-written guards are typed against the `z.infer` types of the source-of-
 * truth schemas in `protocol/bridge.ts`, and the equivalence test asserts they
 * always agree.
 */

/** A field validator: true when the (already fetched) value is acceptable. */
export type FieldValidator = (value: unknown) => boolean;

/** Declarative spec for one bridge message. */
export interface MessageSpec<T> {
  readonly message: string;
  /** Human label used in errors (e.g. "handshake"). */
  readonly label: string;
  readonly fields: Readonly<Record<string, FieldValidator>>;
  /**
   * Builds the typed message from the validated data. The fields were checked by
   * `fields` above, so the field reads here are safe; the casts reflect that.
   */
  readonly build: (data: Readonly<Record<string, unknown>>) => T;
}

/** True when `value` is a non-array object with no unknown own enumerable keys. */
export function isRecordWithKeys(
  value: unknown,
  allowed: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return false;
    }
  }
  return true;
}

/** Validates `data` against `spec`. Never throws. */
export function parseWith<T>(spec: MessageSpec<T>, data: unknown): Result<T, PlatformError> {
  const allowed = ['channel', 'message', ...Object.keys(spec.fields)];
  if (!isRecordWithKeys(data, allowed)) {
    return err(platformError('invalid-data', `Not a bridge ${spec.label}`));
  }
  if (data.channel !== BRIDGE_CHANNEL || data.message !== spec.message) {
    return err(platformError('invalid-data', `Not a bridge ${spec.label}`));
  }
  for (const [name, valid] of Object.entries(spec.fields)) {
    if (!valid(data[name])) {
      return err(platformError('invalid-data', `Invalid bridge ${spec.label}`));
    }
  }
  return ok(spec.build(data));
}

// --- Shared field validators ------------------------------------------------

/** A nonce: a non-empty string within the defensive length cap. */
export const nonceField: FieldValidator = (value) =>
  typeof value === 'string' && value.length >= 1 && value.length <= MAX_BRIDGE_NONCE_LENGTH;

/** Reads an already-validated string field without an assertion. */
export function stringValue(data: Readonly<Record<string, unknown>>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

/** A string within an inclusive length range. */
export function stringField(
  minLength: number,
  maxLength: number,
): (value: unknown) => value is string {
  return (value): value is string =>
    typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

/** A boolean. */
export function booleanField(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** A string equal to one of `allowed`. */
export function oneOf(allowed: readonly string[]): (value: unknown) => value is string {
  return (value): value is string => typeof value === 'string' && allowed.includes(value);
}

/** An integer within an inclusive range. */
export function integerInRange(min: number, max: number): (value: unknown) => value is number {
  return (value): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
