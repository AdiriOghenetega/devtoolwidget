import { describe, expect, it } from 'vitest';
import { toMillis } from '../../domain/brands';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r12LongTasks } from './r12-long-tasks';

function withTask(duration: number) {
  return aSnapshot()
    .longTask({ startTime: toMillis(0), duration: toMillis(duration) })
    .build();
}

describe('R12 long tasks / total blocking time', () => {
  it('degrades to no findings when no long tasks were captured', () => {
    expect(r12LongTasks.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('rates at, just above the warning and critical thresholds', () => {
    expect(r12LongTasks.evaluate(withTask(350), DEFAULT_THRESHOLDS)).toEqual([]); // TBT 300
    expect(r12LongTasks.evaluate(withTask(400), DEFAULT_THRESHOLDS)[0]?.severity).toBe('warning');
    expect(r12LongTasks.evaluate(withTask(900), DEFAULT_THRESHOLDS)[0]?.severity).toBe('critical');
  });
});
