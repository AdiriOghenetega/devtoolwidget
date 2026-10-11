import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../../core';
import { OptionsPage } from './OptionsPage';

function setup() {
  const onSave = vi.fn<(settings: Settings) => void>();
  const onDeleteAll = vi.fn();
  const onExport = vi.fn<(text: string) => void>();
  render(
    <OptionsPage
      settings={DEFAULT_SETTINGS}
      onSave={onSave}
      onDeleteAll={onDeleteAll}
      onExport={onExport}
    />,
  );
  return { onSave, onDeleteAll, onExport };
}

describe('OptionsPage', () => {
  it('shows a validation error and does not save invalid settings', () => {
    const { onSave } = setup();
    fireEvent.input(screen.getByLabelText('Max snapshots'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves valid settings', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('exports the settings as JSON', () => {
    const { onExport } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(JSON.parse(onExport.mock.calls[0]?.[0] ?? '{}')).toMatchObject({ schemaVersion: 1 });
  });

  it('imports and migrates settings, then saves them', () => {
    const { onSave } = setup();
    fireEvent.input(screen.getByLabelText('Paste settings JSON to import'), {
      target: { value: JSON.stringify({ capture: 'deep' }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ captureLevel: 'deep' });
  });

  it('deletes all data only after confirmation', () => {
    const { onDeleteAll } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete all stored data' }));
    expect(onDeleteAll).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onDeleteAll).toHaveBeenCalledTimes(1);
  });
});
