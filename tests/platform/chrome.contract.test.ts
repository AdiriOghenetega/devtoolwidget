import { createChromePorts } from '../../src/platform/chrome';
import { runPlatformContract, type PlatformHarness } from './contract';
import { createMockBrowser } from './mock-browser';

runPlatformContract('platform contract: chrome adapters', (options = {}) => {
  const mock = createMockBrowser({
    ...(options.storageQuotaBytes === undefined
      ? {}
      : { storageQuotaBytes: options.storageQuotaBytes }),
  });
  const ports = createChromePorts(mock.api);

  const harness: PlatformHarness = {
    ports,
    seedTab(tab) {
      mock.addTab(tab);
    },
    seedStoredValue(space, key, raw) {
      mock.seed(space, key, raw);
    },
    seedSessionRule(rule) {
      mock.setSessionRule(rule);
    },
    setCommands(commands) {
      mock.setCommands(commands);
    },
    setDebuggerResponse(method, response) {
      mock.setDebuggerResponse(method, response);
    },
    emitCommand(command) {
      mock.emitCommand(command);
    },
    advanceClock(milliseconds) {
      return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
      });
    },
  };

  return harness;
});
