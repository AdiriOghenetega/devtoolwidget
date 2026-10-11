import { describe, expect, it } from 'vitest';
import { toBytes, toMillis } from '../domain/brands';
import { aSnapshot } from './builders';
import { ALL_INSIGHT_RULES } from './rules';
import { runInsights } from './runner';

function rules(input: ReturnType<typeof aSnapshot>): readonly string[] {
  return runInsights(input.build(), { rules: ALL_INSIGHT_RULES }).findings.map((f) => f.ruleId);
}

describe('R01 failed requests', () => {
  it('is critical for 5xx and warning for 4xx', () => {
    expect(
      rules(
        aSnapshot()
          .network({ url: 'https://a.test/500', status: 500 })
          .network({ url: 'https://a.test/404', status: 404 }),
      ),
    ).toEqual(['R01', 'R01']);
    const severities = runInsights(
      aSnapshot()
        .network({ url: 'https://a.test/500', status: 500 })
        .network({ url: 'https://a.test/404', status: 404 })
        .build(),
      { rules: ALL_INSIGHT_RULES },
    ).findings.map((f) => f.severity);
    expect(severities).toEqual(['critical', 'warning']);
  });

  it('ignores 2xx', () => {
    expect(rules(aSnapshot().network({ url: 'https://a.test/ok', status: 200 }))).toEqual([]);
  });
});

describe('R02 slow requests', () => {
  it('flags total over 1s', () => {
    expect(rules(aSnapshot().network({ url: 'https://a.test/slow', total: 1_500 }))).toContain(
      'R02',
    );
    expect(rules(aSnapshot().network({ url: 'https://a.test/ok', total: 100 }))).not.toContain(
      'R02',
    );
  });
});

describe('R03 large payloads', () => {
  it('uses the media and non-media limits', () => {
    expect(
      rules(aSnapshot().network({ url: 'https://a.test/big.js', transferSize: 600_000 })),
    ).toContain('R03');
    expect(
      rules(
        aSnapshot().network({
          url: 'https://a.test/big.png',
          resourceType: 'image',
          transferSize: 600_000,
        }),
      ),
    ).not.toContain('R03');
    expect(
      rules(
        aSnapshot().network({
          url: 'https://a.test/huge.png',
          resourceType: 'image',
          transferSize: 2_000_000,
        }),
      ),
    ).toContain('R03');
  });
});

describe('R06 duplicate requests', () => {
  it('flags the same method and URL repeated', () => {
    expect(
      rules(aSnapshot().network({ url: 'https://a.test/x' }).network({ url: 'https://a.test/x' })),
    ).toContain('R06');
  });
});

describe('R07 request volume', () => {
  it('flags too many requests and too many origins', () => {
    const many = aSnapshot();
    for (let index = 0; index < 101; index += 1) {
      many.network({ url: `https://a.test/${String(index)}` });
    }
    expect(rules(many)).toContain('R07');

    const origins = aSnapshot();
    for (let index = 0; index < 16; index += 1) {
      origins.network({ url: `https://c${String(index)}.test/x` });
    }
    expect(rules(origins)).toContain('R07');
  });
});

describe('R09/R10/R11 vitals', () => {
  it('rates LCP, CLS and INP by threshold', () => {
    expect(rules(aSnapshot().vital({ name: 'LCP', value: 5_000, rating: 'poor' }))).toContain(
      'R09',
    );
    expect(rules(aSnapshot().vital({ name: 'LCP', value: 1_800, rating: 'good' }))).not.toContain(
      'R09',
    );
    expect(rules(aSnapshot().vital({ name: 'CLS', value: 0.3, rating: 'poor' }))).toContain('R10');
    expect(
      rules(aSnapshot().vital({ name: 'INP', value: 300, rating: 'needs-improvement' })),
    ).toContain('R11');
  });
});

describe('R12 total blocking time', () => {
  it('rates by the TBT thresholds', () => {
    expect(
      rules(aSnapshot().longTask({ startTime: toMillis(0), duration: toMillis(120) })),
    ).not.toContain('R12');
    expect(
      rules(aSnapshot().longTask({ startTime: toMillis(0), duration: toMillis(500) })),
    ).toContain('R12');
  });
});

describe('R13 console errors', () => {
  it('is critical for uncaught and warning for console errors', () => {
    expect(rules(aSnapshot().console({ id: 'c1', kind: 'uncaught' }))).toContain('R13');
    expect(rules(aSnapshot().console({ id: 'c2', level: 'error' }))).toContain('R13');
    expect(rules(aSnapshot().console({ id: 'c3', level: 'log' }))).not.toContain('R13');
  });
});

describe('R17 storage bloat', () => {
  it('flags oversized areas', () => {
    expect(
      rules(
        aSnapshot().storage([
          { area: 'localStorage', count: 1, approximateSize: toBytes(6_000_000) },
        ]),
      ),
    ).toContain('R17');
  });
});
