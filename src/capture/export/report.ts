import {
  ALL_INSIGHT_RULES,
  buildReport,
  redactExportInput,
  runInsights,
  type BuiltExport,
  type ExportFormat,
  type PageSnapshot,
} from '../../core';

/** The inputs the worker has for a report: the page snapshot and environment. */
export interface SessionReportInput {
  readonly snapshot: PageSnapshot;
  readonly userAgent: string;
  readonly extensionVersion: string;
}

/**
 * Builds a redacted bug report from a page snapshot (PRD FR-10): it runs the
 * insight rules for the findings and health score, passes everything through the
 * mandatory redaction pass, and serializes it in the requested format. Pure.
 */
export function buildSessionExport(input: SessionReportInput, format: ExportFormat): BuiltExport {
  const run = runInsights(input.snapshot, { rules: ALL_INSIGHT_RULES });
  const redacted = redactExportInput({
    environment: {
      url: input.snapshot.url,
      userAgent: input.userAgent,
      extensionVersion: input.extensionVersion,
    },
    snapshot: input.snapshot,
    findings: run.findings,
    healthScore: run.score.score,
  });
  return buildReport(redacted, format);
}
