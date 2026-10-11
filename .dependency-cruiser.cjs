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
      name: 'protocol-may-only-import-core',
      severity: 'error',
      comment:
        'protocol may import core only; platform, capture, ui and entrypoints are forbidden (PRD 8.2, ADR 0009).',
      from: { path: 'src/protocol/' },
      to: { path: 'src/(platform|capture|ui|entrypoints)/' },
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
    {
      name: 'agent-must-not-import-runtime-zod-modules',
      severity: 'error',
      comment:
        'The agent entrypoint and the bridge must not import a Zod-backed protocol module at runtime (type-only imports are allowed), so the injected main-world agent stays under its 15 kB bundle budget (AGENTS.md section 6, ADR 0018). A `reachable` rule cannot target npm `zod` because `doNotFollow: node_modules` keeps it out of the graph, and it also matches type-only edges, so this direct runtime-only ban plus the `agent (main world)` size gate are the enforceable pair.',
      from: { path: '^(src/entrypoints/agent/|src/capture/bridge/)' },
      to: {
        path: '^src/protocol/(payloads|messages|parse|errors|settings|bridge)\\.ts$',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'document-start-content-must-not-statically-import-ui',
      severity: 'error',
      comment:
        'The document_start content bootstrap must not statically import src/ui; the Preact shell and its signals-backed store are dynamically imported on first interaction so no UI is loaded before it is needed (ADR 0019). Only the dynamic boundary (lazy-shell.ts) may import ui. `lazy-shell.ts` is excluded via pathNot.',
      from: { path: 'src/entrypoints/content/', pathNot: 'lazy-shell\\.ts$' },
      to: { path: 'src/ui/', dependencyTypesNot: ['dynamic-import'] },
    },
    {
      name: 'document-start-content-must-not-statically-import-preact',
      severity: 'error',
      comment:
        'The document_start content bootstrap must not statically import Preact or @preact/signals; they belong to the lazily imported UI chunk (ADR 0019). Type-only imports are allowed; dynamic imports from lazy-shell.ts are excluded.',
      from: { path: 'src/entrypoints/content/', pathNot: 'lazy-shell\\.ts$' },
      to: {
        path: 'node_modules/(preact|@preact/signals)/',
        dependencyTypesNot: ['dynamic-import', 'type-only'],
      },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|\\.wxt|\\.output|dist|coverage)/' },
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
