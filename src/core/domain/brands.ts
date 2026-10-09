/**
 * Branded primitive types for the core domain.
 *
 * A brand is erased at runtime; it exists only so a bare `number` cannot be
 * used where a unit-bearing value (milliseconds, bytes, a tab id) is expected.
 * This keeps `transferSize: Bytes` distinct from `timestamp: Millis` even
 * though both are numbers.
 */
declare const brand: unique symbol;

/** A number tagged with the literal unit `B`. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A duration or point in time, in milliseconds. */
export type Millis = Brand<number, 'Millis'>;

/** A browser tab id. */
export type TabId = Brand<number, 'TabId'>;

/** A size or count of bytes. */
export type Bytes = Brand<number, 'Bytes'>;

/**
 * Attaches a brand to a runtime number. This is the single sanctioned type
 * assertion in the codebase (AGENTS.md section 3): brands do not exist at
 * runtime, so no cast-free constructor is possible. It is confined to this
 * module and never validates its input.
 */
function attachBrand<B extends string>(value: number): Brand<number, B> {
  return value as Brand<number, B>;
}

/** Interprets a plain number as {@link Millis}. */
export function toMillis(value: number): Millis {
  return attachBrand<'Millis'>(value);
}

/** Interprets a plain number as a {@link TabId}. */
export function toTabId(value: number): TabId {
  return attachBrand<'TabId'>(value);
}

/** Interprets a plain number as {@link Bytes}. */
export function toBytes(value: number): Bytes {
  return attachBrand<'Bytes'>(value);
}
