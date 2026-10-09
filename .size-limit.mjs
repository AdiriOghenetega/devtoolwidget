// Size budgets.
//
// SCAFFOLD PLACEHOLDER: only bundles that exist today are listed. PRD section 4
// assigns two budgets that are NOT yet enforced because those entrypoints do
// not exist yet:
//   - the injected main-world agent:   < 15 kB gzipped
//   - the lazy-loaded UI bundle:       < 120 kB gzipped
// Add one entry per bundle here (and enable `pnpm size` in CI, which already
// runs) as soon as the `agent` and `ui` entrypoints exist. Do not forget this:
// see docs/adr/0006-size-budgets-are-placeholders.md.
export default [
  {
    name: 'background (MV3)',
    path: '.output/chrome-mv3/background.js',
    limit: '40 kB',
    gzip: true,
  },
];
