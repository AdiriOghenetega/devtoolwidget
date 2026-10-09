import {
  createIdFactory,
  serializeValue,
  type ConsoleEntry,
  type ConsoleLevel,
  type SerializedValue,
} from '../../core';
import type { ClockPort } from '../../platform/ports';

/** Console levels the collector patches by default. */
export const DEFAULT_CONSOLE_METHODS = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
] as const satisfies readonly ConsoleLevel[];

/** A console method name the collector can patch. */
export type ConsoleMethod = ConsoleLevel;

/** A window-like event target: only the surface the collector uses. */
export interface EventTargetLike {
  addEventListener(
    type: string,
    listener: (event: unknown) => void,
    options?: boolean | { readonly capture?: boolean },
  ): void;
  removeEventListener(
    type: string,
    listener: (event: unknown) => void,
    options?: boolean | { readonly capture?: boolean },
  ): void;
}

/** Options for {@link ConsoleCollector}. */
export interface ConsoleCollectorOptions {
  /** The console object to patch (injected so tests can pass a fake). */
  readonly console: object;
  /** The window-like target for error/rejection/CSP events. */
  readonly target: EventTargetLike;
  /** Injected clock. */
  readonly clock: ClockPort;
  /** Emits a captured entry. Must be side-effect-safe. */
  readonly emit: (entry: ConsoleEntry) => void;
  /** Console methods to patch; defaults to {@link DEFAULT_CONSOLE_METHODS}. */
  readonly methods?: readonly ConsoleMethod[];
  /** Injected id factory; defaults to a clock/randomness based one. */
  readonly createId?: () => string;
  /** Injected serializer; defaults to the core serializer. */
  readonly serialize?: (value: unknown) => SerializedValue;
}

