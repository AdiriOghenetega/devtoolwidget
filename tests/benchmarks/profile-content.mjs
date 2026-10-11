/**
 * CPU-profile diagnosis for the content-only ablation series.
 *
 * Builds an unminified, source-mapped bundle (`PROFILE=1` -> `.output-profile/`),
 * loads the fixture with only our content script registered, and profiles the
 * page load with the CDP `Profiler` domain. It reports, for **our content
 * script** only: total self time, the module-evaluation (top-level) inclusive
 * time, the top self-time frames inside it, and the Zod/schema-construction
 * share.
 *
 * The build is unminified so V8 reports readable function names; relative shares
 * are the signal, absolute times are not the production build.
 *
 *   node tests/benchmarks/profile-content.mjs
 */
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { startServer } from '../fixtures/bad-site/server.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const PROFILE_EXTENSION = resolve(REPO_ROOT, '.output-profile', 'chrome-mv3');
const PROFILE_RUNS = 3;
const CONTENT_FILE = 'content-scripts/content.js';
const CONTENT_ONLY = {
  id: 'devtoolwidget-content',
  js: [CONTENT_FILE],
  matches: ['<all_urls>'],
  runAt: 'document_start',
  persistAcrossSessions: false,
};

/** Functions that belong to Zod's schema construction/parsing internals. */
const ZOD_FRAME =
  /\$constructor|\$Zod|_zod|zod|defineBound|isRecursive|mergeDefs|getEnumValues|runChecks|handlePipeResult|normalizeParams|cloneSchema|initSchema/i;

function build() {
  execSync('pnpm build', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, PROFILE: '1' },
  });
}

/** Self and inclusive (subtree) microseconds per node id. */
function times(profile) {
  const nodeById = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let index = 0; index < samples.length; index += 1) {
    const id = samples[index];
    self.set(id, (self.get(id) ?? 0) + (deltas[index] ?? 0));
  }
  const inclusive = new Map();
  const visit = (id) => {
    const cached = inclusive.get(id);
    if (cached !== undefined) return cached;
    let total = self.get(id) ?? 0;
    for (const child of nodeById.get(id)?.children ?? []) total += visit(child);
    inclusive.set(id, total);
    return total;
  };
  for (const node of profile.nodes) visit(node.id);
  return { self, inclusive };
}

const isContentFrame = (frame) => (frame.url ?? '').endsWith(CONTENT_FILE);

async function main() {
  build();
  const server = await startServer(0);
  const userDataDir = mkdtempSync(join(tmpdir(), 'devtoolwidget-profile-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${PROFILE_EXTENSION}`,
      `--load-extension=${PROFILE_EXTENSION}`,
    ],
  });

  const merged = { contentSelf: 0, moduleEval: 0, zodSelf: 0, pageTotal: 0, taskMs: [] };
  const frameSelf = new Map();
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await worker.evaluate(async (script) => {
      await globalThis.chrome.scripting.registerContentScripts([script]);
    }, CONTENT_ONLY);

    for (let run = 0; run < PROFILE_RUNS + 1; run += 1) {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
      const before = await cdp.send('Performance.getMetrics');
      await cdp.send('Profiler.start');
      await page.goto(`${server.origin}/`);
      await page.waitForLoadState('load');
      const { profile } = await cdp.send('Profiler.stop');
      const after = await cdp.send('Performance.getMetrics');
      const metric = (result, name) => result.metrics.find((m) => m.name === name)?.value ?? 0;
      const taskMs = (metric(after, 'TaskDuration') - metric(before, 'TaskDuration')) * 1000;
      await page.close();
      if (run === 0) continue; // warm-up, not aggregated

      const { self, inclusive } = times(profile);
      let contentSelf = 0;
      let zodSelf = 0;
      for (const node of profile.nodes) {
        const frame = node.callFrame;
        if (!isContentFrame(frame)) continue;
        const value = self.get(node.id) ?? 0;
        contentSelf += value;
        if (ZOD_FRAME.test(frame.functionName)) zodSelf += value;
        const key = `${frame.functionName || '(anonymous)'}:${String(frame.lineNumber)}`;
        const existing = frameSelf.get(key) ?? {
          name: frame.functionName,
          line: frame.lineNumber,
          micros: 0,
        };
        existing.micros += value;
        frameSelf.set(key, existing);
      }
      // Module evaluation = inclusive time of the content script's top-level frame.
      const roots = profile.nodes.filter(
        (node) => isContentFrame(node.callFrame) && (node.callFrame.functionName ?? '') === '',
      );
      const moduleEval = roots.reduce((max, node) => Math.max(max, inclusive.get(node.id) ?? 0), 0);
      merged.contentSelf += contentSelf;
      merged.moduleEval += moduleEval;
      merged.zodSelf += zodSelf;
      merged.pageTotal += Object.values(Object.fromEntries(self)).reduce((a, b) => a + b, 0);
      merged.taskMs.push(taskMs);
    }

    const runs = PROFILE_RUNS;
    const frameList = [...frameSelf.values()].sort((a, b) => b.micros - a.micros);
    const ms = (micros) => (micros / 1000 / runs).toFixed(2);
    const pct = (micros, base) => `${((micros / base) * 100).toFixed(1)}%`;

    process.stdout.write(
      `\n[profile] runs=${runs} unminified PROFILE build; per-load values in ms\n` +
        `[profile] load TaskDuration (profiled): median ${median(merged.taskMs).toFixed(1)}ms\n` +
        `[profile] content.js self time: ${ms(merged.contentSelf)}ms/load\n` +
        `[profile] content.js module evaluation (top-level inclusive): ${ms(merged.moduleEval)}ms/load` +
        ` (${pct(merged.moduleEval, merged.contentSelf)} of content.js self time)\n` +
        `[profile] zod/schema-shaped self time: ${ms(merged.zodSelf)}ms/load` +
        ` (${pct(merged.zodSelf, merged.contentSelf)} of content.js self time,` +
        ` ${pct(merged.zodSelf, merged.moduleEval)} of module evaluation)\n\n` +
        `top self-time frames in content.js:\n`,
    );
    for (const frame of frameList.slice(0, 25)) {
      process.stdout.write(
        `  ${ms(frame.micros).padStart(7)}ms  ` +
          `${pct(frame.micros, merged.contentSelf).padStart(5)}  ` +
          `${(frame.name || '(anonymous)').slice(0, 40).padEnd(40)}  L${String(frame.line)}\n`,
      );
    }
  } finally {
    await context.close();
    await server.close();
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

await main();
