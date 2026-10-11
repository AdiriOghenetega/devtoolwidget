/**
 * Bundle-composition diagnosis for the `document_start` content bundle.
 *
 * Builds with `ANALYZE=1` (the `moduleSizeReport` Vite plugin writes exact
 * post-tree-shake per-module rendered sizes), then groups the content chunk's
 * modules by family and reports raw and (estimated) gzipped shares, plus the
 * bundle's real raw/gzip size.
 *
 *   node tests/benchmarks/bundle-composition.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const ANALYZE_DIR = resolve(REPO_ROOT, '.output', 'analyze');
const CONTENT_BUNDLE = resolve(REPO_ROOT, '.output', 'chrome-mv3', 'content-scripts', 'content.js');

/** Maps a module path to a family bucket from the diagnosis brief. */
function familyOf(id) {
  const path = id.replaceAll('\\', '/');
  if (path.includes('/node_modules/zod/')) return 'zod';
  if (path.includes('/node_modules/preact/') || path.includes('/node_modules/@preact/')) {
    return 'preact';
  }
  if (path.includes('/src/protocol/')) return 'protocol';
  if (path.includes('/src/core/')) return 'core';
  if (path.includes('/src/platform/')) return 'platform';
  if (path.includes('/src/capture/')) return 'capture';
  if (path.includes('/src/ui/')) return 'ui';
  if (path.includes('/src/entrypoints/content/')) return 'bootstrap';
  return 'other';
}

function analyzeBuild() {
  execSync('pnpm build', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ANALYZE: '1' },
  });
}

function contentReport() {
  const file = readdirSync(ANALYZE_DIR).find((name) =>
    name.startsWith('modules-content-scripts_content.js'),
  );
  if (file === undefined) {
    throw new Error(`No module-size report in ${ANALYZE_DIR}; run with ANALYZE=1`);
  }
  return JSON.parse(readFileSync(resolve(ANALYZE_DIR, file), 'utf8'));
}

function main() {
  analyzeBuild();
  const report = contentReport();

  const families = new Map();
  let renderedTotal = 0;
  for (const [id, size] of Object.entries(report.modules)) {
    const family = familyOf(id);
    families.set(family, (families.get(family) ?? 0) + size);
    renderedTotal += size;
  }

  const raw = readFileSync(CONTENT_BUNDLE);
  const gzip = gzipSync(raw);
  const gzipRatio = gzip.length / raw.length;

  const rows = [...families.entries()]
    .map(([family, size]) => ({ family, size, share: size / renderedTotal }))
    .sort((a, b) => b.size - a.size);

  const pad = (value, width) => String(value).padEnd(width);
  const padStart = (value, width) => String(value).padStart(width);
  process.stdout.write(
    `content-scripts/content.js: ${String(raw.length)} B raw, ${String(gzip.length)} B gzipped\n` +
      `rendered module total (pre-minify, sums to the chunk): ${String(renderedTotal)} B\n` +
      `(chunk code after minify: ${String(report.code)} B)\n\n`,
  );
  process.stdout.write(
    `${pad('family', 12)}${padStart('rendered B', 12)}${padStart('share', 8)}  ${padStart('est. gz B', 11)}\n`,
  );
  for (const row of rows) {
    process.stdout.write(
      `${pad(row.family, 12)}${padStart(Math.round(row.size), 12)}` +
        `${padStart(`${(row.share * 100).toFixed(1)}%`, 8)}  ` +
        `${padStart(Math.round(row.share * gzip.length), 11)}\n`,
    );
  }
  process.stdout.write(
    `\n"est. gz B" = family share x the bundle's measured gzip size ` +
      `(ratio ${gzipRatio.toFixed(3)}); per-family gzip is not measured directly.\n`,
  );
}

main();
