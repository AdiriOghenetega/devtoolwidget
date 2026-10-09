import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { SerializedValue } from '../domain/console';
import { serializeValue } from './serialize-value';

function collectTypes(value: SerializedValue, acc: string[] = []): string[] {
  acc.push(value.type);
  if (value.type === 'array') {
    for (const item of value.items) collectTypes(item, acc);
  }
  if (value.type === 'object') {
    for (const entry of value.entries) collectTypes(entry.value, acc);
  }
  if (value.type === 'map') {
    for (const entry of value.entries) {
      collectTypes(entry.key, acc);
      collectTypes(entry.value, acc);
    }
  }
  if (value.type === 'set') {
    for (const item of value.items) collectTypes(item, acc);
  }
  return acc;
}

describe('serializeValue primitives', () => {
  it('serializes primitives and null', () => {
    expect(serializeValue('hi')).toEqual({ type: 'string', value: 'hi' });
    expect(serializeValue(42)).toEqual({ type: 'number', value: 42 });
    expect(serializeValue(true)).toEqual({ type: 'boolean', value: true });
    expect(serializeValue(null)).toEqual({ type: 'null' });
    expect(serializeValue(undefined)).toEqual({ type: 'undefined' });
    expect(serializeValue(10n)).toEqual({ type: 'bigint', value: '10' });
    expect(serializeValue(Symbol('s'))).toEqual({ type: 'symbol', value: 'Symbol(s)' });
  });

  it('marks non-finite numbers as unserializable', () => {
    expect(serializeValue(Number.NaN)).toMatchObject({ type: 'unserializable' });
    expect(serializeValue(Number.POSITIVE_INFINITY)).toMatchObject({ type: 'unserializable' });
  });

  it('names functions, including anonymous ones', () => {
    expect(
      serializeValue(function named(): number {
        return 1;
      }),
    ).toEqual({ type: 'function', name: 'named' });
    expect(serializeValue(() => 1)).toEqual({ type: 'function', name: '(anonymous)' });
  });
});

describe('serializeValue collections', () => {
  it('serializes arrays and objects, flagging truncation', () => {
    expect(serializeValue([1, 'two'])).toEqual({
      type: 'array',
      items: [
        { type: 'number', value: 1 },
        { type: 'string', value: 'two' },
      ],
      truncated: false,
    });
    expect(serializeValue({ a: 1 })).toEqual({
      type: 'object',
      entries: [{ key: 'a', value: { type: 'number', value: 1 } }],
      truncated: false,
    });
  });

  it('serializes Map and Set', () => {
    expect(serializeValue(new Map([['a', 1]]))).toEqual({
      type: 'map',
      entries: [{ key: { type: 'string', value: 'a' }, value: { type: 'number', value: 1 } }],
      truncated: false,
    });
    expect(serializeValue(new Set([1, 2]))).toEqual({
      type: 'set',
      items: [
        { type: 'number', value: 1 },
        { type: 'number', value: 2 },
      ],
      truncated: false,
    });
  });

  it('previews typed arrays without assuming a specific element type', () => {
    expect(serializeValue(new Uint8Array([1, 2, 3]))).toEqual({
      type: 'typed-array',
      kind: 'Uint8Array',
      length: 3,
      preview: ['1', '2', '3'],
      truncated: false,
    });
  });

  it('truncates large Map and Set values', () => {
    const map = new Map(Array.from({ length: 10 }, (_, index) => [index, index] as const));
    const set = new Set(Array.from({ length: 10 }, (_, index) => index));
    expect(serializeValue(map, { limits: { maxEntries: 3 } })).toMatchObject({
      type: 'map',
      truncated: true,
    });
    expect(serializeValue(set, { limits: { maxEntries: 3 } })).toMatchObject({
      type: 'set',
      truncated: true,
    });
  });

  it('serializes Date and RegExp', () => {
    expect(serializeValue(new Date('2020-01-01T00:00:00.000Z'))).toEqual({
      type: 'date',
      iso: '2020-01-01T00:00:00.000Z',
    });
    expect(serializeValue(/ab+/gi)).toEqual({ type: 'regexp', source: 'ab+', flags: 'gi' });
  });

  it('marks an invalid Date as unserializable', () => {
    expect(serializeValue(new Date('not a date'))).toMatchObject({ type: 'unserializable' });
  });
});

describe('serializeValue special values', () => {
  it('serializes Error objects', () => {
    expect(serializeValue(new Error('boom'))).toMatchObject({
      type: 'error',
      name: 'Error',
      message: 'boom',
    });
  });

  it('marks circular references', () => {
    interface Node {
      self?: Node;
    }
    const node: Node = {};
    node.self = node;

    const result = serializeValue(node);
    expect(result.type).toBe('object');
    if (result.type === 'object') {
      expect(result.entries[0]?.value).toMatchObject({ type: 'circular' });
    }
  });

  it('uses injected DOM-node helpers instead of touching a DOM', () => {
    const fakeNode = { nodeName: 'DIV' };
    const result = serializeValue(fakeNode, {
      helpers: {
        isDomNode: (value) => value === fakeNode,
        getDomNodeName: () => 'DIV',
      },
    });
    expect(result).toEqual({ type: 'node', nodeName: 'DIV' });
  });

  it('falls back to the default node name when only the predicate is injected', () => {
    expect(serializeValue({}, { helpers: { isDomNode: () => true } })).toEqual({
      type: 'node',
      nodeName: 'Node',
    });
  });

  it('returns a marker when reflection itself throws', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('nope');
        },
      },
    );
    expect(serializeValue(hostile)).toEqual({
      type: 'unserializable',
      reason: 'serialization failed',
    });
  });

  it('survives a property getter that throws', () => {
    const value: Record<string, unknown> = {};
    Object.defineProperty(value, 'boom', {
      enumerable: true,
      get() {
        throw new Error('nope');
      },
    });

    const result = serializeValue(value);
    expect(result.type).toBe('object');
    if (result.type === 'object') {
      expect(result.entries[0]?.value).toMatchObject({ type: 'unserializable' });
    }
  });
});

describe('serializeValue limits', () => {
  it('truncates long strings with an ellipsis', () => {
    const result = serializeValue('x'.repeat(300), { limits: { maxStringLength: 10 } });
    expect(result).toEqual({ type: 'string', value: `${'x'.repeat(10)}\u2026` });
  });

  it('caps the number of entries per collection', () => {
    const result = serializeValue([1, 2, 3, 4, 5], { limits: { maxEntries: 2 } });
    expect(result).toMatchObject({ type: 'array', truncated: true });
    if (result.type === 'array') {
      expect(result.items).toHaveLength(2);
    }
  });

  it('stops at the depth cap', () => {
    const nested = { a: { b: { c: { d: { e: 1 } } } } };
    const result = serializeValue(nested, { limits: { maxDepth: 2 } });
    expect(collectTypes(result)).toContain('unserializable');
  });

  it('stops at the total-size cap', () => {
    const result = serializeValue([1, 2, 3, 4, 5], { limits: { maxTotalNodes: 3 } });
    expect(collectTypes(result)).toContain('unserializable');
  });
});

describe('serializeValue robustness', () => {
  it('never throws and always returns a tagged value (property)', () => {
    fc.assert(
      fc.property(fc.anything(), (value: unknown) => {
        const result = serializeValue(value);
        expect(typeof result.type).toBe('string');
      }),
    );
  });
});
