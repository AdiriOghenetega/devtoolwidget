import type { Millis } from './brands';

/** Where a console entry came from (PRD FR-3). */
export type ConsoleKind = 'console' | 'uncaught' | 'rejection' | 'csp' | 'resource';

/** A console log level. */
export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';

/**
 * A structural, capped, serialization of one console argument (PRD FR-3):
 * circular references, DOM nodes, errors and large objects are represented
 * rather than thrown away.
 */
export type SerializedValue =
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'null' }
  | { readonly type: 'undefined' }
  | { readonly type: 'bigint'; readonly value: string }
  | { readonly type: 'symbol'; readonly value: string }
  | { readonly type: 'function'; readonly name: string }
  | {
      readonly type: 'error';
      readonly name: string;
      readonly message: string;
      readonly stack?: string | undefined;
    }
  | { readonly type: 'node'; readonly nodeName: string }
  | {
      readonly type: 'array';
      readonly items: readonly SerializedValue[];
      readonly truncated: boolean;
    }
  | {
      readonly type: 'object';
      readonly entries: readonly SerializedObjectEntry[];
      readonly truncated: boolean;
    }
  | {
      readonly type: 'map';
      readonly entries: readonly SerializedMapEntry[];
      readonly truncated: boolean;
    }
  | {
      readonly type: 'set';
      readonly items: readonly SerializedValue[];
      readonly truncated: boolean;
    }
  | {
      readonly type: 'typed-array';
      readonly kind: string;
      readonly length: number;
      readonly preview: readonly string[];
      readonly truncated: boolean;
    }
  | { readonly type: 'date'; readonly iso: string }
  | { readonly type: 'regexp'; readonly source: string; readonly flags: string }
  | { readonly type: 'circular'; readonly reference: string }
  | { readonly type: 'unserializable'; readonly reason: string };

/** One key/value pair of a serialized object. */
export interface SerializedObjectEntry {
  readonly key: string;
  readonly value: SerializedValue;
}

/** One key/value pair of a serialized Map. */
export interface SerializedMapEntry {
  readonly key: SerializedValue;
  readonly value: SerializedValue;
}

/** A single captured console entry (PRD section 9, FR-3). */
export interface ConsoleEntry {
  readonly id: string;
  readonly kind: ConsoleKind;
  readonly level: ConsoleLevel;
  readonly timestamp: Millis;
  readonly args: readonly SerializedValue[];
  readonly stack?: string;
  /** Number of collapsed duplicates this entry represents. */
  readonly count: number;
}
