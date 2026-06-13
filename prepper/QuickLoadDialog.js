import PrepperStorage from "./PrepperStorage.js";
import { popup } from "./utilities/Utilities.js";

const { DialogV2 } = foundry.applications.api;

export async function quickLoadDialog(actor, entryId, entryName) {
    if (!actor || !entryId) return false;

    const entries = PrepperStorage.getPreparedSpellcastingEntries(actor);
    if (!entries.length) {
        popup(game.i18n.localize("PREPPER.loadout.loadWarning.entryNotFound"), "warn");
        return false;
    }

    const activeEntry = entries.find((e) => e.id === entryId);
    if (!activeEntry) {
        popup(game.i18n.localize("PREPPER.loadout.loadWarning.entryNotFound"), "warn");
        return false;
    }

    const escape = foundry.utils?.escapeHTML || ((text) => `${text}`);
    const loadoutsById = PrepperStorage.getSpellLoadouts(actor, activeEntry.id) || {};
    const loadouts = Object.entries(loadoutsById).map(([id, loadout]) => ({
        id,
        name: loadout?.name
    }));

    if (loadouts.length === 0) {
        const targetName = entryName || activeEntry?.name;
        popup(game.i18n.format("PREPPER.loadout.loadWarning.noLoadouts", { name: targetName }), "warn");
        return false;
    }

    const loadoutOptionsHtml = loadouts
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .map((loadout) => `<option value="${loadout.id}">${escape(loadout.name || "Unnamed Loadout")}</option>`)
        .join("");

    const content = `
        <form>
            <div class="form-group">
                <label>Loadout</label>
                <select name="loadout">
                    ${loadoutOptionsHtml}
                </select>
            </div>
        </form>
    `;

    return DialogV2.wait({
        window: {
            title: `${game.i18n.localize("PREPPER.popup.load")}: ${
                entryName || activeEntry?.name
            }`
        },
        content,
        buttons: [
            {
                action: "load",
                icon: "fas fa-bolt",
                label: game.i18n.localize("PREPPER.popup.load"),
                default: true,
                callback: async (_event, button) => {
                    const selectedLoadoutId = button.form?.elements?.loadout?.value;
                    if (!selectedLoadoutId) return;
                    const success = await PrepperStorage.loadSpellLoadout(actor, activeEntry.id, selectedLoadoutId);
                    if (success) {
                        popup(
                            game.i18n.format("PREPPER.loadout.loadSuccess", {
                                name: activeEntry?.name
                            })
                        );
                    }
                }
            },
            {
                action: "cancel",
                icon: "fas fa-times",
                label: game.i18n.localize("PREPPER.popup.cancel")
            }
        ]
    });
}
