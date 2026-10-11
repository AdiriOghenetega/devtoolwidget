import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';
import { moduleSizeReport } from './tools/vite-module-sizes.mjs';

// Diagnosis-only switches. They never change the default production build:
// - ANALYZE=1  -> emit bundle-analysis artifacts under `.output/analyze/`
//                 (used by tests/benchmarks/bundle-composition.mjs).
// - PROFILE=1  -> an unminified, source-mapped build under `.output-profile/`
//                 so the CPU profiler reports readable function names
//                 (used by tests/benchmarks/profile-content.mjs).
const analyzing = process.env.ANALYZE === '1';
const profiling = process.env.PROFILE === '1';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  ...(profiling ? { outDir: '.output-profile' } : {}),
  ...(analyzing
    ? {
        analysis: { enabled: true, keepArtifacts: true, outputFile: '.output/analyze/bundle.html' },
      }
    : {}),
  vite: () => ({
    plugins: [preact(), ...(analyzing ? [moduleSizeReport(resolve('.output', 'analyze'))] : [])],
    ...(profiling ? { build: { minify: false, sourcemap: true } } : {}),
  }),
  alias: {
    '@core': resolve('src/core'),
    '@protocol': resolve('src/protocol'),
    '@platform': resolve('src/platform'),
    '@capture': resolve('src/capture'),
    '@ui': resolve('src/ui'),
  },
  manifest: {
    name: 'devToolWidget',
    description: 'Diagnose and act, in one click.',
    permissions: [
      'storage',
      'tabs',
      'scripting',
      'activeTab',
      'browsingData',
      'declarativeNetRequest',
      'commands',
      'sidePanel',
    ],
    commands: {
      'toggle-panel': {
        suggested_key: { default: 'Ctrl+Shift+E' },
        description: 'Toggle devToolWidget panel',
      },
      'clear-site-data': { description: 'Clear site data' },
      'hard-reload': {
        suggested_key: { default: 'Ctrl+Shift+R' },
        description: 'Hard reload',
      },
    },
    // G12 / PRD 7: no required host access. The content and agent scripts are
    // registered per granted origin at runtime (SiteAccessService), so this is
    // the only host-permission surface. `http://*/*` and `https://*/*` let the
    // user grant any site discovered at runtime; match patterns ignore ports, so
    // one grant covers the whole host on any port (e.g. `http://localhost/*`).
    optional_host_permissions: ['http://*/*', 'https://*/*'],
  },
});
