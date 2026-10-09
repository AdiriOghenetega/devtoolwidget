/**
 * The `platform` layer: ports (interfaces) for browser capabilities, real
 * Chrome adapters and in-memory fakes (PRD 8.2, ADR 0010).
 *
 * `platform` may import `core` and `protocol`; it must not import `capture`,
 * `ui` or `entrypoints`.
 */
export * from './chrome';
export * from './fakes';
export * from './ports';
