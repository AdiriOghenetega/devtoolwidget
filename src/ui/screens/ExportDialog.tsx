import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { Button } from '../design-system/primitives/Button';
import { Checkbox } from '../design-system/primitives/Checkbox';
import { buildBundle, buildHar, buildMarkdown, redactExportInput } from '../../core';
import type { ExportInput } from '../../core';

/** Props for {@link ExportDialog}. */
export interface ExportDialogProps {
  readonly input: ExportInput;
  readonly onCopy?: (text: string) => void;
  readonly onDownload?: (filename: string, text: string) => void;
}

interface Sections {
  readonly har: boolean;
  readonly markdown: boolean;
  readonly bundle: boolean;
}

function buildPreview(input: ExportInput, sections: Sections): string {
  const redacted = redactExportInput(input);
  const parts: string[] = [];
  if (sections.markdown) {
    parts.push(buildMarkdown(redacted));
  }
  if (sections.har) {
    parts.push('```json\n' + JSON.stringify(buildHar(redacted), null, 2) + '\n```');
  }
  if (sections.bundle) {
    parts.push('```json\n' + buildBundle(redacted) + '\n```');
  }
  return parts.join('\n\n');
}

/** Export dialog (FR-10): preview with per-section include toggles, copy and download. */
export function ExportDialog({ input, onCopy, onDownload }: ExportDialogProps): JSX.Element {
  const [sections, setSections] = useState<Sections>({ har: false, markdown: true, bundle: false });
  const [copied, setCopied] = useState(false);
  const preview = buildPreview(input, sections);

  return (
    <section class="dwt-export" aria-label={t('export.title')}>
      <h1>{t('export.title')}</h1>

      <div class="dwt-export__sections">
        <Checkbox
          label={t('export.includeHar')}
          checked={sections.har}
          onChange={(checked) => {
            setSections({ ...sections, har: checked });
          }}
        />
        <Checkbox
          label={t('export.includeMarkdown')}
          checked={sections.markdown}
          onChange={(checked) => {
            setSections({ ...sections, markdown: checked });
          }}
        />
        <Checkbox
          label={t('export.includeBundle')}
          checked={sections.bundle}
          onChange={(checked) => {
            setSections({ ...sections, bundle: checked });
          }}
        />
      </div>

      <h2>{t('export.preview')}</h2>
      <pre class="dwt-export__preview" aria-label={t('export.preview')}>
        {preview}
      </pre>

      <div class="dwt-export__actions">
        <Button
          onClick={() => {
            onCopy?.(preview);
            setCopied(true);
          }}
        >
          {t('export.copy')}
        </Button>
        <Button
          onClick={() => {
            onDownload?.('devtoolwidget-report.md', preview);
          }}
        >
          {t('export.download')}
        </Button>
        {copied && <span role="status">{t('export.copied')}</span>}
      </div>
    </section>
  );
}
