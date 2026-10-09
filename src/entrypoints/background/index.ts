import { defineBackground } from '#imports';

/**
 * Background service worker entrypoint.
 *
 * The `entrypoints` layer wires the other layers together and holds no business
 * logic (PRD 8.2). WXT requires entrypoints to default-export their definition;
 * this is the documented exception to the default-export ban (ADR 0004).
 */
export default defineBackground(() => {
  // Orchestration is added in later prompts.
});
