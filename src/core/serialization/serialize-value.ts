import { DEFAULT_SERIALIZER_LIMITS, type SerializerLimits } from '../domain/constants';
import type { SerializedMapEntry, SerializedObjectEntry, SerializedValue } from '../domain/console';

/**
 * The type checks the serializer cannot do itself. They are injected so this
 * module stays free of DOM (or any host) globals and can run under Node, a
 * worker or a test fake.
 */
export interface SerializerHelpers {
  readonly isDomNode: (value: unknown) => boolean;
  readonly getDomNodeName: (value: unknown) => string;
}

/** Helpers used when none are supplied: no value is treated as a DOM node. */
export const DEFAULT_SERIALIZER_HELPERS: SerializerHelpers = {
  isDomNode: () => false,
  getDomNodeName: () => 'Node',
};

/** Options for {@link serializeValue}. */
export interface SerializeOptions {
  readonly limits?: Partial<SerializerLimits>;
  readonly helpers?: Partial<SerializerHelpers>;
}

interface SerializeState {
  readonly references: WeakMap<object, number>;
  nextReference: number;
  count: number;
}

const ELLIPSIS = '\u2026';

function cap(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}${ELLIPSIS}`;
}

function serializeArray(
  items: readonly unknown[],
  depth: number,
  limits: SerializerLimits,
  helpers: SerializerHelpers,
  state: SerializeState,
): SerializedValue {
  const limit = Math.min(items.length, limits.maxEntries);
  const serialized: SerializedValue[] = [];
  for (let index = 0; index < limit; index += 1) {
    serialized.push(serialize(items[index], depth + 1, limits, helpers, state));
  }
  return { type: 'array', items: serialized, truncated: items.length > limit };
}

function readProperty(
  record: Record<string, unknown>,
  key: string,
  depth: number,
  limits: SerializerLimits,
  helpers: SerializerHelpers,
  state: SerializeState,
): SerializedValue {
  try {
    return serialize(record[key], depth + 1, limits, helpers, state);
  } catch {
    return { type: 'unserializable', reason: 'threw while reading property' };
  }
}

function serializeContainer(
  value: object,
  depth: number,
  limits: SerializerLimits,
  helpers: SerializerHelpers,
  state: SerializeState,
): SerializedValue {
  if (depth >= limits.maxDepth) {
    return { type: 'unserializable', reason: 'max depth reached' };
  }
  const existing = state.references.get(value);
  if (existing !== undefined) {
    return { type: 'circular', reference: `#${String(existing)}` };
  }
  state.nextReference += 1;
  state.references.set(value, state.nextReference);

  if (helpers.isDomNode(value)) {
    return { type: 'node', nodeName: helpers.getDomNodeName(value) };
  }
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    return serializeArray(items, depth, limits, helpers, state);
  }
  if (value instanceof Error) {
    const serialized: {
      type: 'error';
      name: string;
      message: string;
      stack?: string;
    } = {
      type: 'error',
      name: value.name,
      message: cap(value.message, limits.maxStringLength),
    };
    if (value.stack !== undefined) {
      serialized.stack = cap(value.stack, limits.maxStringLength);
    }
    return serialized;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { type: 'unserializable', reason: 'invalid date' }
      : { type: 'date', iso: value.toISOString() };
  }
  if (value instanceof RegExp) {
    return { type: 'regexp', source: value.source, flags: value.flags };
  }
  if (value instanceof Map) {
    const map: Map<unknown, unknown> = value;
    const entries: SerializedMapEntry[] = [];
    let truncated = false;
    for (const [key, entryValue] of map) {
      if (entries.length >= limits.maxEntries) {
        truncated = true;
        break;
      }
      entries.push({
        key: serialize(key, depth + 1, limits, helpers, state),
        value: serialize(entryValue, depth + 1, limits, helpers, state),
      });
    }
    return { type: 'map', entries, truncated };
  }
  if (value instanceof Set) {
    const set: Set<unknown> = value;
    const items: SerializedValue[] = [];
    let truncated = false;
    for (const item of set) {
      if (items.length >= limits.maxEntries) {
        truncated = true;
        break;
      }
      items.push(serialize(item, depth + 1, limits, helpers, state));
    }
    return { type: 'set', items, truncated };
  }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const preview = Array.from(
      bytes.subarray(0, Math.min(bytes.length, limits.maxEntries)),
      (byte) => String(byte),
    );
    return {
      type: 'typed-array',
      kind: value.constructor.name,
      length: bytes.length,
      preview,
      truncated: bytes.length > preview.length,
    };
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const limit = Math.min(keys.length, limits.maxEntries);
  const entries: SerializedObjectEntry[] = [];
  for (let index = 0; index < limit; index += 1) {
    const key = keys[index];
    if (key === undefined) {
      continue;
    }
    entries.push({ key, value: readProperty(record, key, depth, limits, helpers, state) });
  }
  return { type: 'object', entries, truncated: keys.length > limit };
}

function serialize(
  value: unknown,
  depth: number,
  limits: SerializerLimits,
  helpers: SerializerHelpers,
  state: SerializeState,
): SerializedValue {
  state.count += 1;
  if (state.count > limits.maxTotalNodes) {
    return { type: 'unserializable', reason: 'size cap reached' };
  }
  if (typeof value === 'object') {
    return value === null
      ? { type: 'null' }
      : serializeContainer(value, depth, limits, helpers, state);
  }
  switch (typeof value) {
    case 'undefined':
      return { type: 'undefined' };
    case 'string':
      return { type: 'string', value: cap(value, limits.maxStringLength) };
    case 'number':
      return Number.isFinite(value)
        ? { type: 'number', value }
        : { type: 'unserializable', reason: 'non-finite number' };
    case 'boolean':
      return { type: 'boolean', value };
    case 'bigint':
      return { type: 'bigint', value: value.toString() };
    case 'symbol':
      return { type: 'symbol', value: value.toString() };
    case 'function':
      return { type: 'function', name: value.name === '' ? '(anonymous)' : value.name };
    default:
      return { type: 'unserializable', reason: 'unreachable' };
  }
}

/**
 * Turns an arbitrary value into a structural {@link SerializedValue} without
 * throwing, honouring depth and size caps and injected DOM-node helpers
 * (PRD FR-3). Circular references become `circular` markers.
 */
export function serializeValue(value: unknown, options: SerializeOptions = {}): SerializedValue {
  const limits: SerializerLimits = {
    maxDepth: options.limits?.maxDepth ?? DEFAULT_SERIALIZER_LIMITS.maxDepth,
    maxEntries: options.limits?.maxEntries ?? DEFAULT_SERIALIZER_LIMITS.maxEntries,
    maxStringLength: options.limits?.maxStringLength ?? DEFAULT_SERIALIZER_LIMITS.maxStringLength,
    maxTotalNodes: options.limits?.maxTotalNodes ?? DEFAULT_SERIALIZER_LIMITS.maxTotalNodes,
  };
  const helpers: SerializerHelpers = {
    isDomNode: options.helpers?.isDomNode ?? DEFAULT_SERIALIZER_HELPERS.isDomNode,
    getDomNodeName: options.helpers?.getDomNodeName ?? DEFAULT_SERIALIZER_HELPERS.getDomNodeName,
  };
  const state: SerializeState = {
    references: new WeakMap<object, number>(),
    nextReference: 0,
    count: 0,
  };
  try {
    return serialize(value, 0, limits, helpers, state);
  } catch {
    return { type: 'unserializable', reason: 'serialization failed' };
  }
}
