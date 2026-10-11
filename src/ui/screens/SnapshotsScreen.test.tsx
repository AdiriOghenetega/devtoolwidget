import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { toMillis, type SavedSnapshot } from '../../core';
import { SnapshotsScreen } from './SnapshotsScreen';

function snapshot(id: string, createdAt: number, metrics: Record<string, number>): SavedSnapshot {
  return { id, label: id, createdAt: toMillis(createdAt), metrics, findings: [] };
}

const snapshots = [snapshot('a', 1, { health: 60 }), snapshot('b', 2, { health: 80 })];

describe('SnapshotsScreen', () => {
  it('captures with a label', () => {
    const onCapture = vi.fn();
    render(<SnapshotsScreen snapshots={[]} onCapture={onCapture} onDelete={() => undefined} />);
    fireEvent.input(screen.getByLabelText('Label'), { target: { value: 'before fix' } });
    fireEvent.click(screen.getByRole('button', { name: 'Capture snapshot' }));
    expect(onCapture).toHaveBeenCalledWith('before fix');
  });

  it('lists snapshots and deletes one', () => {
    const onDelete = vi.fn();
    render(
      <SnapshotsScreen snapshots={snapshots} onCapture={() => undefined} onDelete={onDelete} />,
    );
    expect(screen.getByText(/a —/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0] as Element);
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('shows an empty state', () => {
    render(
      <SnapshotsScreen snapshots={[]} onCapture={() => undefined} onDelete={() => undefined} />,
    );
    expect(screen.getByText('No snapshots yet')).toBeTruthy();
  });

  it('compares two snapshots and shows the visual diff', () => {
    render(
      <SnapshotsScreen
        snapshots={snapshots}
        onCapture={() => undefined}
        onDelete={() => undefined}
      />,
    );
    fireEvent.click(screen.getByLabelText('a'));
    expect(screen.getByText('Select two snapshots to compare')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('b'));
    const region = screen.getByRole('region', { name: 'Compare' });
    expect(region.textContent).toContain('health');
    expect(region.textContent).toContain('▲');
  });

  it('reports no changes when the two snapshots match', () => {
    const same = [snapshot('a', 1, { health: 80 }), snapshot('b', 2, { health: 80 })];
    render(
      <SnapshotsScreen snapshots={same} onCapture={() => undefined} onDelete={() => undefined} />,
    );
    fireEvent.click(screen.getByLabelText('a'));
    fireEvent.click(screen.getByLabelText('b'));
    expect(screen.getByText('No changes between the two snapshots')).toBeTruthy();
  });
});
