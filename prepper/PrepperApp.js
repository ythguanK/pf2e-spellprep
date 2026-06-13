import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { API } from "./prepper.js";
import { debug, info, popup } from "./utilities/Utilities.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api
const { renderTemplate } = foundry.applications.handlebars;
/**
* Application for managing spell loadouts
*/
export default class PrepperApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static LOADOUT_DIALOG_TEMPLATE = `modules/${MODULE_ID}/templates/loadout-naming-dialog.hbs`;

    static DEFAULT_OPTIONS = {
        id: MODULE_ID,

        actions: {
            changeTab: PrepperApp._onChangeTab,

            // Current preparation actions
            new: PrepperApp._onNew,
            reload: PrepperApp._onReloadCurrent,

            // Stored loadout actions
            load: PrepperApp._onLoad,
            duplicate: PrepperApp._onDuplicate,
            delete: PrepperApp._onDelete,
            rename: PrepperApp._onRename,
            reset: PrepperApp._onReset,

            clearAll: PrepperApp._onClearAllFlags,
        },

        position: {
            width: 700,
            height: 700
        },

        tag: "div",

        classes: [MODULE_ID],
        window: {
            title: MODULE_TITLE,
            icon: 'fas fa-scroll',
            frame: true,
            resizable: true
        }
    };

    static PARTS = {
        page: {
            template: `modules/${MODULE_ID}/templates/prepper.hbs`,
            scrollable: [''],
        }
    }

    /**
    * @param {Actor} actor - The actor to manage spell loadouts for
    * @param {Object} options - Application options
    */
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        this.spellcastingEntryId = options.spellcastingEntryId;
        this.activeTab = 'current';
    };

    async _preparePartContext() {
        const currentEntry = this._getCurrentSpellsDisplay(this.spellcastingEntryId);

        // Get all spell loadouts for this spellcasting entry
        const storage = API.PrepperStorage;
        const spellLoadouts = storage.getSpellLoadouts(this.actor, this.spellcastingEntryId);
        
        // Sort loadouts alphabetically
        const sortedLoadouts = Object.values(spellLoadouts).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        
        // Process each loadout to add displayEntries for the template
        for (const loadout of sortedLoadouts) {
            loadout.displayEntry = this._getLoadoutDisplay(loadout);
        }

        return {
            actor: this.actor,
            spellcastingEntry: currentEntry,
            spellLoadouts: sortedLoadouts,
            hasLoadouts: sortedLoadouts.length > 0,
            activeTab: this.activeTab || 'current'
        };
    }
    
    /**
    * Get the current spells for display
    * @returns {Array} Array of spellcasting entries with their spells
    * @private
    */
    _getCurrentSpellsDisplay(spellcastingEntryId) {
        const entry = this.actor.items.find(entry =>
            entry.id === spellcastingEntryId && entry.system.prepared?.value === 'prepared'
        );
        if (!entry) return null;

        debug(`Processing spellcasting entry\nName: ${entry.name}\nID: ${entry.id}`);
        const entryData = {
            id: entry.id,
            flexible: entry.system.prepared.flexible,
            name: entry.name,
            levels: []
        };
        debug(`Entry data:`, entryData);

        entryData.flexible
            ? this._getCurrentSpellsDisplayFlexible(entryData, entry)
            : this._getCurrentSpellsDisplayPrepared(entryData, entry);

        debug(`Final spells data:`, entryData);
        return entryData;
    }
    
    _getCurrentSpellsDisplayPrepared(entryData, entry) {
        // Get all prepared spells for this entry
        const slots = entry.system.slots || {};
        debug(`Slots for entry ${entry.name}:`, slots);
        
        // For each spell level, get the prepared spells
        for (let level = 1; level <= 10; level++) {
            const slotKey = `slot${level}`;
            if (!slots[slotKey]) {
                debug(`No slot data for level ${level} in entry ${entry.name}.`);
                continue;
            }
            
            debug(`Processing slot ${slotKey} for level ${level}`);
            const prepared = slots[slotKey].prepared || [];
            debug(`Prepared spells for slot ${slotKey}:`, prepared);
            
            if (prepared.length === 0) continue;
            
            const levelData = {
                level: level,
                spells: []
            };
            
            // Get spell data
            for (const preparedSpell of prepared) {
                if (!preparedSpell.id) {
                    debug(`Prepared spell missing ID in slot ${slotKey}.`, preparedSpell);
                    continue;
                }
                
                // Find the spell item
                const spell = this.actor.items.find(s => s.id === preparedSpell.id);
                if (!spell) {
                    debug(`Spell with ID ${preparedSpell.id} not found in actor items.`);
                    continue;
                }
                
                debug(`Found spell: ${spell.name} (ID: ${spell.id})`);
                levelData.spells.push({
                    id: spell.id,
                    name: spell.name,
                });
            }
            
            if (levelData.spells.length > 0) {
                entryData.levels.push(levelData);
            }
        }
        
        return entryData;
    }
    
    _getCurrentSpellsDisplayFlexible(entryData, entry) {
        // Get all spells associated with this entry via "location"
        const spells = this.actor.items.filter(spell => 
            spell.type === 'spell' && spell.system.location?.value === entry.id && spell.system.location?.signature === true
        );
        
        debug(`Found ${spells.length} spells for entry ${entry.name}.`);
        
        // Group spells by level
        const spellsByLevel = {};
        for (const spell of spells) {
            const level = spell.system.level.value || 0;
            if (!spellsByLevel[level]) {
                spellsByLevel[level] = [];
            }
            spellsByLevel[level].push({
                id: spell.id,
                name: spell.name,
                // Add additional spell properties if needed
            });
        }
        
        // Add spells to entry data
        for (const [level, spells] of Object.entries(spellsByLevel)) {
            entryData.levels.push({
                level: parseInt(level),
                spells: spells
            });
        }
        
        // Sort levels numerically
        entryData.levels.sort((a, b) => a.level - b.level);
        
        return entryData;
    }
    
    /**
    * Get the spells from a saved loadout for display
    * @param {Object} loadout - The saved spell loadout
    * @returns {Array} Array of spellcasting entries with their spells
    * @private
    */
    _getLoadoutDisplay(loadout) {
        if (!loadout.spellcastingEntry) return null;

        const entry = loadout.spellcastingEntry;
        const entryData = {
            id: entry.id,
            name: entry.name,
            levels: []
        };

        if (entry.levels && entry.levels.length > 0) {
            for (const levelObj of entry.levels) {
                const levelData = {
                    level: levelObj.level,
                    spells: []
                };

                for (const spellInfo of (levelObj.spells || [])) {
                    if (!spellInfo.id) continue;

                    const spell = this.actor.items.get(spellInfo.id);
                    levelData.spells.push({
                        id: spellInfo.id,
                        name: spell?.name || spellInfo.name || game.i18n.localize("PREPPER.loadout.unknownSpell"),
                    });
                }

                if (levelData.spells.length > 0) {
                    entryData.levels.push(levelData);
                }
            }
        }

        return entryData;
    }

    static async _onChangeTab(_, button) {
        this.activeTab  = button.dataset.tab;
        this.render();
    }

    /**
     * Render loadout dialog form content
     * @param {{name?: string, description?: string}} dialogData
     * @returns {Promise<string>}
     * @private
     */
    static async _renderLoadoutDialogContent(dialogData = {}) {
        const { name = "", description = "" } = dialogData;
        return renderTemplate(this.LOADOUT_DIALOG_TEMPLATE, { name, description });
    }
    
    /**
    * Handle creating a new spell loadout
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onNew(event) {
        event.preventDefault();
        
        // Prompt for name and description
        const content = await PrepperApp._renderLoadoutDialogContent();
        await DialogV2.wait({
            window: { title: game.i18n.localize('PREPPER.loadoutButton.new') },
            content,
            buttons: [{
                action: "save",
                icon: "fas fa-save",
                label: game.i18n.localize('PREPPER.popup.save'),
                default: true,
                callback: async (_event, button) => {
                        const form = button.form;
                        const name = form?.elements?.name?.value;
                        const description = form?.elements?.description?.value;
                        
                        if (!name) return;
                        
                        // Save the current preparation as a new loadout
                        const storage = API.PrepperStorage;
                        const currentSpells = this._getCurrentSpellsDisplay(this.spellcastingEntryId);
                        const newId = await storage.saveCurrentAsNewLoadout(this.actor, this.spellcastingEntryId, currentSpells, name, description);
                        
                        // Switch to the new loadout tab
                        this.activeTab = newId;

                        // Refresh the app
                        this.render(true);
                        
                        // Show success notification
                        popup(game.i18n.localize('PREPPER.loadout.saveSuccess'));
                    }
                },
                {
                    action: "cancel",
                    icon: "fas fa-times",
                    label: game.i18n.localize('PREPPER.popup.cancel')
                }
            ]
        });
    }
    
    /**
    * Handle duplicating a spell loadout
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onDuplicate(event, target) {
        event.preventDefault();
        
        const loadoutId = target.dataset.loadoutId;
        if (!loadoutId) return;
        
        // Get the loadout to duplicate
        const storage = API.PrepperStorage;
        const loadout = storage.getLoadout(this.actor, this.spellcastingEntryId, loadoutId);
        if (!loadout) return;
        
        // Prompt for name and description
        const content = await PrepperApp._renderLoadoutDialogContent({
            name: `${loadout.name} (Copy)`,
            description: loadout.description || ""
        });
        await DialogV2.wait({
            window: { title: game.i18n.localize('PREPPER.loadoutButton.duplicate') },
            content,
            buttons: [{
                action: "save",
                icon: "fas fa-save",
                label: game.i18n.localize('PREPPER.popup.save'),
                default: true,
                callback: async (_event, button) => {
                        const form = button.form;
                        const name = form?.elements?.name?.value;
                        const description = form?.elements?.description?.value;
                        
                        if (!name) return;
                        
                        // Duplicate the loadout
                        const newLoadoutId = await storage.duplicateSpellLoadout(this.actor, this.spellcastingEntryId, loadoutId, name, description);
                        
                         // Switch to the new loadout tab
                        this.activeTab = newLoadoutId;

                        // Refresh the app
                        this.render(true);
                        
                        // Show success notification
                        popup(game.i18n.localize('PREPPER.loadout.saveSuccess'));
                    }
                },
                {
                    action: "cancel",
                    icon: "fas fa-times",
                    label: game.i18n.localize('PREPPER.popup.cancel')
                }
            ]
        });
    }
    
    /**
    * Handle loading a spell loadout
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onLoad(event, target) {
        event.preventDefault();
        
        const loadoutId = target.dataset.loadoutId;
        if (!loadoutId) return;
        
        // Confirm before loading
        const confirm = await DialogV2.confirm({
            window: { title: game.i18n.localize('PREPPER.loadoutButton.load') },
            content: game.i18n.localize('PREPPER.popup.loadConfirm'),
            defaultYes: false,
            rejectClose: false
        });
        
        if (!confirm) return;
        
        // Load the selected loadout
        const storage = API.PrepperStorage;
        const success = await storage.loadSpellLoadout(this.actor, this.spellcastingEntryId, loadoutId);
        
        if (success) {
            popup(game.i18n.localize('PREPPER.loadout.loadSuccess'));
        }
    }
    
    /**
    * Handle reloading the current preparation display
    * @param {Event} event - The triggering event
    * @private
    */
    static _onReloadCurrent(event) {
        event.preventDefault();
        this.render(true);
    }

    /**
    * Handle clearing all saved spell loadouts for this actor
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onClearAllFlags(event) {
        event.preventDefault();

        const confirm = await DialogV2.confirm({
            window: { title: game.i18n.localize('PREPPER.loadoutButton.clearAll') },
            content: game.i18n.localize('PREPPER.clearAllFlags.confirm'),
            defaultYes: false,
            rejectClose: false
        });

        if (!confirm) return;

        const storage = API.PrepperStorage;
        const success = await storage.clearAllSpellLoadouts(this.actor);

        if (success) {
            this.activeTab = 'current';
            popup(game.i18n.localize('PREPPER.clearAllFlags.success'));
            this.render(true);
            return;
        }
    }

    /**
     * Handle updating a spell loadout
     * @param {Event} event - The triggering event
     * @private
     */
    static async _onReset(event, target) {
        event.preventDefault();

        const loadoutId = target.dataset.loadoutId;
        if (!loadoutId) return;

        // Confirm before updating
        const confirm = await DialogV2.confirm({
            window: { title: game.i18n.localize('PREPPER.popup.reset') },
            content: game.i18n.localize('PREPPER.popup.resetConfirm'),
            defaultYes: false,
            rejectClose: false
        });

        if (!confirm) return;

        // Update the selected loadout
        const storage = API.PrepperStorage;
        const currentSpells = this._getCurrentSpellsDisplay(this.spellcastingEntryId);
        const newLoadoutId = await storage.resetLoadout(this.actor, this.spellcastingEntryId, currentSpells, loadoutId);

        if (newLoadoutId) {
            this.activeTab = newLoadoutId;
            popup(game.i18n.localize('PREPPER.loadout.updateSuccess'));
            this.render(false);
        }
    }
    
    /**
    * Handle deleting a spell loadout
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onDelete(event, target) {
        event.preventDefault();
        
        const loadoutId = target.dataset.loadoutId;
        if (!loadoutId) return;
        
        // Confirm before deleting
        const confirm = await DialogV2.confirm({
            window: { title: game.i18n.localize('PREPPER.loadoutButton.delete') },
            content: game.i18n.localize('PREPPER.popup.deleteConfirm'),
            defaultYes: false,
            rejectClose: false
        });
        
        if (!confirm) return;
        
        // Delete the selected loadout
        const storage = API.PrepperStorage;
        const success = await storage.deleteLoadout(this.actor, this.spellcastingEntryId, loadoutId);
        
        if (success) {
            debug(game.i18n.localize('PREPPER.loadout.deleteSuccess'));
            this.activeTab = 'current';
            this.render(true);
        }
    }
    
    /**
    * Handle renaming a spell loadout
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onRename(event, target) {
        event.preventDefault();
        
        const loadoutId = target.dataset.loadoutId;
        if (!loadoutId) return;
        
        // Get the current loadout
        const storage = API.PrepperStorage;
        const loadout = storage.getLoadout(this.actor, this.spellcastingEntryId, loadoutId);
        
        if (!loadout) return;
        
        // Prompt for new name and description
        const content = await PrepperApp._renderLoadoutDialogContent({
            name: loadout.name,
            description: loadout.description || ""
        });
        await DialogV2.wait({
            window: { title: game.i18n.localize('PREPPER.loadoutButton.rename') },
            content,
            buttons: [{
                action: "save",
                icon: "fas fa-save",
                label: game.i18n.localize('PREPPER.popup.save'),
                default: true,
                callback: async (_event, button) => {
                        const form = button.form;
                        const name = form?.elements?.name?.value;
                        const description = form?.elements?.description?.value;
                        
                        if (!name) return;
                        
                        // Rename the loadout
                        await storage.renameSpellLoadout(this.actor, this.spellcastingEntryId, loadoutId, name, description);
                        
                        // Refresh the app
                        this.render(true);
                    }
                },
                {
                    action: "cancel",
                    icon: "fas fa-times",
                    label: game.i18n.localize('PREPPER.popup.cancel')
                }
            ]
        });
    }
}
