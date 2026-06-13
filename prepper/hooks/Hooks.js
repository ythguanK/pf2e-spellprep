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
    registerSettings(settings.unifiedSpellbook);

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

/**
 * Inject the loadout-manager button into PF2e Unified Spellbook's "unified view".
 *
 * In unified view each spellcasting entry appears as a `.header-row` (one per
 * rank it has spells in) carrying `data-item-id` = the entry's id. We drop the
 * scroll button next to the entry name and wire it to that specific entry.
 *
 * NOTE: injecting on EVERY rank header (not just the first per entry) is
 * intentional — some classes (e.g. Magus) only have spells in a few high ranks,
 * so a per-rank button keeps the control next to wherever the spells actually are.
 * @param {HTMLElement} root  the sheet content element
 * @param {Actor} actor
 * @param {Set<string>} preparedEntryIds
 */
function injectUnifiedViewButtons(root, actor, preparedEntryIds) {
    const list = root.querySelector('.unified-spell-list');
    if (!list) return;

    for (const headerRow of list.querySelectorAll('.header-row[data-item-id]')) {
        const entryId = headerRow.dataset.itemId;
        if (!preparedEntryIds.has(entryId)) continue;
        if (headerRow.querySelector('.pf2e-spellprep-spell-loadouts-manager')) continue;

        const target = headerRow.querySelector('.item-name') || headerRow;
        const button = document.createElement('a');
        button.className = 'pf2e-spellprep-spell-loadouts-manager';
        button.dataset.entryId = entryId;
        button.dataset.tooltip = game.i18n.localize('PREPPER.ManageSpellLoadouts');
        button.innerHTML = '<i class="fas fa-scroll"></i>';
        // Bind on creation: these buttons persist across DOM mutations, so a
        // blanket re-bind on each observer pass would attach duplicate listeners.
        button.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            API.PrepperApp(actor, { spellcastingEntryId: entryId });
        });
        target.appendChild(button);
    }
}

/**
 * Wire up unified-view injection for a sheet render. PF2e Unified Spellbook
 * builds its list asynchronously *after* this render hook fires, so we inject
 * once now (handles re-renders where it already exists) and watch for it to
 * appear (or for a view toggle) via a MutationObserver. Gated behind a client
 * setting so it can be disabled if a Unified Spellbook update breaks the DOM.
 * @param {ApplicationV2} app
 * @param {HTMLElement|JQuery} html  the sheet content
 */
function setupUnifiedViewInjection(app, html) {
    try {
        if (!getSettings(settings.unifiedSpellbook)) return;
        if (!game.modules.get('pf2e-unified-spellbook')?.active) return;
        if (app.actor?.type !== 'character') return;

        const preparedEntryIds = new Set(
            (app.actor.itemTypes.spellcastingEntry || [])
                .filter(e => e.system.prepared?.value === 'prepared')
                .map(e => e.id)
        );
        if (preparedEntryIds.size === 0) return;

        const root = toElement(html);
        if (!root) return;

        // Tear down any observer left over from a previous render of this sheet.
        app._spellprepObserver?.disconnect();

        injectUnifiedViewButtons(root, app.actor, preparedEntryIds);

        // Disconnect while we mutate so our own insertions don't re-trigger us.
        // If injection ever throws (e.g. a future Unified Spellbook DOM change),
        // log once and stay disconnected rather than spamming on every mutation.
        const observer = new MutationObserver(() => {
            observer.disconnect();
            try {
                injectUnifiedViewButtons(root, app.actor, preparedEntryIds);
            } catch (e) {
                error('Unified Spellbook view injection failed; leaving its view untouched', e);
                return;
            }
            observer.observe(root, { childList: true, subtree: true });
        });
        observer.observe(root, { childList: true, subtree: true });
        app._spellprepObserver = observer;
    } catch (e) {
        error('Error injecting into Unified Spellbook view', e);
    }
}

// Add the manager buttons to the character sheet on render.
//
// On Foundry v14 the PF2e character sheet is ApplicationV2 and fires
// `renderCharacterSheetPF2e`. (The legacy `renderActorSheet` hook also fires as
// a compatibility alias, which is why registering both injected the button
// twice — so we register only the specific hook here.)
Hooks.on('renderCharacterSheetPF2e', (app, html) => {
    injectLoadoutButtons(app, html);
    setupUnifiedViewInjection(app, html);
});

// Stop observing when the sheet closes.
Hooks.on('closeCharacterSheetPF2e', (app) => {
    app._spellprepObserver?.disconnect();
    app._spellprepObserver = null;
});
