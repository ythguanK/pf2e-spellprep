import { API } from '../prepper.js';
import { MODULE_ID } from '../constants.js';
import { info, error, popup, settings, registerSettings, getSettings } from "../utilities/Utilities.js";
import { registerDailiesIntegration } from "./DailiesIntegration.js";
import { bindActorSheetHandlers } from "./Handlers.js";

/**
 * Normalize a render hook's html argument to a native HTMLElement.
 *
 * Foundry v13/v14 ApplicationV2 sheets pass a native HTMLElement, while the
 * legacy V1 Application framework passes a jQuery object. Handle both so the
 * module works regardless of which framework the PF2e actor sheet uses.
 * @param {HTMLElement|JQuery} html
 * @returns {HTMLElement|null}
 */
function toElement(html) {
    if (html instanceof HTMLElement) return html;
    // jQuery objects are array-like; the underlying element is at index 0.
    if (html && typeof html === "object" && html[0] instanceof HTMLElement) return html[0];
    return null;
}

/**
 * Inject the loadout-manager (and optional quick-load) buttons onto each
 * prepared spellcasting entry in the actor sheet's spellcasting tab.
 * @param {ApplicationV2|Application} app
 * @param {HTMLElement|JQuery} html
 */
function injectLoadoutButtons(app, html) {
    try {
        // Only add to PF2e character sheets with at least one prepared caster.
        if (app.actor?.type !== 'character') return;

        const spellcastingEntries = app.actor.itemTypes.spellcastingEntry || [];
        const preparedEntries = spellcastingEntries.filter(
            entry => entry.system.prepared?.value === 'prepared'
        );
        if (preparedEntries.length === 0) return;

        const root = toElement(html);
        if (!root) return;

        // Find the spellcasting tab content.
        const spellcastingTab = root.querySelector('.tab[data-tab="spellcasting"]');
        if (!spellcastingTab) return;

        // Remove stale buttons before re-inserting (sheet re-renders frequently).
        spellcastingTab
            .querySelectorAll('.pf2e-spellprep-spell-loadouts-manager, .pf2e-spellprep-quick-load')
            .forEach(el => el.remove());

        const showQuickLoad = getSettings(settings.quickLoadVisible);

        for (const entry of preparedEntries) {
            const row = spellcastingTab.querySelector(
                `.item[data-item-id="${entry.id}"], .spellcasting-entry[data-item-id="${entry.id}"]`
            );
            if (!row) continue;

            // Prefer the entry's control cluster; fall back to its header, then the row itself.
            const controls = row.querySelector('.item-controls') || row.querySelector('header') || row;

            // Idempotency guard: never inject twice for the same entry, even if
            // more than one render hook fires for a single sheet render.
            if (controls.querySelector(`.pf2e-spellprep-spell-loadouts-manager[data-entry-id="${entry.id}"]`)) continue;

            const quickLoadHtml = showQuickLoad
                ? `<a class="pf2e-spellprep-quick-load" data-entry-id="${entry.id}" data-entry-name="${entry.name}" data-tooltip="${game.i18n.localize('PREPPER.QuickLoad')}"><i class="fas fa-bolt"></i></a>`
                : "";

            const buttonHtml = `${quickLoadHtml}<a class="pf2e-spellprep-spell-loadouts-manager" data-entry-id="${entry.id}" data-tooltip="${game.i18n.localize('PREPPER.ManageSpellLoadouts')}"><i class="fas fa-scroll"></i></a>`;

            controls.insertAdjacentHTML('afterbegin', buttonHtml);
        }

        bindActorSheetHandlers(spellcastingTab, app.actor);
    } catch (e) {
        error('Error adding button to character sheet', e);
    }
}

// Initialize the module.
Hooks.once('init', () => {
    info('Initializing module');

    // Register module settings
    registerSettings(settings.debug);
    registerSettings(settings.quickLoadVisible);

    // Register Handlebars helper for date formatting
    Handlebars.registerHelper('formatDate', function(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString();
    });
});

// Set up the API and integrations once Foundry is ready.
Hooks.once('ready', () => {
    if (game.system.id != 'pf2e') {
        popup('This module is designed for PF2e only. Please disable it for other systems.');
        return;
    }

    // Register the API
    game.modules.get(MODULE_ID).api = API;

    // Register PF2e Dailies integration (custom daily)
    registerDailiesIntegration();

    info('Module initialized');
});

// Add the manager button to the character sheet's spellcasting tab.
//
// On Foundry v14 the PF2e character sheet is ApplicationV2 and fires
// `renderCharacterSheetPF2e`. (The legacy `renderActorSheet` hook also fires as
// a compatibility alias, which is why registering both injected the button
// twice — so we register only the specific hook here.)
Hooks.on('renderCharacterSheetPF2e', injectLoadoutButtons);
