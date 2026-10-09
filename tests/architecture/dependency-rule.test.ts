import { cruise, type ICruiseResult } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import { describe, expect, it } from 'vitest';

const CONFIG_FILE = './.dependency-cruiser.cjs';
const FIXTURE_ROOT = 'tests/architecture/fixtures/dependency-rule/src';
const CAPTURE_TEST_IMPORTS_ROOT = 'tests/architecture/fixtures/capture-test-imports/src';
const CAPTURE_NONTEST_IMPORTS_ROOT = 'tests/architecture/fixtures/capture-nontest-imports/src';
const CORE_IMPORTS_PROTOCOL_ROOT = 'tests/architecture/fixtures/core-imports-protocol/src';
const PROTOCOL_IMPORTS_PLATFORM_ROOT = 'tests/architecture/fixtures/protocol-imports-platform/src';
const PROTOCOL_IMPORTS_CORE_ROOT = 'tests/architecture/fixtures/protocol-imports-core/src';
const SOURCE_ROOT = 'src';

async function cruiseWithProjectRules(root: string): Promise<ICruiseResult> {
  const options = await extractDepcruiseOptions(CONFIG_FILE);
  const { output } = await cruise([root], options);
  if (typeof output === 'string') {
    throw new Error('Expected a structured cruise result but received text output.');
  }
  return output;
}

function violatedRuleNames(result: ICruiseResult): string[] {
  return result.modules.flatMap((cruisedModule) =>
    cruisedModule.dependencies.flatMap((dependency) =>
      (dependency.rules ?? []).map((rule) => rule.name),
    ),
  );
}

describe('dependency rule (PRD 8.2)', () => {
  it('detects a core module that imports ui', async () => {
    const result = await cruiseWithProjectRules(FIXTURE_ROOT);
    expect(result.summary.error).toBeGreaterThan(0);
    expect(violatedRuleNames(result)).toContain('core-must-not-import-other-layers');
  });

  it('reports no violations for the real source tree', async () => {
    const result = await cruiseWithProjectRules(SOURCE_ROOT);
    expect(violatedRuleNames(result)).toEqual([]);
  });
});

describe('protocol dependency rules (PRD 8.2, ADR 0009)', () => {
  it('forbids core from importing protocol', async () => {
    const result = await cruiseWithProjectRules(CORE_IMPORTS_PROTOCOL_ROOT);
    expect(violatedRuleNames(result)).toContain('core-must-not-import-other-layers');
  });

  it('forbids protocol from importing platform', async () => {
    const result = await cruiseWithProjectRules(PROTOCOL_IMPORTS_PLATFORM_ROOT);
    expect(violatedRuleNames(result)).toContain('protocol-may-only-import-core');
  });

  it('allows protocol to import core', async () => {
    const result = await cruiseWithProjectRules(PROTOCOL_IMPORTS_CORE_ROOT);
    expect(violatedRuleNames(result)).toEqual([]);
  });
});

describe('capture platform import rules (PRD 8.2, ADR 0003)', () => {
  it('allows a colocated capture test to import platform fakes', async () => {
    const result = await cruiseWithProjectRules(CAPTURE_TEST_IMPORTS_ROOT);
    expect(violatedRuleNames(result)).not.toContain(
      'capture-must-not-import-platform-fakes-outside-tests',
    );
  });

  it('forbids a colocated capture test from importing platform chrome adapters', async () => {
    const result = await cruiseWithProjectRules(CAPTURE_TEST_IMPORTS_ROOT);
    expect(violatedRuleNames(result)).toContain('capture-must-not-import-platform-adapters');
  });

  it('forbids non-test capture code from importing platform fakes', async () => {
    const result = await cruiseWithProjectRules(CAPTURE_NONTEST_IMPORTS_ROOT);
    expect(violatedRuleNames(result)).toContain(
      'capture-must-not-import-platform-fakes-outside-tests',
    );
  });
});
