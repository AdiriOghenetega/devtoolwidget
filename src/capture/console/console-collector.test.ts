import { describe, expect, it, vi } from 'vitest';
import { toMillis, type ConsoleEntry } from '../../core';
import type { ClockPort } from '../../platform/ports';
import {
  ConsoleCollector,
  hashSerialized,
  type ConsoleCollectorOptions,
} from './console-collector';

interface FakeConsole extends Record<string, unknown> {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

function createFakeConsole(): { readonly console: FakeConsole; readonly calls: unknown[][] } {
  const calls: unknown[][] = [];
  const record = (level: string) => {
    return (...args: unknown[]): void => {
      calls.push([level, ...args]);
    };
  };
  const console = {
    log: record('log'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    debug: record('debug'),
    trace: record('trace'),
  } as FakeConsole;
  return { console, calls };
}

function createFakeTarget(): {
  readonly target: {
    addEventListener: (type: string, listener: (event: unknown) => void, options?: unknown) => void;
    removeEventListener: (
      type: string,
      listener: (event: unknown) => void,
      options?: unknown,
    ) => void;
  };
  readonly dispatch: (type: string, event: unknown) => void;
} {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    target: {
      addEventListener(type, listener) {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener(type, listener) {
        listeners.get(type)?.delete(listener);
      },
    },
    dispatch: (type: string, event: unknown) => {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener(event);
      }
    },
  };
}

function createClock(): ClockPort {
  return { now: () => toMillis(1_000), delay: () => Promise.resolve() };
}

function setup(overrides: Partial<ConsoleCollectorOptions> = {}): {
  readonly collector: ConsoleCollector;
  readonly entries: ConsoleEntry[];
  readonly fakeConsole: FakeConsole;
  readonly calls: unknown[][];
  readonly dispatch: (type: string, event: unknown) => void;
} {
  const { console: fakeConsole, calls } = createFakeConsole();
  const fakeTarget = createFakeTarget();
  const target = fakeTarget.target;
  const dispatch = fakeTarget.dispatch;
  const entries: ConsoleEntry[] = [];
  let counter = 0;
  const collector = new ConsoleCollector({
    console: fakeConsole,
    target,
    clock: createClock(),
    emit: (entry) => entries.push(entry),
    createId: () => {
      counter += 1;
      return `id-${String(counter)}`;
    },
    ...overrides,
  });
  return { collector, entries, fakeConsole, calls, dispatch };
}

describe('ConsoleCollector console patching', () => {
  it('calls the originals and emits serialized entries', () => {
    const { collector, entries, calls, fakeConsole } = setup();

    fakeConsole.log('hi', 42);

    expect(calls).toEqual([['log', 'hi', 42]]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'console', level: 'log', count: 1 });
    expect(entries[0]?.args).toEqual([
      { type: 'string', value: 'hi' },
      { type: 'number', value: 42 },
    ]);
    collector.dispose();
  });

  it('collapses consecutive duplicates by hash and increments count', () => {
    const { collector, entries, fakeConsole } = setup();

    fakeConsole.log('same');
    fakeConsole.log('same');
    fakeConsole.log('same');
    fakeConsole.log('different');

    expect(entries.map((entry) => entry.count)).toEqual([1, 2, 3, 1]);
    expect(entries[0]?.id).toBe(entries[2]?.id);
    expect(entries[3]?.id).not.toBe(entries[0]?.id);
    collector.dispose();
  });

  it('preserves property descriptors and function names, and restores on dispose', () => {
    const { console: fakeConsole } = createFakeConsole();
    const { target } = createFakeTarget();
    const originalInfo = Object.getOwnPropertyDescriptor(fakeConsole, 'info')?.value as unknown;
    Object.defineProperty(fakeConsole, 'info', {
      value: originalInfo,
      writable: false,
      enumerable: false,
      configurable: true,
    });

    const collector = new ConsoleCollector({
      console: fakeConsole,
      target,
      clock: createClock(),
      emit: () => undefined,
      methods: ['info'],
    });

    const patchedDescriptor = Object.getOwnPropertyDescriptor(fakeConsole, 'info');
    expect(patchedDescriptor?.writable).toBe(false);
    expect(patchedDescriptor?.enumerable).toBe(false);
    expect(patchedDescriptor?.value).not.toBe(originalInfo);
    expect((patchedDescriptor?.value as { name?: string }).name).toBe('info');

    collector.dispose();
    const restored = Object.getOwnPropertyDescriptor(fakeConsole, 'info');
    expect(restored?.value).toBe(originalInfo);
    expect(restored?.writable).toBe(false);
    expect(restored?.enumerable).toBe(false);
  });

  it('includes the patched-method count and a stable hash', () => {
    const { collector } = setup();
    expect(collector.patchedCount).toBe(6);
    expect(hashSerialized('log', [{ type: 'string', value: 'a' }])).toBe(
      hashSerialized('log', [{ type: 'string', value: 'a' }]),
    );
    expect(hashSerialized('log', [{ type: 'string', value: 'a' }])).not.toBe(
      hashSerialized('warn', [{ type: 'string', value: 'a' }]),
    );
    collector.dispose();
  });
});

