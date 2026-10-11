import { formatBytes } from '../format/formatters';
import type { RedactedExportInput } from './redact-export';

// --- HAR 1.2 subset ---------------------------------------------------------

export interface HarNameValue {
  readonly name: string;
  readonly value: string;
}

export interface HarEntry {
  readonly startedDateTime: string;
  readonly time: number;
  readonly request: {
    readonly method: string;
    readonly url: string;
    readonly httpVersion: string;
    readonly headers: readonly HarNameValue[];
    readonly queryString: readonly HarNameValue[];
    readonly cookies: readonly HarNameValue[];
    readonly headersSize: number;
    readonly bodySize: number;
  };
  readonly response: {
    readonly status: number;
    readonly statusText: string;
    readonly httpVersion: string;
    readonly headers: readonly HarNameValue[];
    readonly content: { readonly size: number; readonly mimeType: string };
    readonly redirectURL: string;
    readonly headersSize: number;
    readonly bodySize: number;
  };
  readonly cache: Record<string, never>;
  readonly timings: {
    readonly blocked: number;
    readonly dns: number;
    readonly connect: number;
    readonly send: number;
    readonly wait: number;
    readonly receive: number;
    readonly ssl: number;
  };
}

export interface Har {
  readonly log: {
    readonly version: '1.2';
    readonly creator: { readonly name: string; readonly version: string };
    readonly entries: readonly HarEntry[];
  };
}

/**
 * A Zod schema for the HAR 1.2 subset this module produces. It is a **test-only**
 * helper and lives in `export.test.ts`, not here, so that `core`'s runtime graph
 * (and therefore the page-world agent bundle) pulls in no Zod (ADR 0018).
 */

function headersToHar(headers: RedactedExportInput['network'][number]['headers']): HarNameValue[] {
  if (headers === undefined) {
    return [];
  }
  return Object.entries(headers).map(([name, value]) => ({
    name,
    value: typeof value === 'string' ? value : value.join(', '),
  }));
}

function statusText(status: number | null): string {
  if (status === null) {
    return 'Network Error';
  }
  return status >= 400 ? 'Error' : 'OK';
}

/** Builds a HAR 1.2 subset from redacted network entries. Pure. */
export function buildHar(input: RedactedExportInput): Har {
  return {
    log: {
      version: '1.2',
      creator: { name: 'devToolWidget', version: input.environment.extensionVersion },
      entries: input.network.map((entry) => ({
        startedDateTime: new Date(Number(entry.startedAt ?? 0)).toISOString(),
        time: Number(entry.timing.total),
        request: {
          method: entry.method,
          url: entry.url,
          httpVersion: 'HTTP/1.1',
          headers: headersToHar(entry.headers),
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: -1,
        },
        response: {
          status: entry.status ?? 0,
          statusText: statusText(entry.status),
          httpVersion: 'HTTP/1.1',
          headers: [],
          content: { size: Number(entry.decodedSize), mimeType: entry.resourceType },
          redirectURL: '',
          headersSize: -1,
          bodySize: -1,
        },
        cache: {},
        timings: {
          blocked: -1,
          dns: Number(entry.timing.dns),
          connect: Number(entry.timing.connect),
          send: 0,
          wait: Number(entry.timing.ttfb),
          receive: Number(entry.timing.download),
          ssl: Number(entry.timing.tls),
        },
      })),
    },
  };
}

// --- Markdown report --------------------------------------------------------

/** Builds a plain-language markdown bug report. Pure. */
export function buildMarkdown(input: RedactedExportInput): string {
  const lines: string[] = [];
  lines.push('# Bug report', '');
  lines.push('## Environment', '');
  lines.push(`- URL: ${input.url}`);
  lines.push(`- User agent: ${input.environment.userAgent}`);
  lines.push(`- Extension: devToolWidget ${input.environment.extensionVersion}`);
  lines.push('');

  lines.push('## Summary', '');
  lines.push(`- Health score: ${String(input.healthScore)}/100`);
  lines.push(`- Findings: ${String(input.findings.length)}`);
  lines.push(`- Requests: ${String(input.network.length)}`);
  lines.push(`- Console entries: ${String(input.console.length)}`);
  lines.push('');

  lines.push('## Top findings', '');
  for (const finding of input.findings.slice(0, 5)) {
    lines.push(`### ${finding.title} (${finding.severity})`);
    for (const line of finding.evidence) {
      lines.push(`- ${line}`);
    }
    lines.push(`_Suggestion: ${finding.suggestion}_`, '');
  }

  lines.push('## Console excerpt', '');
  for (const entry of input.console.slice(0, 20)) {
    lines.push(`- [${entry.level}] ${entry.kind}`);
  }
  lines.push('');

  lines.push('## Requests', '');
  lines.push('| Method | Status | URL | Transfer | Time |', '| --- | --- | --- | --- | --- |');
  for (const entry of input.network) {
    lines.push(
      `| ${entry.method} | ${String(entry.status ?? '—')} | ${entry.url} | ${formatBytes(Number(entry.transferSize))} | ${String(Number(entry.timing.total))} ms |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

// --- JSON bundle ------------------------------------------------------------

/** Builds a machine-readable JSON bundle (as a string). Pure. */
export function buildBundle(input: RedactedExportInput): string {
  return JSON.stringify(
    {
      generator: 'devToolWidget',
      version: input.environment.extensionVersion,
      capturedAt: input.capturedAt,
      environment: input.environment,
      url: input.url,
      healthScore: input.healthScore,
      findings: input.findings,
      console: input.console,
      network: input.network,
      storage: { areas: input.storageAreas, keys: input.storageKeys },
    },
    null,
    2,
  );
}
