import { describe, expect, it } from 'vitest';
import { toBytes } from '../../domain/brands';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r17StorageBloat } from './r17-storage-bloat';

describe('R17 storage bloat', () => {
  it('degrades to no findings when no storage was summarised', () => {
    expect(r17StorageBloat.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('rates at and just above the cookies limit', () => {
    const run = (size: number) =>
      r17StorageBloat.evaluate(
        aSnapshot()
          .storage([{ area: 'cookies', count: 1, approximateSize: toBytes(size) }])
          .build(),
        DEFAULT_THRESHOLDS,
      );
    expect(run(4_096)).toEqual([]);
    expect(run(4_097)).toHaveLength(1);
  });

  it('flags localStorage over 5 MB with a clear-storage action', () => {
    const findings = r17StorageBloat.evaluate(
      aSnapshot()
        .storage([
          { area: 'localStorage', count: 10, approximateSize: toBytes(5 * 1024 * 1024 + 1) },
        ])
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.actions).toEqual([{ type: 'clearStorage', preset: 'fresh-visitor' }]);
  });
});
