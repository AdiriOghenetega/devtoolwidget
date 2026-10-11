// Size budgets.
//
// ADR 0006 said to enforce only bundles that exist and to add entries for the
// agent and UI when they land. ADR 0016 amended the background placeholder;
// ADR 0018 made the agent budget enforceable by removing Zod from the agent's
// reachable graph (hand-written bridge guards) and moving the settings schema to
// `protocol`.
//
// Measured, gzipped (2026-10-11): agent 14.34 kB, background 44.54 kB,
// content (bootstrap + deferred UI) 60.03 kB.
export default [
  {
    name: 'agent (main world)',
    path: '.output/chrome-mv3/agent.js',
    // PRD section 4 budget for the injected main-world agent. Enforced; the
    // dependency-cruiser rule 'agent-must-not-reach-runtime-zod' explains the
    // cause if this regresses.
    limit: '15 kB',
    gzip: true,
  },
  {
    name: 'background (MV3)',
    path: '.output/chrome-mv3/background.js',
    // Amended from the 40 kB placeholder by ADR 0016 (command handlers + clear
    // executors + report path). 50 kB leaves headroom without hiding growth.
    limit: '50 kB',
    gzip: true,
  },
  {
    name: 'content (bootstrap + deferred UI)',
    path: '.output/chrome-mv3/content-scripts/content.js',
    // TEMPORARY no-regression ratchet (lazy-mount PR): WXT inlines content-script
    // dynamic imports, so the UI is deferred in execution but not yet split into a
    // separate chunk; this one bundle currently measures 60.03 kB gz. The PRD
    // section 4 "content bootstrap <= 10 kB + lazy UI chunks <= 120 kB" budgets stay
    // open until the ESM lazy-chunk and Zod-removal decisions (see
    // docs/INTEGRATION-GAPS.md and ADR 0019). This 62 kB cap is the measured size
    // plus a small margin; it is expected to shrink and be replaced by the two
    // split budgets, not raised.
    limit: '62 kB',
    gzip: true,
  },
];
