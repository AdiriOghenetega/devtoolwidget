import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r01FailedRequests } from './r01-failed-requests';

describe('R01 failed requests', () => {
  it('returns nothing for empty input', () => {
    expect(r01FailedRequests.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('ignores successful responses', () => {
    expect(
      r01FailedRequests.evaluate(
        aSnapshot().network({ url: 'https://a.test/ok', status: 200 }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('is a warning for a 4xx and critical for a 5xx or network error', () => {
    const client = r01FailedRequests.evaluate(
      aSnapshot().network({ url: 'https://a.test/404', status: 404 }).build(),
      DEFAULT_THRESHOLDS,
    );
    expect(client[0]?.severity).toBe('warning');

    const server = r01FailedRequests.evaluate(
      aSnapshot().network({ url: 'https://a.test/500', status: 500 }).build(),
      DEFAULT_THRESHOLDS,
    );
    expect(server[0]?.severity).toBe('critical');

    const network = r01FailedRequests.evaluate(
      aSnapshot().network({ url: 'https://a.test/x', status: null }).build(),
      DEFAULT_THRESHOLDS,
    );
    expect(network[0]?.severity).toBe('critical');
  });

  it('includes top offending URLs as evidence, capped', () => {
    let builder = aSnapshot();
    for (let index = 0; index < 8; index += 1) {
      builder = builder.network({ url: `https://a.test/${String(index)}`, status: 500 });
    }
    const evidence =
      r01FailedRequests.evaluate(builder.build(), DEFAULT_THRESHOLDS)[0]?.evidence ?? [];
    expect(evidence).toHaveLength(6);
    expect(evidence.at(-1)).toContain('more');
  });

  it('does not throw on partial entries', () => {
    const findings = r01FailedRequests.evaluate(
      aSnapshot().network({ url: '', status: 500, method: '' }).build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.actions).toEqual([{ type: 'hardReload' }]);
  });
});
