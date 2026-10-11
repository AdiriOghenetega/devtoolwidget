import { isSensitiveKey, redactHeaders, redactString, redactUrl } from '../redaction/redact';
import type { SerializedValue } from '../domain/console';
import type { ConsoleEntry } from '../domain/console';
import type { NetworkEntry } from '../domain/network';
import type { Finding } from '../domain/finding';
import type { PageSnapshot } from '../domain/snapshot';

/** Context included at the top of every export. */
export interface ExportEnvironment {
  readonly url: string;
  readonly userAgent: string;
  readonly extensionVersion: string;
}

/** Everything an export is built from. */
export interface ExportInput {
  readonly environment: ExportEnvironment;
  readonly snapshot: PageSnapshot;
  readonly findings: readonly Finding[];
  readonly healthScore: number;
  readonly storageKeys?: readonly string[];
}

/** Input after the mandatory redaction pass (safe to serialize). */
export interface RedactedExportInput {
  readonly environment: ExportEnvironment;
  readonly url: string;
  readonly capturedAt: number;
  readonly healthScore: number;
  readonly findings: readonly Finding[];
  readonly console: readonly ConsoleEntry[];
  readonly network: readonly NetworkEntry[];
  readonly storageAreas: PageSnapshot['storage']['areas'];
  readonly storageKeys: readonly string[];
}

function redactSerialized(value: SerializedValue): SerializedValue {
  switch (value.type) {
    case 'string':
      return { type: 'string', value: redactString(value.value) };
    case 'error':
      return {
        type: 'error',
        name: value.name,
        message: redactString(value.message),
        ...(value.stack === undefined ? {} : { stack: redactString(value.stack) }),
      };
    case 'array':
      return {
        type: 'array',
        items: value.items.map(redactSerialized),
        truncated: value.truncated,
      };
    case 'object':
      return {
        type: 'object',
        entries: value.entries.map((entry) => ({
          key: entry.key,
          value: redactSerialized(entry.value),
        })),
        truncated: value.truncated,
      };
    case 'map':
      return {
        type: 'map',
        entries: value.entries.map((entry) => ({
          key: redactSerialized(entry.key),
          value: redactSerialized(entry.value),
        })),
        truncated: value.truncated,
      };
    case 'set':
      return { type: 'set', items: value.items.map(redactSerialized), truncated: value.truncated };
    default:
      return value;
  }
}

function redactConsoleEntry(entry: ConsoleEntry): ConsoleEntry {
  return {
    ...entry,
    args: entry.args.map(redactSerialized),
    ...(entry.stack === undefined ? {} : { stack: redactString(entry.stack) }),
  };
}

function redactNetworkEntry(entry: NetworkEntry): NetworkEntry {
  const redacted: NetworkEntry = {
    ...entry,
    url: redactUrl(entry.url),
    ...(entry.failure === undefined ? {} : { failure: redactString(entry.failure) }),
    ...(entry.headers === undefined ? {} : { headers: redactHeaders(entry.headers) }),
  };
  return redacted;
}

/**
 * The mandatory redaction pass run before any export (PRD FR-10, §7). It redacts
 * URLs (query tokens), headers, console arguments and stored keys, so secrets
 * never reach a HAR, markdown or JSON export.
 */
export function redactExportInput(input: ExportInput): RedactedExportInput {
  return {
    environment: { ...input.environment, url: redactUrl(input.environment.url) },
    url: redactUrl(input.snapshot.url),
    capturedAt: Number(input.snapshot.capturedAt),
    healthScore: input.healthScore,
    findings: input.findings.map((finding) => ({
      ...finding,
      evidence: finding.evidence.map((line) => redactString(line)),
    })),
    console: input.snapshot.console.map(redactConsoleEntry),
    network: input.snapshot.network.map(redactNetworkEntry),
    storageAreas: input.snapshot.storage.areas,
    storageKeys: (input.storageKeys ?? []).map((key) =>
      isSensitiveKey(key, []) ? 'REDACTED' : key,
    ),
  };
}
