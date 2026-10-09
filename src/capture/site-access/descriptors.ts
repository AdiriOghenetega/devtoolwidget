import type { SiteScriptDescriptor } from '../../platform/ports';

/** Prefix for dynamically registered site script ids. */
export const SITE_SCRIPT_PREFIX = 'dwsite';

/** Deterministic id for the isolated-world content script of an origin. */
export function contentScriptId(origin: string): string {
  return `${SITE_SCRIPT_PREFIX}:content:${origin}`;
}

/** Deterministic id for the main-world agent script of an origin. */
export function agentScriptId(origin: string): string {
  return `${SITE_SCRIPT_PREFIX}:agent:${origin}`;
}

/**
 * The content and agent scripts to register for a granted origin (PRD 8.1). The
 * `js` paths are the WXT build outputs for the content and agent entrypoints.
 */
export function siteScriptDescriptors(origin: string): readonly SiteScriptDescriptor[] {
  const matches = [`${origin}/*`];
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
