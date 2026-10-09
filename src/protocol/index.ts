/**
 * The `protocol` layer: cross-context message types, Zod schemas, parse helpers
 * and the typed channel abstraction, with schema versioning (PRD 8.2, ADR 0009).
 *
 * It may import `core` (payloads carry core domain data and return `Result`);
 * it must not import `platform`, `capture`, `ui` or `entrypoints`.
 */
export * from './channel';
export * from './errors';
export * from './messages';
export * from './parse';
export * from './payloads';
export * from './version';
