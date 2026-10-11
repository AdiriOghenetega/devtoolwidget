import { toHostOrigin, toHostPattern } from '../../core';
import type { SiteScriptDescriptor } from '../../platform/ports';

/** Prefix for dynamically registered site script ids. */
export const SITE_SCRIPT_PREFIX = 'dwsite';

/** Deterministic id for the isolated-world content script of an origin's host. */
export function contentScriptId(origin: string): string {
  return `${SITE_SCRIPT_PREFIX}:content:${toHostOrigin(origin)}`;
}

/** Deterministic id for the main-world agent script of an origin's host. */
export function agentScriptId(origin: string): string {
  return `${SITE_SCRIPT_PREFIX}:agent:${toHostOrigin(origin)}`;
}

/**
 * The content and agent scripts to register for a granted origin (PRD 8.1). Ids
 * and matches are keyed by the port-less host origin, so a grant for
 * `http://localhost:4178` covers `http://localhost` on any port (match patterns
 * ignore ports, G12). The `js` paths are the WXT build outputs.
 */
export function siteScriptDescriptors(origin: string): readonly SiteScriptDescriptor[] {
  const matches = [toHostPattern(origin)];
  return [
    {
      id: contentScriptId(origin),
      matches,
      js: ['content-scripts/content.js'],
      runAt: 'document_start',
    },
    {
      id: agentScriptId(origin),
      matches,
      js: ['agent.js'],
      runAt: 'document_start',
      world: 'MAIN',
    },
  ];
}

/** Recovers the origin from a site script id, or `undefined` when it is not ours. */
export function originOfScriptId(id: string): string | undefined {
  const parts = id.split(':');
  if (parts.length < 3 || parts[0] !== SITE_SCRIPT_PREFIX) {
    return undefined;
  }
  return parts.slice(2).join(':');
}
