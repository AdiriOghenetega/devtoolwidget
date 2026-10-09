import { installAgentBridge } from '../../capture/bridge';

/**
 * Main-world agent (PRD 8.1): registered at `document_start` with `world: MAIN`
 * so it runs before page scripts and is not blocked by page CSP. It installs the
 * capturing handshake listener; all logic lives in `capture/bridge`.
 */
export default defineContentScript({
  registration: 'runtime',
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installAgentBridge({ target: window });
  },
});
