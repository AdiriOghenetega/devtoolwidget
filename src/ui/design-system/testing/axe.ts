import axe from 'axe-core';

/**
 * Runs axe-core against a container and returns its violations. Some rules that
 * require a full page (e.g. `region`) are disabled so primitives can be tested in
 * isolation.
 */
export async function axeViolations(container: Element): Promise<axe.Result[]> {
  const results = await axe.run(container, {
    rules: {
      region: { enabled: false },
      'page-has-heading-one': { enabled: false },
      'landmark-one-main': { enabled: false },
    },
  });
  return results.violations;
}
