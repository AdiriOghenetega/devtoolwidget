import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Emits a per-module rendered-size report for every emitted chunk.
 *
 * `chunk.modules` is Rollup's final contribution map, so the values are the
 * post-tree-shake rendered length of each module in that chunk (pre-minify) and
 * sum to the chunk's rendered size. This is the exact attribution the bundle
 * composition report needs; the treemap analyzer reports pre-tree-shake module
 * sizes instead, which overstate the bundle. ANALYZE-gated (diagnosis only).
 *
 * @param {string} outputDir absolute directory to write the reports into
 * @returns {import('vite').Plugin}
 */
export function moduleSizeReport(outputDir) {
  return {
    name: 'devtoolwidget-module-sizes',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') {
          continue;
        }
        /** @type {Record<string, number>} */
        const modules = {};
        for (const [id, info] of Object.entries(file.modules ?? {})) {
          if (info == null) {
            continue;
          }
          modules[id] = (modules[id] ?? 0) + info.renderedLength;
        }
        const target = resolve(outputDir, `modules-${file.fileName.replaceAll('/', '_')}.json`);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(
          target,
          JSON.stringify({ chunk: file.fileName, code: file.code.length, modules }, null, 2),
        );
      }
    },
  };
}
