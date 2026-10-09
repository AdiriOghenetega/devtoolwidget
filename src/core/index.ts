/**
 * The `core` layer: pure, browser-agnostic domain logic (PRD section 8.2).
 *
 * This barrel is the layer's public API. It re-exports the domain model
 * (`./domain`) and the `Result` helpers (`./result`).
 */
export * from './domain';
export * from './result';
