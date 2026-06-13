import { API } from "../prepper.js";

/**
 * Wire click handlers onto the injected buttons.
 *
 * `root` is a native HTMLElement (the spellcasting tab). The buttons are
 * freshly inserted on every render, so a plain addEventListener is safe — there
 * are no prior listeners to remove.
 * @param {HTMLElement} root
 * @param {Actor} actor
 */
export function bindActorSheetHandlers(root, actor) {
    root.querySelectorAll('.pf2e-spellprep-spell-loadouts-manager').forEach((el) => {
        el.addEventListener('click', (ev) => {
            ev.preventDefault();
            const entryId = ev.currentTarget?.dataset?.entryId;
            if (!entryId) return;
            API.PrepperApp(actor, { spellcastingEntryId: entryId });
        });
    });

    root.querySelectorAll('.pf2e-spellprep-quick-load').forEach((el) => {
        el.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const entryId = ev.currentTarget?.dataset?.entryId;
            const entryName = ev.currentTarget?.dataset?.entryName || "Spellcasting";
            if (!entryId) return;
            await API.quickLoadDialog(actor, entryId, entryName);
        });
    });
}
