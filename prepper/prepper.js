import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import PrepperStorage from "./PrepperStorage.js";
import PrepperApp from "./PrepperApp.js";
import { quickLoadDialog } from "./QuickLoadDialog.js";
import "./hooks/Hooks.js";

// Create API for other modules to use
const API = {
    PrepperStorage: PrepperStorage,
    PrepperApp: (actor, options = {}) => new PrepperApp(actor, options).render(true),
    getPreparedSpellcastingEntries: (actor) => PrepperStorage.getPreparedSpellcastingEntries(actor),
    getSpellLoadouts: (actor, spellcastingEntryId) => PrepperStorage.getSpellLoadouts(actor, spellcastingEntryId),
    loadSpellLoadout: (actor, spellcastingEntryId, loadoutId) => PrepperStorage.loadSpellLoadout(actor, spellcastingEntryId, loadoutId),
    quickLoadDialog: (actor, spellcastingEntryId, entryName) => quickLoadDialog(actor, spellcastingEntryId, entryName)
};

export { API, MODULE_ID, MODULE_TITLE };