describe('ConsoleCollector page events', () => {
  it('captures uncaught errors with a stack location', () => {
    const { collector, entries, dispatch } = setup();
    dispatch('error', { message: 'boom', filename: 'app.js', lineno: 3 });
    expect(entries[0]).toMatchObject({ kind: 'uncaught', level: 'error' });
    expect(entries[0]?.stack).toContain('app.js:3');
    collector.dispose();
  });

  it('captures failed resource loads', () => {
    const { collector, entries, dispatch } = setup();
    dispatch('error', { target: { tagName: 'IMG', src: 'https://x/a.png' } });
    expect(entries[0]).toMatchObject({ kind: 'resource', level: 'error' });
    expect(JSON.stringify(entries[0]?.args)).toContain('a.png');
    collector.dispose();
  });

  it('captures unhandled rejections and CSP violations', () => {
    const { collector, entries, dispatch } = setup();
    dispatch('unhandledrejection', { reason: 'nope' });
    dispatch('securitypolicyviolation', {
      blockedURI: 'https://x',
      violatedDirective: 'script-src',
    });
    expect(entries[0]?.kind).toBe('rejection');
    expect(entries[1]?.kind).toBe('csp');
    collector.dispose();
  });

  it('stops capturing after dispose', () => {
    const { collector, entries, dispatch, fakeConsole } = setup();
    collector.dispose();
    dispatch('unhandledrejection', { reason: 'nope' });
    fakeConsole.log('after');
    expect(entries).toHaveLength(0);
  });
});

describe('ConsoleCollector resilience', () => {
  it('never throws on hostile arguments and still calls the original', () => {
    const { collector, entries, calls, fakeConsole } = setup();
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, 'boom', {
      enumerable: true,
      get() {
        throw new Error('getter');
      },
    });
    const huge: Record<string, number> = {};
    for (let index = 0; index < 1_000; index += 1) {
      huge[`k${String(index)}`] = index;
    }
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => {
      fakeConsole.log(hostile, huge, circular);
    }).not.toThrow();

    expect(calls).toHaveLength(1);
    expect(entries).toHaveLength(1);
    collector.dispose();
  });

  it('isolates its own errors so a throwing emitter cannot reach page code', () => {
    const { console: fakeConsole, calls } = createFakeConsole();
    const { target } = createFakeTarget();
    const collector = new ConsoleCollector({
      console: fakeConsole,
      target,
      clock: createClock(),
      emit: () => {
        throw new Error('emit failed');
      },
    });

    expect(() => {
      fakeConsole.log('x');
    }).not.toThrow();
    expect(calls).toHaveLength(1);
    collector.dispose();
  });

  it('guards against re-entrancy when the emitter logs again', () => {
    const { console: fakeConsole, calls } = createFakeConsole();
    const { target } = createFakeTarget();
    const entries: ConsoleEntry[] = [];
    const collector = new ConsoleCollector({
      console: fakeConsole,
      target,
      clock: createClock(),
      emit: (entry) => {
        entries.push(entry);
        fakeConsole.log('reentrant');
      },
    });

    fakeConsole.log('first');

    expect(entries).toHaveLength(1);
    expect(calls.length).toBe(2);
    collector.dispose();
  });

  it('isolates a serializer that throws', () => {
    const { collector, entries, calls, fakeConsole } = setup({
      serialize: vi.fn(() => {
        throw new Error('serialize failed');
      }),
    });

    expect(() => {
      fakeConsole.log('x');
    }).not.toThrow();
    expect(calls).toHaveLength(1);
    expect(entries).toHaveLength(0);
    collector.dispose();
  });
});
