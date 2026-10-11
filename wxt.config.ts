import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  vite: () => ({
    plugins: [preact()],
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
  },
});
