/**
 * The `capture` layer: console, network and performance collectors.
 *
 * Per PRD 8.2 (as clarified in ADR 0003) capture may import `core`, `protocol`
 * and the platform ports (interfaces) only; never the platform adapters, fakes
 * or ui/entrypoints. Tests may use the platform fakes.
 *
 * Placeholder that proves the layer is wired into the toolchain.
 */
export function captureLayerName(): string {
  return 'capture';
}
