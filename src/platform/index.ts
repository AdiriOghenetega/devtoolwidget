/**
 * The `platform` layer: ports (interfaces) for browser capabilities plus real
 * adapters and in-memory fakes. It may import `core` and `protocol` only.
 *
 * Placeholder that proves the layer is wired into the toolchain. Ports live in
 * `src/platform/ports/`, adapters in `src/platform/chrome/` and
 * `src/platform/firefox/`, fakes in `src/platform/fakes/` (PRD 8.2, 8.3).
 */
export function platformLayerName(): string {
  return 'platform';
}
