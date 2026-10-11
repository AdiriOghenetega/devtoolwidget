import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { aSnapshot, type NetworkEntry } from '../../core';
import { NetworkScreen } from './NetworkScreen';

const ROW_COUNT = 10_000;

function buildEntries(): readonly NetworkEntry[] {
  const builder = aSnapshot();
  for (let index = 0; index < ROW_COUNT; index += 1) {
    builder.network({
      url: `https://cdn.test/asset-${String(index)}.js`,
      status: 200,
      total: index % 50,
    });
  }
  return builder.build().network;
}

describe('NetworkScreen performance', () => {
  it(`renders ${String(ROW_COUNT)} rows with a small window`, () => {
    const entries = buildEntries();

    const start = performance.now();
    render(<NetworkScreen entries={entries} />);
    const elapsed = performance.now() - start;

    // Only the visible window (plus overscan) is in the DOM.
    expect(screen.getAllByRole('button').length).toBeLessThan(40);
    // Measured well under 100ms; kept generous to avoid CI flakiness.
    expect(elapsed).toBeLessThan(500);
  });
});
