# 17. Per-origin access is driven by typed commands

- Status: Accepted
- Date: 2026-10-11

## Context

`SiteAccessService` (request the optional host permission, register the content
and agent scripts for a granted origin, unregister on revocation, `sync()` after a
restart) existed and was constructed in the worker, but nothing could reach it:
there was no message path from any UI to `grant`/`revoke` (gap G6).

Access cannot be requested from the content script: without access the content
script never injects, and `chrome.permissions.request` needs a user gesture from an
extension context.

## Decision

- Add two commands to the protocol — `command.grantAccess` /
  `command.revokeAccess` — each taking an optional `origin`, with typed results
  (`result.grantAccess { origin, status }`, `result.revokeAccess { origin, revoked }`).
  They are validated like every other message and added to the command contract
  test.
- `createCommandRouter` gains a `siteAccess` capability and resolves the origin
  from the command payload, falling back to the tab's current URL origin; with
  neither it returns `invalid-argument`.
- The worker passes its `SiteAccessService` into the router, so any extension
  context (panel, options, future onboarding UI) can grant or revoke with one
  typed message, and the service's `sync()` on install/startup plus `onRevoked`
  keep registrations consistent.

## Consequences

- The service is wired and unit-tested through the router with the real service and
  the in-memory permission/site-script fakes.
- Two things remain before the model is live end to end, recorded as **G12**: the
  manifest currently lists `<all_urls>` as a **required** host permission (so
  `grant` returns `already-granted` and `revoke` cannot remove a required
  permission — it must move to `optional_host_permissions`), and there is no
  gesture-capable options page to drive the request on a user click.

## Residual risks

1. `sync()` registers for every granted origin on startup; a large grant set does
   more work, bounded by what the user granted.
2. The `getAll()`/`contains()` calls treat the whole permission set as origins;
   non-origin permissions would need filtering if any are added.
