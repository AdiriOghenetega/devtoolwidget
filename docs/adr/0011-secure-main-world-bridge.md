# 11. Secure main-world bridge and entrypoint wiring

- Status: Accepted
- Date: 2026-10-09

## Context

PRD section 7 requires that the main-world agent and the content script never talk
over a plain `window.postMessage` stream, because page scripts can listen to it. The
bridge must hand over a one-time `MessageChannel` port during a handshake, and all
main-world input is untrusted and must be validated with Zod. PRD section 8.1 places
the agent in the main world at `document_start`, the content script at
`document_start` in the isolated world, and the widget root in the content script.

## Decision

- **Agent delivery.** The agent is registered as a content script with `world: 'MAIN'`
  and `runAt: 'document_start'` (WXT `defineContentScript`). This is verified against
  WXT's Content Scripts docs and Chrome's `scripting`/`content_scripts` reference
  (2026-10): a MAIN-world script at `document_start` runs before page scripts and is
  not subject to the page CSP. (The PRD mentions `scripting.executeScript`; registering
  the script is equivalent in effect and deterministic, so it is preferred over an
  async injection that could race page scripts.)
- **Handshake.** The content script generates a nonce, creates a `MessageChannel`, and
  posts a nonce-tagged handshake transferring `port2`. The agent installs a
  **capturing** `message` listener synchronously at `document_start`, adopts the first
  valid handshake, calls `stopImmediatePropagation()` so later page listeners never see
  the transfer, and acks over the port.
- **All later traffic** goes over the port and is validated with the protocol schemas
  (`parseCommand`, `parseResult`, `parseMessage`). Handshake and ack are validated with
  Zod. Invalid data is dropped.
- **Wiring.** `entrypoints/background`, `entrypoints/content` and `entrypoints/agent`
  only wire pre-built pieces (`createChromePorts`, `TabSessionRegistry`,
  `createCommandRouter`, bridge install/connect, `hostWidgetRoot`); no business logic
  lives in the entrypoints.
- A `command.ping` flows end to end: UI stub → service worker (`router.handle`, which
  records the session) and, over the port, content → agent → content.

## Residual risks

1. **Ordering race.** The MAIN agent and the ISOLATED content script both run at
   `document_start`; if the handshake is posted before the agent's listener is
   installed it is missed. Mitigated by retrying with a fresh channel, but a page
   script that runs before the agent could hand over its own port. The agent's
   `document_start` registration makes this unlikely, not impossible.
2. **Scope of suppression.** `stopImmediatePropagation` only stops later listeners of
   the same event during the same dispatch. A page that monkey-patches
   `addEventListener`/`MessageChannel` before the agent loads, or listens on another
   channel, is out of scope.
3. **Nonce is not a shared secret.** The agent does not know the nonce in advance; it
   binds the ack and prevents casual replay, but a page that wins the race could still
   present a handshake. A future improvement is a build-time channel identifier.
4. **Shared JS context.** The main-world agent runs in the page's context: the page can
   inspect or tamper with anything the agent holds. The agent must never hold secrets.
5. **Browser support.** MAIN-world content scripts do not support MV2 and lack the
   extension API; Firefox's support for `world: 'MAIN'` content scripts is narrower
   than Chromium. The bridge is Chromium-first and needs feature detection on Firefox.
6. **Port lifetime.** `MessageChannel` transfer is single-use and the agent accepts one
   handshake per document, so a lost port (navigation, worker restart) has no defined
   reconnect policy yet.
7. **Full UI→SW→agent→UI relay.** The service worker cannot address the tab's port
   directly (the port lives in the content script). The end-to-end test exercises the
   SW router and the content↔agent port separately; the SW↔content forwarding hop is a
   follow-up.

## Consequences

- The handshake is one-time, nonce-tagged and invisible to later page listeners, and all
  bridge payloads are Zod-validated.
- The residual risks above must be revisited before the bridge is considered hardened;
  they are recorded here rather than hidden.
