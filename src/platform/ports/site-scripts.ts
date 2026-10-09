import type { Result } from '../../core';
import type { PlatformError } from './errors';

/** The world a dynamically registered site script runs in. */
export type SiteScriptWorld = 'ISOLATED' | 'MAIN';

/** A content/agent script to register for a granted origin. */
export interface SiteScriptDescriptor {
  readonly id: string;
  readonly matches: readonly string[];
  readonly js: readonly string[];
  readonly runAt: 'document_start';
  readonly world?: SiteScriptWorld;
}

/** A script the browser currently has registered. */
export interface RegisteredSiteScript {
  readonly id: string;
  readonly matches: readonly string[];
}

/**
 * Dynamic content-script registration (PRD 8.1): the widget's content and agent
 * scripts are registered per granted origin, not for every site.
 */
export interface SiteScriptsPort {
  register(descriptors: readonly SiteScriptDescriptor[]): Promise<Result<void, PlatformError>>;
  unregister(ids: readonly string[]): Promise<Result<void, PlatformError>>;
  list(): Promise<Result<readonly RegisteredSiteScript[], PlatformError>>;
}
