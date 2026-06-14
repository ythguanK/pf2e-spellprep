import { MODULE_ID, MODULE_TITLE } from "../constants.js";
export { debug, error, info, popup, settings, getSettings, registerSettings };

const settings = {
    debug: { id: "debugMode", name: "Enable Debugging", hint: "Print debug to console log" },

    dailiesIntegration: {
        id: "enableDailiesIntegration",
        name: "Enable PF2e Dailies Integration",
        hint: "Register this module as a custom daily in PF2e Dailies.",
        scope: "world",
        requiresReload: true
    },

    quickLoadVisible: {
        id: "showQuickLoadButton",
        name: "Show Quick Load Button",
        hint: "Show the lightning-bolt quick-load button on prepared spellcasting entries.",
        scope: "client"
    },

    unifiedSpellbook: {
        id: "unifiedSpellbookButton",
        name: "Unified Spellbook: Show Loadout Button",
        hint: "When using PF2e Unified Spellbook, add the loadout button to each spellcasting entry header in the unified view. Turn this off if a Unified Spellbook update ever breaks it.",
        scope: "client",
        default: true
    },

    sortJsonAlpha: {
        id: "sortJsonAlphabetical",
        name: "Sort JSON Exports Alphabetically",
        hint: "When exporting to JSON, sort entries alphabetically by name. Turn off to keep the existing order.",
        scope: "client",
        default: true
    },

    includeCantrips: {
        id: "includeCantrips",
        name: "Include Cantrips in Loadouts",
        hint: "When on, loadouts save and restore your prepared cantrips. Turn off to leave cantrips untouched when saving and loading.",
        scope: "client",
        config: false,
        default: true
    },

    flagNames: {
        loadouts: 'loadouts',
    }
}

function getSettings(setting) {
    return game.settings.get(MODULE_ID, setting.id);
}

function registerSettings(setting) {
    game.settings.register(MODULE_ID, setting.id, {
        name: setting.name,
        hint: setting.hint,
        scope: setting.scope || "client",
        config: setting.config ?? true,
        type: setting.type || Boolean,
        default: setting.default ?? false,
        requiresReload: setting.requiresReload || false,
    });
}

function popup(message, type = "info") {
    const notifications = globalThis.ui?.notifications;
    if (!notifications) {
        info(message);
        return;
    }

    const prefixedMessage = `${MODULE_TITLE}: ${message}`;
    if (type === "warn") {
        notifications.warn(prefixedMessage, { permanent: true });
        return;
    }

    if (type === "error") {
        notifications.error(prefixedMessage, { permanent: true });
        return;
    }

    notifications.info(prefixedMessage);
}

function debug(message) {
    if (getSettings(settings.debug))
        console.debug(`${MODULE_TITLE}: ${message}`);
}

function info(message) {
    console.info(`${MODULE_TITLE}: ${message}`);
}

/**
 * Log an error message
 * @param {string} msg - Error message to log
 * @param {*} error - Optional error object
 */
function error(msg, error) {
    console.error(`${MODULE_TITLE}: ERROR | ${msg}`, error);
}
