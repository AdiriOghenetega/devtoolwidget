# Default redaction at capture (PRD section 7)

Analysis and record of the privacy defect fixed by PR #42
(`fix(capture): redact sensitive values by default at capture`), on `main`.

## The defect (default behaviour before the fix)

With the agent's default options:

- **Headers / body capture off** — `DEFAULT_CAPTURE = { headers: false, body: false, maxBodyBytes: 8_192 }`
  (`src/capture/network/network-collector.ts`).
- **Redaction was an injected optional** — `redactHeaders?.(headers) ?? headers` and
  `redactString?.(capped) ?? capped`. Nothing injected them, so enabling header/body
  capture would have stored those values **raw**.
- **The request URL and `meta.finalUrl` were never redacted** — `redactUrl` ran only
  inside `redactExportInput` (the export path).
- **Console arguments used the plain serializer** (`serializeValue`), so a
  Bearer/JWT-shaped string passed to `console.log` was stored raw.

## What could reach the store / panel / export unredacted

- **Query-string tokens** (e.g. `?token=secret`): the emitted `url` and
  `meta.finalUrl` were stored in the per-tab `storage.session` and rendered by the
  panel.
- **JWT / Bearer strings** in console output: stored and rendered raw.
- **Exports were redacted** (the export path re-ran `redactUrl`/`redactHeaders`/
  `redactString`), but that is not "redacted by default".

This violated **PRD §7 / G4** ("all data stays on the device, sensitive values are
redacted by default"; "default redaction of … query-string tokens and JWT-shaped
strings"). It was live on `main` (the collectors predate the fix).

## The fix

- `src/capture/network/network-collector.ts` — `redactHeaders`/`redactString`
  default to core's redactors (opt-out, not opt-in), and the emitted `url`,
  `meta.finalUrl` and failure string always pass through
  `redactUrl`/`redactString`.
- `src/core/export/redact-export.ts` — `redactSerialized` exported for reuse.
- `src/capture/console/console-collector.ts` — the default serializer redacts
  serialized string values via `redactSerialized(serializeValue(value))`.
- Test: `src/capture/redaction-defaults.test.ts` — `?token=secret` redacted in the
  URL by default; `Authorization` redacted when headers are enabled; JWT in a body
  preview redacted; JWT in `console.log` redacted.

## Status

- Merged on `main` via **PR #42** (commit `c0bcc02`); redaction rules can still be
  extended by user rules delivered to the agent (`agent.config`, G13).
- Explicit `redactHeaders`/`redactString` overrides still win (used by tests).
