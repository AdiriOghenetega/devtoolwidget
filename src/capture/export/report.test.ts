import { describe, expect, it } from 'vitest';
import { toMillis, toTabId, type PageSnapshot } from '../../core';
import { buildSessionExport } from './report';

const snapshot: PageSnapshot = {
  tabId: toTabId(1),
  url: 'https://a.test/?token=secret',
  capturedAt: toMillis(1_000),
  console: [],
  network: [],
  vitals: [],
  longTasks: [],
  storage: { areas: [] },
};

describe('buildSessionExport', () => {
  it('builds a markdown report and redacts the URL query', () => {
    const built = buildSessionExport(
      { snapshot, userAgent: 'test-agent', extensionVersion: '1.0.0' },
      'markdown',
    );
    expect(built.filename).toBe('devtoolwidget-report.md');
    expect(built.content).toContain('# Bug report');
    expect(built.content).not.toContain('token=secret');
  });

  it('builds a JSON bundle for the requested format', () => {
    const built = buildSessionExport(
      { snapshot, userAgent: 'test-agent', extensionVersion: '1.0.0' },
      'json',
    );
    expect(built.filename).toBe('devtoolwidget-report.json');
    expect(JSON.parse(built.content)).toMatchObject({ generator: 'devToolWidget' });
  });
});
