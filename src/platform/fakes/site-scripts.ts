import { err, ok } from '../../core';
import { platformError } from '../ports/errors';
import type {
  RegisteredSiteScript,
  SiteScriptDescriptor,
  SiteScriptsPort,
} from '../ports/site-scripts';

/** An in-memory {@link SiteScriptsPort} with an inspectable registration list. */
export interface FakeSiteScriptsPort extends SiteScriptsPort {
  readonly registered: readonly SiteScriptDescriptor[];
  failNext(reason: string): void;
}

/** Creates an in-memory fake site-scripts port. */
export function createFakeSiteScriptsPort(): FakeSiteScriptsPort {
  const scripts = new Map<string, SiteScriptDescriptor>();
  let failure: string | undefined;
  const take = (): string | undefined => {
    const current = failure;
    failure = undefined;
    return current;
  };
  return {
    get registered() {
      return [...scripts.values()];
    },
    failNext(reason) {
      failure = reason;
    },
    register(descriptors) {
      const failed = take();
      if (failed !== undefined) {
        return Promise.resolve(err(platformError('unknown', failed)));
      }
      for (const descriptor of descriptors) {
        scripts.set(descriptor.id, descriptor);
      }
      return Promise.resolve(ok(undefined));
    },
    unregister(ids) {
      const failed = take();
      if (failed !== undefined) {
        return Promise.resolve(err(platformError('unknown', failed)));
      }
      for (const id of ids) {
        scripts.delete(id);
      }
      return Promise.resolve(ok(undefined));
    },
    list() {
      const registered: RegisteredSiteScript[] = [...scripts.values()].map((descriptor) => ({
        id: descriptor.id,
        matches: descriptor.matches,
      }));
      return Promise.resolve(ok(registered));
    },
  };
}
