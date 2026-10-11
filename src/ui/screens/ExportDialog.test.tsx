import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { aSnapshot, type ExportInput } from '../../core';
import { ExportDialog } from './ExportDialog';

function input(): ExportInput {
  return {
    environment: { url: 'https://api.test/app', userAgent: 'UA', extensionVersion: '0.0.0' },
    snapshot: aSnapshot().network({ url: 'https://api.test/x?token=SECRET', status: 200 }).build(),
    findings: [],
    healthScore: 90,
  };
}

describe('ExportDialog', () => {
  it('shows a redacted preview with the markdown section on by default', () => {
    render(<ExportDialog input={input()} />);
    const preview = screen.getByLabelText('Preview');
    expect(preview.textContent).toContain('# Bug report');
    expect(preview.textContent).not.toContain('SECRET');
  });

  it('toggles sections on and off', () => {
    render(<ExportDialog input={input()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'HAR' }));
    expect(screen.getByLabelText('Preview').textContent).toContain('"version": "1.2"');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Markdown report' }));
    expect(screen.getByLabelText('Preview').textContent).not.toContain('# Bug report');
  });

  it('copies the preview and offers a download', () => {
    const onCopy = vi.fn();
    const onDownload = vi.fn();
    render(<ExportDialog input={input()} onCopy={onCopy} onDownload={onDownload} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    expect(onCopy).toHaveBeenCalledWith(expect.stringContaining('# Bug report'));
    expect(screen.getByRole('status').textContent).toBe('Copied');

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledWith('devtoolwidget-report.md', expect.any(String));
  });
});
