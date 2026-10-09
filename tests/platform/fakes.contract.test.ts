import { createFakePorts } from '../../src/platform/fakes';
import { runPlatformContract, type PlatformHarness } from './contract';

runPlatformContract('platform contract: fakes', (options = {}) => {
  const ports = createFakePorts({
    now: 1_000,
    ...(options.storageQuotaBytes === undefined
      ? {}
      : { quotaBytesPerSpace: options.storageQuotaBytes }),
  });

  const harness: PlatformHarness = {
    ports,
    seedTab(tab) {
      ports.tabs.addTab(tab);
    },
    seedStoredValue(space, key, raw) {
      ports.storage.seed(space, key, raw);
    },
    seedSessionRule(rule) {
      void ports.networkRules.updateSessionRules({ addRules: [rule] });
    },
    setCommands(commands) {
      ports.commands.setCommands(commands);
    },
    setDebuggerResponse(method, response) {
      ports.debugger.setResponse(method, response);
    },
    emitCommand(command) {
      ports.commands.emit(command);
    },
    advanceClock(milliseconds) {
      return ports.clock.advance(milliseconds);
    },
  };

  return harness;
});
