/**
 * The `core` layer: pure, browser-agnostic domain logic (PRD section 8.2).
 *
 * This barrel is the layer's public API. It re-exports the domain model, the
 * `Result` helpers and the pure utilities (buffers, redaction, serialization,
 * formatting and id generation).
 */
export * from './bridge-protocol';
export * from './buffers/ring-buffer';
export * from './clear';
export * from './commands';
export * from './deep';
export * from './domain';
export * from './export';
export * from './format/formatters';
export * from './ids/id';
export * from './insights';
export * from './network';
export * from './origin';
export * from './performance';
export * from './placement';
export * from './redaction/redact';
export * from './result';
export * from './snapshots';
export * from './serialization/serialize-value';
export * from './settings';
