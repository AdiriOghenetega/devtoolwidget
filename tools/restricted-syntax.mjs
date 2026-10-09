/**
 * Selectors that ban every form of default export. Shared by the ESLint flat
 * config (`eslint.config.mjs`) and the lint test so the two cannot drift.
 *
 * - `export default x`         -> ExportDefaultDeclaration
 * - `export { x as default }`  -> ExportSpecifier with exported.name "default"
 * - `export = x` (TS)          -> TSExportAssignment
 *
 * @type {ReadonlyArray<{ readonly selector: string; readonly message: string }>}
 */
const MESSAGE =
  'Default exports are banned; use named exports. WXT entrypoints under src/entrypoints/** are the only exception (see AGENTS.md and ADR 0004).';

export const defaultExportRestrictedSyntax = [
  { selector: 'ExportDefaultDeclaration', message: MESSAGE },
  {
    selector: "ExportNamedDeclaration > ExportSpecifier[exported.name='default']",
    message: MESSAGE,
  },
  { selector: 'TSExportAssignment', message: MESSAGE },
];