interface Installed {
  readonly method: string;
  readonly descriptor: PropertyDescriptor | undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/** FNV-1a hash of the level and serialized arguments. */
export function hashSerialized(level: string, args: readonly SerializedValue[]): string {
  const json = JSON.stringify(args);
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${level}:${(hash >>> 0).toString(16)}`;
}

/**
 * Captures console output and page error events (PRD FR-3). It patches the
 * injected console methods while calling the originals, preserves property
 * descriptors and function names, serializes arguments with the core serializer,
 * collapses consecutive duplicates by hash, and isolates its own errors so it
 * can never throw into page code. `dispose()` restores every original.
 */
export class ConsoleCollector {
  readonly #console: Record<string, unknown>;
  readonly #target: EventTargetLike;
  readonly #clock: ClockPort;
  readonly #emit: (entry: ConsoleEntry) => void;
  readonly #createId: () => string;
  readonly #serialize: (value: unknown) => SerializedValue;
  readonly #methods: readonly ConsoleMethod[];
  readonly #installed: Installed[] = [];
  readonly #listeners: { readonly type: string; readonly listener: (event: unknown) => void }[] =
    [];
  #capturing = false;
  #lastHash: string | undefined;
  #lastEntry: ConsoleEntry | undefined;

  constructor(options: ConsoleCollectorOptions) {
    this.#console = options.console as Record<string, unknown>;
    this.#target = options.target;
    this.#clock = options.clock;
    this.#emit = options.emit;
    this.#methods = options.methods ?? [...DEFAULT_CONSOLE_METHODS];
    this.#createId =
      options.createId ??
      createIdFactory({ now: () => Number(this.#clock.now()), random: () => Math.random() });
    this.#serialize = options.serialize ?? ((value) => serializeValue(value));
    this.#install();
  }

  /** Number of console methods currently patched. */
  get patchedCount(): number {
    return this.#installed.length;
  }

  /** Restores every patched method and removes every listener. */
  dispose(): void {
    for (const { type, listener } of this.#listeners) {
      this.#safe(() => {
        this.#target.removeEventListener(type, listener, true);
      });
    }
    this.#listeners.length = 0;

    for (const { method, descriptor } of this.#installed) {
      this.#safe(() => {
        if (descriptor === undefined) {
          Reflect.deleteProperty(this.#console, method);
        } else {
          Object.defineProperty(this.#console, method, descriptor);
        }
      });
    }
    this.#installed.length = 0;
    this.#lastHash = undefined;
    this.#lastEntry = undefined;
  }

  #install(): void {
    for (const method of this.#methods) {
      this.#patchMethod(method);
    }
    this.#listen('error', (event) => {
      this.#onError(event);
    });
    this.#listen('unhandledrejection', (event) => {
      this.#onRejection(event);
    });
    this.#listen('securitypolicyviolation', (event) => {
      this.#onCsp(event);
    });
  }

  #patchMethod(method: ConsoleMethod): void {
    const descriptor = Object.getOwnPropertyDescriptor(this.#console, method);
    const candidate: unknown = this.#console[method];
    if (typeof candidate !== 'function') {
      return;
    }
    const patched = (...args: unknown[]): unknown => {
      let result: unknown;
      try {
        result = Reflect.apply(candidate, this.#console, args) as unknown;
      } catch {
        result = undefined;
      }
      this.#captureConsole(method, args);
      return result;
    };
    Object.defineProperty(patched, 'name', { value: method, configurable: true });
    this.#safe(() => {
      Object.defineProperty(this.#console, method, {
        ...(descriptor ?? { configurable: true, writable: true, enumerable: true }),
        value: patched,
      });
    });
    this.#installed.push({ method, descriptor });
  }

  #listen(type: string, listener: (event: unknown) => void): void {
    this.#safe(() => {
      this.#target.addEventListener(type, listener, true);
    });
    this.#listeners.push({ type, listener });
  }

  #captureConsole(level: ConsoleLevel, args: readonly unknown[]): void {
    if (this.#capturing) {
      return;
    }
    this.#capturing = true;
    try {
      const serialized = args.map((value) => this.#serialize(value));
      const hash = hashSerialized(level, serialized);
      if (hash === this.#lastHash && this.#lastEntry !== undefined) {
        this.#lastEntry = { ...this.#lastEntry, count: this.#lastEntry.count + 1 };
        this.#emit(this.#lastEntry);
        return;
      }
      const entry: ConsoleEntry = {
        id: this.#createId(),
        kind: 'console',
        level,
        timestamp: this.#clock.now(),
        args: serialized,
        count: 1,
      };
      this.#lastHash = hash;
      this.#lastEntry = entry;
      this.#emit(entry);
    } catch {
      // Capture failures must never reach page code.
    } finally {
      this.#capturing = false;
    }
  }

  #onError(event: unknown): void {
    const record = asRecord(event);
    if ('message' in record || 'error' in record) {
      const error = asRecord(record.error);
      const message = error.message ?? record.message;
      const stack = stringField(error, 'stack') ?? this.#location(record);
      this.#emitEvent('uncaught', 'error', [record.error ?? message], stack);
      return;
    }
    this.#emitEvent('resource', 'error', [this.#describeResource(record)]);
  }

  #onRejection(event: unknown): void {
    const record = asRecord(event);
    this.#emitEvent('rejection', 'error', [record.reason]);
  }

  #onCsp(event: unknown): void {
    const record = asRecord(event);
    const blocked = stringField(record, 'blockedURI') ?? 'unknown';
    const directive = stringField(record, 'violatedDirective') ?? 'unknown';
    this.#emitEvent('csp', 'warn', [`${directive} blocked ${blocked}`]);
  }

  #emitEvent(
    kind: ConsoleEntry['kind'],
    level: ConsoleLevel,
    args: readonly unknown[],
    stack?: string,
  ): void {
    if (this.#capturing) {
      return;
    }
    this.#capturing = true;
    try {
      const serialized = args.map((value) => this.#serialize(value));
      const entry: ConsoleEntry = {
        id: this.#createId(),
        kind,
        level,
        timestamp: this.#clock.now(),
        args: serialized,
        count: 1,
        ...(stack === undefined ? {} : { stack }),
      };
      this.#lastHash = undefined;
      this.#lastEntry = undefined;
      this.#emit(entry);
    } catch {
      // Isolated.
    } finally {
      this.#capturing = false;
    }
  }

  #location(record: Record<string, unknown>): string | undefined {
    const filename = stringField(record, 'filename');
    if (filename === undefined) {
      return undefined;
    }
    const line = typeof record.lineno === 'number' ? record.lineno : undefined;
    return line === undefined ? filename : `${filename}:${String(line)}`;
  }

  #describeResource(record: Record<string, unknown>): string {
    const target = asRecord(record.target);
    const url =
      stringField(target, 'currentSrc') ??
      stringField(target, 'src') ??
      stringField(target, 'href');
    const tag = stringField(target, 'tagName');
    return `Failed to load ${tag ?? 'resource'}${url === undefined ? '' : ` ${url}`}`;
  }

  #safe(operation: () => void): void {
    try {
      operation();
    } catch {
      // Isolated.
    }
  }
}
