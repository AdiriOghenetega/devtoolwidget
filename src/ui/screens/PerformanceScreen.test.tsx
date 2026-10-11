import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { aSnapshot, toMillis } from '../../core';
import { PerformanceScreen } from './PerformanceScreen';

describe('PerformanceScreen', () => {
  it('shows an empty state', () => {
    render(<PerformanceScreen vitals={[]} longTasks={[]} />);
    expect(screen.getByText('No performance data')).toBeTruthy();
  });

  it('shows vitals with their ratings', () => {
    const snapshot = aSnapshot()
      .vital({ name: 'LCP', value: 1_800, rating: 'good' })
      .vital({ name: 'CLS', value: 0.2, rating: 'needs-improvement' })
      .vital({ name: 'INP', value: 700, rating: 'poor' })
      .build();
    render(<PerformanceScreen vitals={snapshot.vitals} longTasks={[]} />);
    expect(screen.getByText('Good')).toBeTruthy();
    expect(screen.getByText('Needs improvement')).toBeTruthy();
    expect(screen.getByText('Poor')).toBeTruthy();
  });

  it('renders the long-task timeline', () => {
    render(
      <PerformanceScreen
        vitals={[]}
        longTasks={[{ startTime: toMillis(0), duration: toMillis(120) }]}
      />,
    );
    expect(screen.getByTitle('120 ms')).toBeTruthy();
  });

  it('summarizes resources', () => {
    render(
      <PerformanceScreen
        vitals={[]}
        longTasks={[]}
        resources={[
          {
            url: 'a.js',
            resourceType: 'script',
            transferSize: 100,
            decodedSize: 200,
            duration: toMillis(1),
            renderBlocking: true,
          },
        ]}
      />,
    );
    expect(screen.getByText('Requests')).toBeTruthy();
    expect(screen.getByText('Render-blocking')).toBeTruthy();
  });
});
