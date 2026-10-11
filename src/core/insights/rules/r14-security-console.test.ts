import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r14SecurityConsole } from './r14-security-console';

describe('R14 security-related console issues', () => {
  it('degrades to no findings with no console entries', () => {
    expect(r14SecurityConsole.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('ignores ordinary console messages', () => {
    expect(
      r14SecurityConsole.evaluate(
        aSnapshot().console({ id: 'c', level: 'error' }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('flags CSP violations as a warning and failed loads as info', () => {
    const csp = r14SecurityConsole.evaluate(
      aSnapshot().console({ id: 'c1', kind: 'csp' }).build(),
      DEFAULT_THRESHOLDS,
    );
    expect(csp[0]?.severity).toBe('warning');
    expect(csp[0]?.evidence.join(' ')).toContain('csp');

    const resource = r14SecurityConsole.evaluate(
      aSnapshot().console({ id: 'r1', kind: 'resource' }).build(),
      DEFAULT_THRESHOLDS,
    );
    expect(resource[0]?.severity).toBe('info');
  });
});
