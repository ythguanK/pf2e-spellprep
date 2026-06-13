/**
 * Module-wide constants.
 *
 * Kept as plain literals (no imports) so this file sits at the root of the
 * dependency graph. That does two things:
 *   1. Lets Foundry load the source directly in the browser with no build step
 *      (a JSON import of module.json would require a bundler or import assertions).
 *   2. Breaks the circular import that previously existed between prepper.js,
 *      Utilities.js and PrepperStorage.js.
 *
 * If you rename the module, change MODULE_ID here AND the "id" in module.json
 * (they must match the module's folder name in Foundry's modules directory).
 */
export const MODULE_ID = "pf2e-spellprep";
export const MODULE_TITLE = "PF2e SpellPrep";

/** The legacy module we forked from. We read its saved data for drop-in compatibility. */
export const LEGACY_MODULE_ID = "pf2e-prepper";
