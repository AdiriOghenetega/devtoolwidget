import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r06DuplicateRequests } from './r06-duplicate-requests';

const WINDOW = Number(DEFAULT_THRESHOLDS.duplicateRequestWindow);

describe('R06 duplicate requests', () => {
  it('returns nothing for empty input', () => {
    expect(r06DuplicateRequests.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('flags a repeat within the window and not just outside it', () => {
    const inside = r06DuplicateRequests.evaluate(
      aSnapshot()
        .network({ url: 'https://a.test/x', startedAt: 0 })
        .network({ url: 'https://a.test/x', startedAt: WINDOW })
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(inside).toHaveLength(1);

    const outside = r06DuplicateRequests.evaluate(
      aSnapshot()
        .network({ url: 'https://a.test/x', startedAt: 0 })
        .network({ url: 'https://a.test/x', startedAt: WINDOW + 1 })
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(outside).toEqual([]);
  });

  it('distinguishes by method', () => {
    expect(
      r06DuplicateRequests.evaluate(
        aSnapshot()
          .network({ url: 'https://a.test/x', method: 'GET', startedAt: 0 })
          .network({ url: 'https://a.test/x', method: 'POST', startedAt: 0 })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('treats repeats without timestamps as duplicates (partial entries)', () => {
    expect(
      r06DuplicateRequests.evaluate(
        aSnapshot()
          .network({ url: 'https://a.test/x' })
          .network({ url: 'https://a.test/x' })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toHaveLength(1);
  });
});
