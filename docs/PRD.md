1. Vision
devtoolwidget is an open-source browser extension that gives developers one always-available, glanceable panel that answers: what is wrong with this page right now, and what can I do about it? It removes the tab-hopping and repetitive clicking that browser DevTools requires, and it adds something DevTools does not: ranked, plain-language findings with one-click fixes.
Tagline: Diagnose and act, in one click.
2. Problem and landscape
Problems
• Context switching: to understand one slow or broken page, a developer visits Console, Network, Application and Performance separately.
• Repetitive actions: clearing site data, disabling cache, throttling the network and hard reloading each take several clicks, many times per day.
• Data without synthesis: DevTools shows everything and ranks nothing. Beginners and busy developers miss the one thing that matters.
Existing tools (researched October 2026)
• Many clear-cache and clear-site-data extensions exist. They provide action without diagnosis.
• Google's Web Vitals extension provides a HUD overlay for Core Web Vitals only, and the Chrome team is moving that capability into the DevTools Performance panel.
• Eruda-based overlays such as Mobile DevTools shrink DevTools into an overlay. They copy the tabs instead of synthesizing them.
Gap: nobody combines live diagnosis, ranked findings and one-click remediation in a single widget. That combination is devtoolwidget's differentiator. Do not build DevTools-lite; build the summary layer on top.
3. Goals and non-goals
Goals
• G1. One glance shows page health: a score, the top findings and live counters.
• G2. Every finding carries a suggested fix and, where possible, a one-click action.
• G3. Common chores (clear site data, disable cache, throttle, reload) take one click or one shortcut.
• G4. Privacy-first: all data stays on the device, sensitive values are redacted by default.
• G5. Negligible overhead: the extension must never become the bottleneck it reports.
• G6. Production-grade engineering: strict types, modular layers, comprehensive tests, welcoming open-source hygiene.
Non-goals
• Replacing DevTools, DOM or CSS inspection, source debugging, or CPU flame charts.
• Session replay, analytics, user tracking or any remote data collection.
• Native mobile app debugging (web pages only).
• Remote or server-side monitoring (this is a local developer tool).
4. Success metrics
Engineering (must hit)
• TypeScript strict mode with zero any and zero type errors.
• Line coverage of at least 90% in src/core, at least 80% overall.
• Injected agent under 15 KB gzipped; lazy-loaded UI under 120 KB gzipped.
• Added main-thread cost during page load under 50 ms on a mid-range laptop (measured by the benchmark in Prompt 8.2).
• Zero critical or serious axe violations in the UI.
Adoption (aspirational, do not let them drive scope)
• Year-one stretch: 300 weekly active users, 500 GitHub stars, 10 external contributors, 4.5 store rating.
5. Personas and user stories
• P1 Frontend developer: uses the tool daily while building features.
• P2 QA engineer or tester: needs fast clean-state resets and shareable bug reports.
• P3 Full-stack or mobile developer: tests web views and APIs occasionally and wants quick answers.
• P4 Learner: finds DevTools overwhelming and benefits from plain-language explanations.
Core user stories
• US-01. As a developer, I see a health badge on my page and open a panel with one click or shortcut.
• US-02. As a developer, I see the three most important problems on the current page with the evidence behind each.
• US-03. As a tester, I click one button to clear cookies, local storage, session storage, IndexedDB and cache for this site, then reload.
• US-04. As a developer, I keep my auth token while clearing everything else, using a per-site keep list.
• US-05. As a developer, I filter console output and see duplicate errors collapsed with a count.
• US-06. As a developer, I see the slowest requests, failed requests and oversized payloads ranked.
• US-07. As a developer, I throttle the network to Slow 3G for this tab with one click.
• US-08. As a developer, I snapshot the page before a deploy and compare after to see regressions.
• US-09. As a tester, I export a redacted bug report (markdown, JSON and HAR subset) to attach to a ticket.
• US-10. As a privacy-conscious user, I grant access per site and can see exactly what the extension stores.
6. Functional requirements
IDs are stable; reference them in prompts, tests and commit messages.
FR-1 Widget shell
• Floating launcher: draggable, snaps to screen edges, position persisted per site.
• Expands to a panel with display modes: overlay (default, docked left, right or bottom, or floating) and Chrome side panel mode where supported.
• Minimized state shows a health badge (score and error count).
• Rendered inside a Shadow DOM so page CSS cannot affect it and it cannot affect the page.
• Themes: light, dark, system. Reduced-motion and high-contrast support.
• Top frame only by default. Per-site enable or disable. Never blocks page interaction outside its own bounds.
FR-2 Overview screen
• Health score 0 to 100 with a breakdown by category (network, performance, console, storage).
• Top three findings, each with evidence, suggested fix and action buttons.
• Live counters: console errors, failed requests, slow requests, total transfer size.
• Quick-actions bar: clear site data, hard reload, toggle disable-cache, throttle selector, export report.
FR-3 Console capture
• Levels: log, info, warn, error, debug, trace. Also uncaught errors, unhandled rejections, CSP violations and failed resource loads.
• Safe serialization of arguments: circular references, DOM nodes, errors with stacks, large objects (depth and size caps).
• Duplicate collapsing with a count, level and text filters, search, preserve-log toggle across navigations.
• Ring buffer with a configurable cap (default 1000 entries).
FR-4 Network capture
• Method, URL, status, type, initiator, transfer size, decoded size, cache hit, redirects and failure reason.
• Timing phases: DNS, connect, TLS, TTFB, download, from Resource Timing and fetch or XHR instrumentation.
• Headers and body previews are opt-in, size-capped and redacted.
• Mini waterfall, grouping by host or type, copy as cURL or fetch, HAR subset export.
FR-5 Performance capture
• LCP, CLS, INP, FCP, TTFB with attribution (element, shifted nodes, slow interaction target).
• Long tasks and long animation frames, total blocking time estimate.
• Resource summary, render-blocking resources, oversized images, memory trend where the browser exposes it.
FR-6 Storage and cache actions
• Inspect counts and approximate sizes for cookies, localStorage, sessionStorage, IndexedDB, Cache Storage and service workers.
• Clear any combination for the current origin. Presets: Fresh visitor, Clear everything and reload.
• Per-site keep list (keys or cookie names that survive clearing). Destructive actions require confirmation. Optional auto-clear on page load per site (off by default).
• HTTP cache clearing: verify against current chrome.browsingData docs how far it can be scoped to one origin and document the limitation in the UI.
FR-7 Network conditions
• Standard mode: disable-cache toggle for the tab (via declarativeNetRequest session rules scoped to the tab) and approximate latency simulation for fetch and XHR only, clearly labelled approximate.
• Deep mode: true network throttling (Offline, Slow 3G, Fast 3G, 4G, custom) and CPU throttling via the Chrome DevTools Protocol.
FR-8 Insights engine (specified in section 10)
FR-9 Snapshots and comparison
• Capture a labelled snapshot of metrics and findings (cap of 20, stored locally).
• Compare any two snapshots: metric deltas, new findings, resolved findings.
FR-10 Export and share
• One-click bug report bundle: markdown summary, JSON data, HAR subset. Redaction applied before anything leaves the extension. Copy to clipboard or download.
FR-11 Settings and profiles
• Per-origin profiles (host patterns), capture level, editable insight thresholds, redaction rules, retention, import and export of settings.
FR-12 Deep mode (optional)
• Uses chrome.debugger for accurate headers, bodies and timings, plus throttling.
• Requested as an optional permission only when the user turns Deep mode on, with a clear explanation of the browser's debugging banner.
• Detects when real DevTools is open on the tab, warns about conflicts, and always detaches cleanly.
FR-13 Keyboard and accessibility
• Global shortcuts via the commands API (toggle panel, clear site data, hard reload). Full keyboard navigation, screen reader labels, focus management, WCAG 2.2 AA.
FR-14 Onboarding
• First-run tour, plain-language explanation of every permission, and a visible data-handling statement.
FR-15 Browser support
• Chromium (Chrome, Edge, Brave) first. Firefox build via WXT with feature detection. Deep mode is Chromium-only.
7. Non-functional requirements
Performance
• The document_start footprint must be tiny: a minimal bootstrap injects the main-world agent, and the UI is lazy-loaded only when the panel is first opened.
• Idle overhead under 2% of main-thread time. Memory cap of 50 MB for all buffers. Event batching every 100 ms.
Privacy
• No network calls made by the extension itself. No telemetry in v1.0.
• Default redaction of Authorization, Cookie, Set-Cookie, API-key-like headers, query-string tokens and JWT-shaped strings. Body capture off by default.
• All stored data is deletable from Settings in one click.
Security
• Manifest V3, strict extension CSP, no eval, no remotely hosted code.
• Page scripts can listen to window.postMessage. The agent-to-content-script bridge must therefore use a one-time MessageChannel port handed over during a handshake, never a plain postMessage stream. Treat everything arriving from the main world as untrusted and validate it with Zod.
• Minimal permissions: storage, scripting, activeTab, browsingData, declarativeNetRequest, commands. Use optional permissions for host access (per site) and debugger. Write a justification for each permission for store review.
Accessibility and i18n
• WCAG 2.2 AA. All user-facing strings go through an i18n layer; English at launch.
Compatibility and reliability
• Latest stable Chrome plus the two previous versions.
• The MV3 service worker is ephemeral: persist session state in chrome.storage.session or IndexedDB, and handle extension reloads and invalidated contexts without throwing.
8. Architecture
8.1 Runtime contexts
1. Service worker (background): orchestration, per-tab session registry, browsingData, declarativeNetRequest, debugger, commands, settings persistence.
2. Content script (isolated world, document_start): secure bridge, hosts the widget root, injects the main-world agent.
3. Main-world agent (injected via chrome.scripting.executeScript with world MAIN): patches console, fetch, XHR and error handlers, runs PerformanceObservers. Injection this way is not blocked by page CSP.
4. Widget UI (Preact in Shadow DOM): lazy-loaded presentation layer.
5. Options page and side panel: reuse the same UI package.
8.2 Layered design (hexagonal)
• core is pure TypeScript with no browser APIs: domain types, insights engine, scoring, redaction, ring buffer, formatters, HAR builder, diffing.
• protocol holds message types and Zod schemas plus a typed channel abstraction with versioning.
• platform defines ports (interfaces) for storage, tabs, browsingData, scripting, debugger, clock, and provides real adapters plus in-memory fakes for tests.
• capture holds collectors (console, network, performance) that depend only on core, protocol and the platform ports (interfaces).
• ui holds components, signal-based stores and screens. It depends on core and protocol only.
• entrypoints (WXT) wires everything together and contains no business logic.
Dependency rule: entrypoints may import anything; platform, ui and capture may import core and protocol; capture may additionally import the platform ports (interfaces) but never the platform adapters (chrome/firefox) or the in-memory fakes (tests may import the fakes); core and protocol import nothing from the other layers. Enforce this in CI with dependency-cruiser or eslint-plugin-boundaries.
8.3 Folder structure
devtoolwidget/
  docs/            PRD.md, ARCHITECTURE.md, adr/
  src/
    core/          domain, insights, scoring, redaction, buffers, har, diff
    protocol/      messages, schemas, channel, version
    platform/      ports/, chrome/ adapters, firefox/ shims, fakes/
    capture/       console/, network/, performance/, pipeline/
    ui/            design-system/, components/, screens/, state/, i18n/
    entrypoints/   background/, content/, agent/, options/, sidepanel/
  tests/           e2e/, fixtures/bad-site/, benchmarks/
  AGENTS.md        rules for AI assistants
