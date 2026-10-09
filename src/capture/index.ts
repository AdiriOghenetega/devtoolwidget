/**
 * The `capture` layer: console, network, performance and storage collectors and
 * executors.
 *
 * Per PRD 8.2 (as clarified in ADR 0003) capture may import `core`, `protocol`
 * and the platform ports (interfaces) only; never the platform adapters, fakes
 * or ui/entrypoints. Tests may use the platform fakes.
 */
export function captureLayerName(): string {
  return 'capture';
}

export * from './pipeline';
export * from './storage';
