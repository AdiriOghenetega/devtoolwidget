import { describe, expect, it } from 'vitest';
import { toMillis, toTabId } from '../domain/brands';
import type { PageSnapshot } from '../domain/snapshot';
import { buildReport, EXPORT_MEDIA_TYPES } from './build-report';
import { redactExportInput, type RedactedExportInput } from './redact-export';

const emptySnapshot: PageSnapshot = {
  tabId: toTabId(1),
  url: 'https://a.test/?token=secret',
  capturedAt: toMillis(1_000),
  console: [],
  network: [],
  vitals: [],
  longTasks: [],
  storage: { areas: [] },
};

function redacted(): RedactedExportInput {
  return redactExportInput({
    environment: { url: emptySnapshot.url, userAgent: 'test-agent', extensionVersion: '1.0.0' },
    snapshot: emptySnapshot,
    findings: [],
    healthScore: 91,
  });
}

describe('buildReport', () => {
  it('builds a markdown report with the environment and health score', () => {
    const built = buildReport(redacted(), 'markdown');
    expect(built.filename).toBe('devtoolwidget-report.md');
    expect(built.content).toContain('# Bug report');
    expect(built.content).toContain('Health score: 91/100');
  });

  it('builds a JSON bundle that round-trips', () => {
    const built = buildReport(redacted(), 'json');
    expect(built.filename).toBe('devtoolwidget-report.json');
    const parsed = JSON.parse(built.content) as { generator: string; healthScore: number };
    expect(parsed.generator).toBe('devToolWidget');
    expect(parsed.healthScore).toBe(91);
  });

  it('builds a HAR 1.2 export', () => {
    const built = buildReport(redacted(), 'har');
    expect(built.filename).toBe('devtoolwidget-report.har');
    const parsed = JSON.parse(built.content) as { log: { version: string } };
    expect(parsed.log.version).toBe('1.2');
  });

  it('declares a media type for every format', () => {
    expect(EXPORT_MEDIA_TYPES.markdown).toBe('text/markdown');
    expect(EXPORT_MEDIA_TYPES.har).toBe('application/json');
  });
});
