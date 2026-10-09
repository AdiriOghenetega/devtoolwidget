/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-other-layers',
      severity: 'error',
      comment: 'core is pure TypeScript and imports nothing from the other layers (PRD 8.2).',
      from: { path: 'src/core/' },
      to: { path: 'src/(protocol|platform|capture|ui|entrypoints)/' },
    },
    {
      name: 'protocol-must-not-import-other-layers',
      severity: 'error',
      comment: 'protocol imports nothing from the other layers (PRD 8.2).',
      from: { path: 'src/protocol/' },
      to: { path: 'src/(core|platform|capture|ui|entrypoints)/' },
    },
    {
      name: 'platform-may-only-import-core-and-protocol',
      severity: 'error',
      comment: 'platform may import core and protocol only (PRD 8.2).',
      from: { path: 'src/platform/' },
      to: { path: 'src/(capture|ui|entrypoints)/' },
    },
    {
      name: 'ui-may-only-import-core-and-protocol',
      severity: 'error',
      comment: 'ui may import core and protocol only (PRD 8.2).',
      from: { path: 'src/ui/' },
      to: { path: 'src/(platform|capture|entrypoints)/' },
    },
    {
      name: 'capture-must-not-import-ui-or-entrypoints',
      severity: 'error',
      comment: 'capture must not import ui or entrypoints (PRD 8.2, ADR 0003).',
      from: { path: 'src/capture/' },
      to: { path: 'src/(ui|entrypoints)/' },
    },
    {
      name: 'capture-must-not-import-platform-adapters',
      severity: 'error',
      comment:
        'capture must never import the chrome/firefox adapters, not even from tests (PRD 8.2, ADR 0003).',
      from: { path: 'src/capture/' },
      to: { path: 'src/platform/(chrome|firefox)/' },
    },
    {
      name: 'capture-must-not-import-platform-outside-ports-and-fakes',
      severity: 'error',
      comment:
        'capture may import platform port interfaces only; the platform barrel and any other platform file are forbidden (PRD 8.2, ADR 0003).',
      from: { path: 'src/capture/' },
      to: { path: 'src/platform/(?!ports/|fakes/|chrome/|firefox/)' },
    },
    {
      name: 'capture-must-not-import-platform-fakes-outside-tests',
      severity: 'error',
      comment:
        'capture may use the in-memory platform fakes only from colocated tests; production code must depend on ports (PRD 8.2, AGENTS.md section 2, ADR 0003).',
      from: { path: 'src/capture/', pathNot: '\\.test\\.(ts|tsx)$' },
      to: { path: 'src/platform/fakes/' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|\\.wxt|\\.output|dist|coverage)/' },
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
