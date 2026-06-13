import { API } from "../prepper.js";
import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { getSettings, settings, registerSettings } from "../utilities/Utilities.js";

export function registerDailiesIntegration() {
    const dailiesApi = game.dailies?.api;
    if (!dailiesApi?.registerCustomDailies) return;

    // Register visibility settings
    registerSettings(settings.dailiesIntegration);

    // Check if we want to register to dailies
    if (!getSettings(settings.dailiesIntegration)) return;

    const noChange = "__none__";

    const getEntriesWithLoadouts = (actor) => {
        return API.PrepperStorage.getPreparedSpellcastingEntries(actor).filter(e => e.hasLoadouts);
    };

    const daily = {
        key: MODULE_ID,
        label: () => {
            return "Change Spell Loadout";
        },
        condition: (actor) => {
            return getEntriesWithLoadouts(actor).length > 0;
        },
        prepare: (actor) => {
            return {
                spellcastingEntries: getEntriesWithLoadouts(actor),
            };
        },
        rows: (actor, _, custom) => {
            const rows = [];

            // Dailies labels are not handlig dynamic data in a logical manner. If we have too few rows, we need a mock-row to get it to display in a way that makes sense
            // so in order to get a correct display from Dailies, we add this workaround, and add css (dailies.css) to hide it
            rows.push({
                type: "notify",
                message: "Workaround for Dailies"
            });

            for (const entry of custom.spellcastingEntries) {
                const loadouts = API.getSpellLoadouts(actor, entry.id);
                const options = Object.values(loadouts || {})
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                    .map((loadout) => ({
                        value: loadout.id,
                        label: loadout.name
                    }));

                if (options.length === 0) continue;

                options.unshift({ value: noChange, label: "Keep current" });
                rows.push({
                    type: "select",
                    slug: `spellprep-loadout-${entry.id}`,
                    label: entry.name,
                    options,
                    save: false
                });
            }
            return rows;
        },
        process: async ({ actor, rows, messages, custom }) => {
            const groupLabel = MODULE_TITLE;

            for (const entry of custom.spellcastingEntries) {
                const slug = `spellprep-loadout-${entry.id}`;
                const selected = rows?.[slug];
                if (!selected || selected === noChange) continue;

                const success = await API.loadSpellLoadout(actor, entry.id, selected);

                if (!success) continue;

                if (typeof messages?.addGroup === "function") {
                   messages.addGroup(MODULE_ID, groupLabel);
                }
                if (typeof messages?.add === "function") {
                    const loadout = API.PrepperStorage.getLoadout(actor, entry.id, selected);
                    const loadoutName = loadout?.name || "loadout";
                    messages.add(MODULE_ID, { label: `Loaded ${loadoutName} for ${entry.name}` });
                }
            }
        }
    };

    dailiesApi.registerCustomDailies([daily]);
}
