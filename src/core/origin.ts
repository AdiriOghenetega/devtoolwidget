/**
 * Match-pattern ↔ origin conversion (PRD 7, G12).
 *
 * Chrome's `permissions` API speaks *match patterns* (`https://example.com/*`),
 * while the rest of the code speaks bare *origins* (`https://example.com`).
 * Match patterns **ignore ports** — one pattern covers the whole host on any
 * port (`http://localhost/*` matches every localhost port) — so both sides are
 * normalised here to a port-less, path-less "host origin". This lives in `core`
 * so both the `platform` permissions adapter (which converts to patterns) and
 * `capture` (which keys scripts by host origin) share one implementation.
 */

/** The host origin of a URL or origin: scheme + host, no port, no path. */
export function toHostOrigin(input: string): string {
  try {
    const url = new URL(input);
    return url.hostname === '' ? input : `${url.protocol}//${url.hostname}`;
  } catch {
    return input;
  }
}

/**
 * The match pattern that grants an origin's whole host on any port, e.g.
 * `http://localhost:4178` → `http://localhost/*`.
 */
export function toHostPattern(origin: string): string {
  return `${toHostOrigin(origin)}/*`;
}

/**
 * Recovers the host origin from a match pattern, or `undefined` when the pattern
 * does not name a single specific host (wildcards such as `<all_urls>`, a bare
 * scheme wildcard, or a wildcard subdomain).
 */
export function hostOriginFromPattern(pattern: string): string | undefined {
  if (!pattern.includes('://')) {
    return undefined;
  }
  try {
    const url = new URL(pattern);
    if (url.hostname === '' || url.hostname.includes('*')) {
      return undefined;
    }
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return undefined;
  }
}
