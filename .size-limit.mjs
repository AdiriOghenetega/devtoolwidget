// Size budgets.
//
// ADR 0006 said to enforce only bundles that exist and to add entries for the
// agent and UI when they land. ADR 0016 amended the background placeholder;
// ADR 0018 made the agent budget enforceable by removing Zod from the agent's
// reachable graph (hand-written bridge guards) and moving the settings schema to
// `protocol`.
//
// Measured, gzipped (2026-10-11): agent 12.60 kB, background 43.23 kB,
// content (UI host) 56.15 kB.
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
    name: 'content (UI host)',
    path: '.output/chrome-mv3/content-scripts/content.js',
    // PRD section 4 lazy-loaded UI budget.
    limit: '120 kB',
    gzip: true,
  },
];
