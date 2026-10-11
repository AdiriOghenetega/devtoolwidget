import type { ExportFormat } from '../domain/finding';
import { buildBundle, buildHar, buildMarkdown } from './builders';
import type { RedactedExportInput } from './redact-export';

/** A finished export: the filename and its serialized content. */
export interface BuiltExport {
  readonly filename: string;
  readonly content: string;
}

/** The file extension and media type for each export format. */
export const EXPORT_MEDIA_TYPES: Readonly<Record<ExportFormat, string>> = {
  markdown: 'text/markdown',
  json: 'application/json',
  har: 'application/json',
};

/** Builds the export content for a format from already-redacted input. Pure. */
export function buildReport(input: RedactedExportInput, format: ExportFormat): BuiltExport {
  switch (format) {
    case 'markdown':
      return { filename: 'devtoolwidget-report.md', content: buildMarkdown(input) };
    case 'json':
      return { filename: 'devtoolwidget-report.json', content: buildBundle(input) };
    case 'har':
      return {
        filename: 'devtoolwidget-report.har',
        content: JSON.stringify(buildHar(input), null, 2),
      };
  }
}
