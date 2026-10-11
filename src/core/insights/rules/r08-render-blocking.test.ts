import { describe, expect, it } from 'vitest';
import { toMillis } from '../../domain/brands';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r08RenderBlocking } from './r08-render-blocking';

const sample = (url: string, renderBlocking: boolean) => ({
  url,
  resourceType: 'stylesheet',
  transferSize: 100,
  decodedSize: 100,
  duration: toMillis(1),
  renderBlocking,
});

describe('R08 render-blocking resources', () => {
  it('degrades to no findings when resource data is unavailable', () => {
    expect(r08RenderBlocking.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('ignores resources that are not render-blocking', () => {
    expect(
      r08RenderBlocking.evaluate(
        aSnapshot()
          .resources([sample('a.css', false)])
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('flags render-blocking resources with URLs as evidence, capped', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      sample(`https://a.test/${String(index)}.css`, true),
    );
    const evidence =
      r08RenderBlocking.evaluate(aSnapshot().resources(many).build(), DEFAULT_THRESHOLDS)[0]
        ?.evidence ?? [];
    expect(evidence).toHaveLength(6);
    expect(evidence[0]).toContain('https://a.test/0.css');
  });
});
