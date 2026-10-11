import { describe, expect, it } from 'vitest';
import type { ConsoleEntry } from '../domain/console';
import type { Finding } from '../domain/finding';
import { toMillis } from '../domain/brands';
import { aSnapshot } from '../insights/builders';
import { buildBundle, buildHar, buildMarkdown, harSchema } from './builders';
import { redactExportInput, type ExportInput } from './redact-export';

const secretUrl = 'https://api.test/cb?access_token=SECRET_URL';

function buildInput(): ExportInput {
  const base = aSnapshot()
    .network({ url: secretUrl, headers: { authorization: 'Bearer SECRET_HEADER' }, status: 200 })
    .build();
  const entry: ConsoleEntry = {
    id: 'c1',
    kind: 'console',
    level: 'log',
    timestamp: toMillis(0),
    args: [{ type: 'string', value: 'Authorization: Bearer SECRET_CONSOLE' }],
    count: 1,
  };
  const finding: Finding = {
    id: 'f1',
    ruleId: 'R01',
    severity: 'warning',
    category: 'network',
    title: 'Failed request',
    evidence: ['Authorization: Bearer SECRET_EVIDENCE'],
    suggestion: 'Fix it',
    actions: [],
  };
  return {
    environment: { url: secretUrl, userAgent: 'UA', extensionVersion: '0.0.0' },
    snapshot: { ...base, console: [entry] },
    findings: [finding],
    healthScore: 80,
    storageKeys: ['SECRET_KEY', 'theme'],
  };
}

describe('redaction pass (corpus of planted secrets)', () => {
  it('removes every planted secret from HAR, markdown and bundle', () => {
    const redacted = redactExportInput(buildInput());
    const combined = [
      JSON.stringify(buildHar(redacted)),
      buildMarkdown(redacted),
      buildBundle(redacted),
    ].join('\n');

    expect(combined).not.toContain('SECRET_URL');
    expect(combined).not.toContain('SECRET_HEADER');
    expect(combined).not.toContain('SECRET_CONSOLE');
    expect(combined).not.toContain('SECRET_EVIDENCE');
    expect(combined).not.toContain('SECRET_KEY');
    expect(combined).toContain('REDACTED');
  });

  it('keeps non-sensitive storage keys', () => {
    const redacted = redactExportInput(buildInput());
    expect(redacted.storageKeys).toContain('theme');
  });
});

describe('buildHar', () => {
  it('produces a document valid against the HAR 1.2 subset schema', () => {
    const har = buildHar(redactExportInput(buildInput()));
    const parsed = harSchema.safeParse(har);
    expect(parsed.success).toBe(true);
    expect(har.log.version).toBe('1.2');
    expect(har.log.entries).toHaveLength(1);
  });
});

describe('buildMarkdown', () => {
  it('includes the environment, summary, findings, console and request sections', () => {
    const markdown = buildMarkdown(redactExportInput(buildInput()));
    expect(markdown).toContain('## Environment');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('## Top findings');
    expect(markdown).toContain('## Console excerpt');
    expect(markdown).toContain('## Requests');
    expect(markdown).toContain('Failed request');
  });
});

describe('buildBundle', () => {
  it('produces parseable JSON with the generator and sections', () => {
    const bundle = JSON.parse(buildBundle(redactExportInput(buildInput()))) as {
      generator: string;
      findings: unknown[];
      network: unknown[];
    };
    expect(bundle.generator).toBe('devToolWidget');
    expect(bundle.findings).toHaveLength(1);
    expect(bundle.network).toHaveLength(1);
  });
});
