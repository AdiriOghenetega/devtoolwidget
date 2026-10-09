import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { defaultExportRestrictedSyntax } from '../../tools/restricted-syntax.mjs';

const linter = new Linter();

function restrictedSyntaxCount(code: string): number {
  const messages = linter.verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        },
        rules: {
          'no-restricted-syntax': ['error', ...defaultExportRestrictedSyntax],
        },
      },
    ],
    'probe.ts',
  );
  return messages.filter((message) => message.ruleId === 'no-restricted-syntax').length;
}

describe('default export ban (ADR 0004)', () => {
  it('flags `export default`', () => {
    expect(restrictedSyntaxCount('export default 1;')).toBeGreaterThan(0);
  });

  it('flags `export { value as default }`', () => {
    expect(restrictedSyntaxCount('const value = 1;\nexport { value as default };')).toBeGreaterThan(
      0,
    );
  });

  it('flags `export = value`', () => {
    expect(restrictedSyntaxCount('const value = 1;\nexport = value;')).toBeGreaterThan(0);
  });

  it('allows named exports', () => {
    expect(restrictedSyntaxCount('export const value = 1;')).toBe(0);
  });
});
