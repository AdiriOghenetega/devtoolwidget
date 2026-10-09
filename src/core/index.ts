/**
 * The `core` layer: pure, browser-agnostic domain logic (PRD section 8.2).
 *
 * This barrel is the layer's public API. It re-exports the domain model, the
 * `Result` helpers and the pure utilities (buffers, redaction, serialization,
 * formatting and id generation).
 */
export * from './buffers/ring-buffer';
export * from './domain';
export * from './format/formatters';
export * from './ids/id';
export * from './network';
export * from './performance';
export * from './redaction/redact';
export * from './result';
export * from './serialization/serialize-value';
export * from './settings';
