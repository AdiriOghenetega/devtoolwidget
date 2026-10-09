import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defaultExportRestrictedSyntax } from './tools/restricted-syntax.mjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '.wxt/**',
      '.output/**',
      'dist/**',
      'coverage/**',
      'tests/architecture/fixtures/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    // Bans every form of default export (see tools/restricted-syntax.mjs so the
    // lint test cannot drift from this config).
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...defaultExportRestrictedSyntax],
    },
  },
  {
    // WXT entrypoints must default-export their definition and may define an
    // empty lifecycle body. This is the documented exception to the ban above
    // (AGENTS.md section 3, ADR 0004).
    files: ['src/entrypoints/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  prettier,
);