8.4 Data flow
Page events, then main-world agent, then batched events over the secure port, then content script, then service worker session store (per tab), then widget UI via a long-lived port. Actions flow in reverse: UI sends a typed command, the service worker executes it through a platform port, and replies with a typed result.
8.5 Messaging and state
• Every message has a type, a schema version, a correlation ID and a Zod schema. Commands return typed Result values; expected failures never throw.
• UI state lives in signal stores per domain with derived selectors. Settings are persisted through the storage port with a schema version and explicit migrations.
9. Domain model (starting point)
type Millis = number & { readonly __brand: 'Millis' };
type TabId = number & { readonly __brand: 'TabId' };

type ConsoleKind = 'console' | 'uncaught' | 'rejection' | 'csp' | 'resource';
type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';

interface ConsoleEntry {
  readonly id: string;
  readonly kind: ConsoleKind;
  readonly level: ConsoleLevel;
  readonly timestamp: Millis;
  readonly args: readonly SerializedValue[];
  readonly stack?: string;
  readonly count: number;
}

interface NetworkTiming {
  readonly dns: Millis; readonly connect: Millis; readonly tls: Millis;
  readonly ttfb: Millis; readonly download: Millis; readonly total: Millis;
}

interface NetworkEntry {
  readonly id: string;
  readonly method: string;
  readonly url: string;
  readonly status: number | null;
  readonly resourceType: string;
  readonly transferSize: number;
  readonly decodedSize: number;
  readonly fromCache: boolean;
  readonly timing: NetworkTiming;
  readonly failure?: string;
  readonly headers?: RedactedHeaders;
}

