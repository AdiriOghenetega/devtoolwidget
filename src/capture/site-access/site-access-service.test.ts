import { describe, expect, it } from 'vitest';
import { createFakePermissionsPort, createFakeSiteScriptsPort } from '../../platform/fakes';
import { agentScriptId, contentScriptId, siteScriptDescriptors } from './descriptors';
import { SiteAccessService } from './site-access-service';

const ORIGIN = 'https://example.com';
const OTHER = 'https://other.test';

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('SiteAccessService', () => {
  it('registers the content and agent scripts when the permission is granted', async () => {
    const permissions = createFakePermissionsPort();
    const siteScripts = createFakeSiteScriptsPort();

    const result = await new SiteAccessService({ permissions, siteScripts }).grant(ORIGIN);

    expect(result).toEqual({ ok: true, value: 'granted' });
    expect(siteScripts.registered.map((script) => script.id)).toEqual([
      contentScriptId(ORIGIN),
      agentScriptId(ORIGIN),
    ]);
  });

  it('reports denied and registers nothing when the user refuses', async () => {
    const permissions = createFakePermissionsPort();
    permissions.setRequestResult(false);
    const siteScripts = createFakeSiteScriptsPort();

    const result = await new SiteAccessService({ permissions, siteScripts }).grant(ORIGIN);

    expect(result).toEqual({ ok: true, value: 'denied' });
    expect(siteScripts.registered).toHaveLength(0);
  });

  it('reports already-granted and ensures the scripts are registered', async () => {
    const permissions = createFakePermissionsPort([ORIGIN]);
    const siteScripts = createFakeSiteScriptsPort();

    const result = await new SiteAccessService({ permissions, siteScripts }).grant(ORIGIN);

    expect(result).toEqual({ ok: true, value: 'already-granted' });
    expect(siteScripts.registered).toHaveLength(2);
  });

  it('unregisters the scripts when the permission is revoked', async () => {
    const permissions = createFakePermissionsPort();
    const siteScripts = createFakeSiteScriptsPort();
    const service = new SiteAccessService({ permissions, siteScripts });
    await service.grant(ORIGIN);
    service.onRevoked(() => {
      // no-op observer
    });

    permissions.revoke([ORIGIN]);
    await flush();

    expect(siteScripts.registered).toHaveLength(0);
  });

  it('re-registers granted origins after a browser restart', async () => {
    // Restart: the browser dropped dynamic registrations but the grant persists.
    const permissions = createFakePermissionsPort([ORIGIN]);
    const siteScripts = createFakeSiteScriptsPort();

    const result = await new SiteAccessService({ permissions, siteScripts }).sync();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain(ORIGIN);
    }
    expect(siteScripts.registered.map((script) => script.id)).toContain(contentScriptId(ORIGIN));
  });

  it('removes stale registrations for origins that are no longer granted', async () => {
    const permissions = createFakePermissionsPort([ORIGIN]);
    const siteScripts = createFakeSiteScriptsPort();
    await siteScripts.register(siteScriptDescriptors(OTHER));

    const result = await new SiteAccessService({ permissions, siteScripts }).sync();

    expect(result.ok).toBe(true);
    const ids = siteScripts.registered.map((script) => script.id);
    expect(ids).not.toContain(contentScriptId(OTHER));
    expect(ids).toContain(contentScriptId(ORIGIN));
  });
});
