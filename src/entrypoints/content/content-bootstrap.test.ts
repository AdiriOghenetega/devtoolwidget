import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The `document_start` content bootstrap files must not statically import Preact
 * or any `ui` module: the shell, the signals-backed store and the panel are
 * dynamically imported on first interaction (ADR 0019). This complements the
 * dependency-cruiser rules with a direct, source-level check.
 */
const BOOTSTRAP_FILES = [
  'index.ts',
  'launcher.ts',
  'shell-persistence.ts',
  'panel-feed.ts',
  'widget-root.ts',
] as const;

const FORBIDDEN_STATIC_IMPORT =
  /from\s+['"](?:preact|preact\/[^'"]*|@preact\/signals|@preact\/signals\/[^'"]*|\.\.\/\.\.\/ui\/[^'"]*)['"]/;

describe('content bootstrap static imports (ADR 0019)', () => {
  it.each(BOOTSTRAP_FILES)('does not statically import Preact or ui from %s', (file) => {
    const source = readFileSync(resolve(import.meta.dirname, file), 'utf8');
    expect(source).not.toMatch(FORBIDDEN_STATIC_IMPORT);
  });

  it('imports the shell only through a dynamic import', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'index.ts'), 'utf8');
    expect(source).toMatch(/import\(\s*['"]\.\/lazy-shell['"]\s*\)/);
    expect(source).not.toMatch(/from\s+['"]\.\/lazy-shell['"]/);
  });
});
