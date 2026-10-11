import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r13ConsoleErrors } from './r13-console-errors';

describe('R13 console errors', () => {
  it('degrades to no findings with no console entries', () => {
    expect(r13ConsoleErrors.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('ignores non-error console entries', () => {
    expect(
      r13ConsoleErrors.evaluate(
        aSnapshot().console({ id: 'c', level: 'log' }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('groups errors by kind and level with counts and is critical for uncaught', () => {
    const findings = r13ConsoleErrors.evaluate(
      aSnapshot()
        .console({ id: 'c1', kind: 'uncaught', count: 2 })
        .console({ id: 'c2', level: 'error', count: 3 })
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.evidence.join(' ')).toContain('uncaught');
    expect(findings[0]?.evidence.join(' ')).toContain('×2');
  });
});