type Severity = 'critical' | 'warning' | 'info';

interface Finding {
  readonly id: string;
  readonly ruleId: string;
  readonly severity: Severity;
  readonly category: 'network' | 'performance' | 'console' | 'storage';
  readonly title: string;
  readonly evidence: readonly string[];
  readonly suggestion: string;
  readonly docsUrl?: string;
  readonly actions: readonly ActionRef[];
}

interface InsightRule {
  readonly id: string;
  readonly category: Finding['category'];
  evaluate(input: PageSnapshot, thresholds: Thresholds): readonly Finding[];
}
10. Insights engine specification
Rules are pure functions, registered in a registry, individually unit-tested, and configurable through thresholds. The health score starts at 100; each finding subtracts a weight by severity (critical, warning, info) with a per-rule cap, and the score floors at 0. Default thresholds below are starting values and are editable in Settings.
• R01 Failed requests: any 4xx, 5xx or network error (critical for 5xx and network errors, warning for 4xx).
• R02 Slow requests: total time over 1 s or TTFB over 600 ms.
• R03 Large payloads: non-media transfer over 500 KB, images over 1 MB.
• R04 Uncompressed text: text-like responses over 1 KB without compression.
• R05 Missing caching: static assets without cache-control or ETag.
• R06 Duplicate requests: same URL and method within 2 s.
• R07 Request volume: more than 100 requests or more than 15 distinct origins.
• R08 Render-blocking resources in the document head.
• R09 LCP: needs improvement above 2.5 s, poor above 4 s, with element attribution.
• R10 CLS: needs improvement above 0.1, poor above 0.25, with shifted nodes.
• R11 INP: needs improvement above 200 ms, poor above 500 ms, with target attribution.
• R12 Long tasks: estimated total blocking time over 300 ms (warning) or 600 ms (critical).
• R13 Console errors: uncaught errors, rejections and repeated errors, grouped with counts.
• R14 Security-related console issues: mixed content, CORS, CSP violations.
• R15 Oversized images: natural size far above rendered size.
• R16 Memory growth trend over a sampling window.
• R17 Storage bloat: localStorage or IndexedDB over 5 MB, cookies over 4 KB total per origin.
The LCP, CLS and INP thresholds follow the published web.dev Core Web Vitals guidance; have the IDE re-verify them when implementing.
11. Tech stack
• Language: TypeScript 5.x with strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride.
• Extension framework: WXT (Manifest V3, hot reload, Chromium and Firefox builds).
• UI: Preact with @preact/signals for small bundles; plain CSS with design tokens as CSS custom properties, injected into the Shadow DOM. No global CSS frameworks.
• Validation: Zod at every trust boundary (messages, storage, imports).
• Testing: Vitest with happy-dom, Testing Library for Preact, Playwright with a persistent context for loading the unpacked extension, axe-core for accessibility, optional Stryker mutation testing on core.
• Quality: ESLint flat config with typescript-eslint strict-type-checked, Prettier, dependency-cruiser, size-limit, Husky with lint-staged, commitlint (Conventional Commits).
• Tooling and release: pnpm, GitHub Actions, release-please or Changesets.
• Optional: Storybook for UI components, a VitePress or Starlight docs site.
Verify current versions and APIs when installing; do not pin from this document.
12. Testing strategy
• Unit (most tests): core, protocol, collectors against fake platform ports, every insight rule with boundary-value cases, redaction with adversarial inputs.
• Component: Testing Library for each UI component and screen, including keyboard interaction.
• Integration: message bus, session store and command handlers using in-memory fakes; simulated service worker restarts.
• End to end: Playwright loads the built extension against tests/fixtures/bad-site, a local test site with deliberately slow, failing, large, uncached, layout-shifting and error-throwing resources. Every FR gets at least one E2E assertion.
• Non-functional: overhead benchmark, bundle-size budgets, axe scans, a test proving page scripts cannot read captured data.
• Gates in CI: lint, typecheck, unit and component tests with coverage thresholds, build, size-limit, E2E.
13. Engineering standards
• No any, no non-null assertions, no unchecked casts. Prefer discriminated unions, branded types and readonly.
• Pure functions in core; side effects only behind platform ports.
• Named exports only. One component per file. Files under 300 lines, functions under 40 lines where practical.
• No magic numbers: thresholds and limits live in typed constants or configuration.
• Expected failures return Result; exceptions are for programmer errors only. Every cross-context input is validated.
• Test files sit beside the code as *.test.ts. Test names describe behavior. Bug fixes start with a failing test.
• TSDoc on public APIs. Architectural decisions recorded as ADRs in docs/adr/.
• Conventional Commits, small focused commits, no dead code or commented-out code.
The full AI-IDE rules file is created in Prompt 0.1.
14. Open-source and release plan
• MIT license. Repository hygiene: README with a demo GIF and comparison table, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue and PR templates, good-first-issue labels, public roadmap.
• Store listings: Chrome Web Store (privacy policy, screenshots, per-permission justifications), Edge Add-ons, Firefox AMO. Review times vary, so submit well before any announcement.
• Launch: a design write-up (the architecture and the postMessage security story make a strong post), Show HN, Reddit communities for web development and browser extensions, dev.to, Product Hunt. Treat launch as a deliberate one-time effort with follow-up releases.
• Semantic versioning with an automated changelog.
15. Risks and mitigations
• Service worker lifecycle (MV3): persist state, make handlers idempotent, test restarts.
• Page eavesdropping on captured data: MessageChannel handshake, validation, an E2E test that tries to sniff.
• Pages that break when instrumented: wrap natives defensively, preserve toString and property descriptors, ship a per-site kill switch.
• Store review friction on permissions: minimal and optional permissions, written justifications, privacy policy.
• Browser API drift: isolate every API behind a port so a change touches one adapter.
• Scope creep and burnout: build strictly in prompt order, finish each gate, and keep a public roadmap for later ideas.
• Low adoption: the engineering quality and write-up still carry portfolio value.
16. Definition of Done for v1.0
• All FRs implemented with passing unit, component and E2E tests; all CI gates green.
• Coverage, bundle-size, overhead and accessibility budgets met.
• Security checklist from Prompt 8.3 passed; permissions justified.
• Documentation complete; store listings submitted; release tagged.