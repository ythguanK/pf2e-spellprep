import { MODULE_ID, LEGACY_MODULE_ID } from "./constants.js";
import { settings, error, popup } from "./utilities/Utilities.js";

/**
 * Class for handling spell loadout storage and management
 */
export default class PrepperStorage {
  /**
   * 
   * @param {*} missingSpellsText 
   * @returns 
   */
  static _showMissingSpellsWarning(missingSpellsText) {
    if (!missingSpellsText?.size) return;

    const heading = game.i18n.localize("PREPPER.loadout.loadWarning.missingSpellsHeading");
    const details = Array.from(missingSpellsText).join("\n");

    popup(`${heading}\n${details}`, "warn");
  }

  /**
   * Deep clone an object using JSON serialization
   * @param {Object} obj - The object to clone
   * @returns {Object} - A deep copy of the object
   * @private
   */
  static _deepClone(obj) {
    // Try to use Foundry's deepClone if available, otherwise use JSON method
    if (typeof foundry !== 'undefined' && foundry.utils && foundry.utils.deepClone) {
      return foundry.utils.deepClone(obj);
    }
    // Fallback for testing environments
    return JSON.parse(JSON.stringify(obj));
  }
  
  /**
   * Get all saved spell loadouts for an actor
   * @param {Actor} actor - The actor to get spell loadouts for
   * @param {string} spellcastingEntryId - The spellcasting entry id
   * @returns {Object} - Object containing all saved spell loadouts
   */
  static getSpellLoadouts(actor, spellcastingEntryId) {
    const allLoadouts = this._getAllLoadouts(actor);
    return allLoadouts[spellcastingEntryId] || {};
  }

  /**
   * Get all prepared spellcasting entries for an actor.
   * @param {Actor} actor - The actor to get prepared spellcasting entries for
   * @returns {Array<{id: string, name: string, flexible: boolean, hasLoadouts: boolean}>}
   */
  static getPreparedSpellcastingEntries(actor) {
    const entries = actor?.itemTypes?.spellcastingEntry || [];
    const allLoadouts = this._getAllLoadouts(actor);
    return entries
      .filter(entry => entry?.system?.prepared?.value === "prepared")
      .map(entry => ({
        id: entry.id,
        name: entry.name,
        flexible: entry.system.prepared?.flexible === true,
        hasLoadouts: Object.keys(allLoadouts?.[entry.id] || {}).length > 0
      }));
  }

  /**
   * Get all entry-grouped spell loadouts for an actor.
   *
   * Reads our own flags first. For drop-in compatibility with the module we
   * forked from, we fall back to reading PF2e Prepper's flags (and its older
   * "spellLists" key) so a switching user keeps their saved loadouts. Because
   * every mutator deep-clones this result and then writes it back under our own
   * MODULE_ID, the first edit transparently migrates the data into our namespace
   * without touching the legacy module's data.
   *
   * @param {Actor} actor
   * @returns {Object}
   * @private
   */
  static _getAllLoadouts(actor) {
    return actor.getFlag(MODULE_ID, settings.flagNames.loadouts)
      || actor.getFlag(MODULE_ID, "spellLists")
      || actor.getFlag(LEGACY_MODULE_ID, settings.flagNames.loadouts)
      || actor.getFlag(LEGACY_MODULE_ID, "spellLists")
      || {};
  }

  /**
   * Get a specific loadout by ID
   * @param {Actor} actor - The actor to get the loadout from
   * @param {string} spellcastingEntryId - The spellcasting entry to load from
   * @param {string} loadout - The ID of the loadout to get
   * @returns {Object|null} - The loadout object or null if not found
   */
  static getLoadout(actor, spellcastingEntryId, loadout) {
    const loadouts = this.getSpellLoadouts(actor, spellcastingEntryId);
    return loadouts[loadout] || null;
  }

  /**
  * Save the current spell preparation as a new loadout
  * @param {Actor} actor - The actor to save the loadout for
  * @param {string} spellcastingEntryId - The spellcasting entry id to save loadouts for
  * @param {Object} currentEntrySpells - The spellcasting entry spells to save
  * @param {string} name - The name of the loadout
  * @param {string} description - Optional description of the loadout
  * @returns {Promise<string>} - The ID of the newly created loadout
  */
  static async saveCurrentAsNewLoadout(actor, spellcastingEntryId, currentEntrySpells, name, description = '') {
    // Generate a unique ID for the new loadout
    const loadoutId = foundry.utils.randomID();

    // Create the loadout data structure
    const loadout = {
      id: loadoutId,
      spellcastingEntryId: spellcastingEntryId,
      name: name,
      description: description,
      spellcastingEntry: currentEntrySpells,
      created: Date.now()
    };

    // Save the loadout to the actor's flags
    const allLoadout = this._deepClone(this._getAllLoadouts(actor));
    allLoadout[spellcastingEntryId] = allLoadout[spellcastingEntryId] || {};
    allLoadout[spellcastingEntryId][loadoutId] = loadout;

    await actor.unsetFlag(MODULE_ID, settings.flagNames.loadouts);
    await actor.setFlag(MODULE_ID, settings.flagNames.loadouts, allLoadout);

    return loadoutId;
  }

  /**
   * Load a saved loadout into the current preparation
   * @param {Actor} actor - The actor to load the loadout for
   * @param {string} spellcastingEntryId - The spellcasting entry id to load into
   * @param {string} loadoutId - The ID of the loadout to load
   * @returns {Promise<boolean>} - Whether the load was successful
   */
  static async loadSpellLoadout(actor, spellcastingEntryId, loadoutId) {
    const loadout = this.getLoadout(actor, spellcastingEntryId, loadoutId);
    if (!loadout || !loadout.spellcastingEntry) return false;

    const success = await this._applyLoadoutToEntry(actor, spellcastingEntryId, loadout.spellcastingEntry);
    if (!success) return false;

    const loadouts = this._getAllLoadouts(actor);
    await actor.unsetFlag(MODULE_ID, settings.flagNames.loadouts);
    await actor.setFlag(MODULE_ID, settings.flagNames.loadouts, loadouts);
    
    return true;
  }

  /**
   * Update an existing loadout with the current preparation
   * @param {Actor} actor - The actor to update the loadout for
   * @param {string} spellcastingEntryId - The spellcasting entry id to update loadouts for
   * @param {Object} currentEntrySpells - The current spellcasting entry spells to save
   * @param {string} loadoutId - The ID of the loadout to update
   * @returns {Promise<string>} - Whether the update was successful
   */
  static async resetLoadout(actor, spellcastingEntryId, currentEntrySpells, loadoutId) {
    const loadout = this.getLoadout(actor, spellcastingEntryId, loadoutId);
    if (!loadout) return false;

    // Since the structure of the loadout is quite complex and closely tied to the current preparation, it's simpler and more reliable to just save the current preparation as a new loadout with the same name & description, and then delete the current loadout
    const newLoadoutId = await this.saveCurrentAsNewLoadout(actor, spellcastingEntryId, currentEntrySpells, loadout.name, loadout.description);
    await this.deleteLoadout(actor, spellcastingEntryId, loadoutId);

    return newLoadoutId;
  }

  /**
   * Delete a spell loadout
   * @param {Actor} actor - The actor to delete the spell loadout from
   * @param {string} spellcastingEntryId - The spellcasting entry id where the loadout is stored
   * @param {string} loadoutId - The ID of the spell loadout to delete
   * @returns {Promise<boolean>} - Whether the deletion was successful
   */
  static async deleteLoadout(actor, spellcastingEntryId, loadoutId) {
    const loadouts = this.getSpellLoadouts(actor, spellcastingEntryId);
    if (!loadouts[loadoutId]) return false;
    
    const allLoadouts = this._deepClone(this._getAllLoadouts(actor));
    const updatedLoadouts = this._deepClone(allLoadouts[spellcastingEntryId] || {});
    delete updatedLoadouts[loadoutId];
    allLoadouts[spellcastingEntryId] = updatedLoadouts;
    if (Object.keys(updatedLoadouts).length === 0) {
      delete allLoadouts[spellcastingEntryId];
    }
    
    // Update the actor's flags
    await actor.unsetFlag(MODULE_ID, settings.flagNames.loadouts);
    await actor.setFlag(MODULE_ID, settings.flagNames.loadouts, allLoadouts);
    
    // Ensure the flag update is fully processed before returning
    // This gives Foundry's event system a chance to fully synchronize the data
    return true;
  }

  /**
   * Clear all module-related flags for this actor.
   * @param {Actor} actor
   * @returns {Promise<boolean>} - Whether anything was cleared
   */
  static async clearAllSpellLoadouts(actor) {
    await actor.unsetFlag(MODULE_ID, settings.flagNames.loadouts);
    return true;
  }

  /**
   * Rename a spell loadout
   * @param {Actor} actor - The actor to rename the spell loadout for
   * @param {string} spellcastingEntryId - The spellcasting entry id where the loadout is stored
   * @param {string} loadoutId - The ID of the spell loadout to rename
   * @param {string} newName - The new name for the spell loadout
   * @param {string} newDescription - Optional new description
   * @returns {Promise<boolean>} - Whether the rename was successful
   */
  static async renameSpellLoadout(actor, spellcastingEntryId, loadoutId, newName, newDescription = null) {
    const loadouts = this.getSpellLoadouts(actor, spellcastingEntryId);
    if (!loadouts[loadoutId]) return false;
    
    const allLoadouts = this._deepClone(this._getAllLoadouts(actor));
    const updatedLoadouts = this._deepClone(allLoadouts[spellcastingEntryId] || {});
    
    // Update the name
    updatedLoadouts[loadoutId].name = newName;
    
    // Update the description if provided
    if (newDescription !== null) {
      updatedLoadouts[loadoutId].description = newDescription;
    }
    
    // Update the actor's flags
    allLoadouts[spellcastingEntryId] = updatedLoadouts;
    await actor.unsetFlag(MODULE_ID, settings.flagNames.loadouts);
    await actor.setFlag(MODULE_ID, settings.flagNames.loadouts, allLoadouts);
    
    return true;
  }

  /**
   * Duplicate a spell loadout
   * @param {Actor} actor - The actor to duplicate the spell loadout for
   * @param {string} spellcastingEntryId - The spellcasting entry id where the loadout is stored
   * @param {string} loadoutId - The ID of the spell loadout to duplicate
   * @param {string} newName - The name for the new spell loadout
   * @param {string} newDescription - Optional description for the new spell loadout
   * @returns {Promise<string>} - The ID of the newly created spell loadout
   */
  static async duplicateSpellLoadout(actor, spellcastingEntryId, loadoutId, newName, newDescription = null) {
    const loadout = this.getLoadout(actor, spellcastingEntryId, loadoutId);
    if (!loadout) return null;
    
    // Generate a unique ID for the new loadout
    const newLoadoutId = foundry.utils.randomID();
    
    // Create a deep copy of the loadout
    const newLoadout = this._deepClone(loadout);
    
    // Update the new loadout properties
    newLoadout.id = newLoadoutId;
    newLoadout.name = newName;
    if (newDescription !== null) {
      newLoadout.description = newDescription;
    }
    newLoadout.created = Date.now();
    
    // Save the new loadout with a deep clone to avoid reference issues
    const allLoadouts = this._deepClone(this._getAllLoadouts(actor));
    const updatedLoadouts = this._deepClone(allLoadouts[spellcastingEntryId] || {});
    updatedLoadouts[newLoadoutId] = newLoadout;
    allLoadouts[spellcastingEntryId] = updatedLoadouts;
    
    await actor.unsetFlag(MODULE_ID, settings.flagNames.loadouts);
    await actor.setFlag(MODULE_ID, settings.flagNames.loadouts, allLoadouts);
    
    return newLoadoutId;
  }

  /**
   * Apply one saved spell loadout to one spellcasting entry.
   * @param {Actor} actor
   * @param {string} spellcastingEntryId
   * @param {Object} savedEntry
   * @returns {Promise<boolean>}
   * @private
   */
  static async _applyLoadoutToEntry(actor, spellcastingEntryId, savedEntry) {
    if (!savedEntry) return false;

    const entry = (actor.itemTypes.spellcastingEntry || []).find(e => e.id === spellcastingEntryId);
    if (!entry || entry.system.prepared?.value !== "prepared") return false;

    const spellcasting = actor.spellcasting?.collections?.find(sc => sc.id === spellcastingEntryId);
    if (!spellcasting) return false;

    const isFlexible = entry.system.prepared?.flexible === true;
    const missingSpells = new Set();
    const addMissingSpell = (spellName, reasonKey) => {
      const name = spellName?.name || game.i18n.localize("PREPPER.loadout.unknownSpell");
      const id =  spellName?.id || "-";
      const reason = game.i18n.localize(reasonKey);
      missingSpells.add(`- ${name} (${id}): ${reason}`);
    };

    if (isFlexible) {
      try {
        const spellsToInclude = new Set();
        for (const levelObj of savedEntry.levels || []) {
          for (const spellData of (levelObj.spells || [])) {
            if (!spellData?.id) {
              addMissingSpell(spellData, "PREPPER.loadout.loadWarning.reasonBadSpell");
              continue;
            }

            const spell = actor.items.get(spellData.id);
            if (!spell) {
              addMissingSpell(spellData, "PREPPER.loadout.loadWarning.reasonNotOnActor");
              continue;
            }

            spellsToInclude.add(spellData.id);
          }
        }

        if (spellcasting.size > 0) {
          for (const spell of spellcasting.contents) {
            const shouldPrepare = spellsToInclude.has(spell.id);
            await spell.update({
              "system.location.signature": shouldPrepare
            });
          }
        }

        this._showMissingSpellsWarning(missingSpells);
        return true;
      } catch (e) {
        error(`Failed to update spell signature: ${e.message}`);
        return false;
      }
    }

    if (!spellcasting.prepareSpell) return false;

    try {
      const levels = Array.from({ length: 10 }, (_, i) => i + 1);
      const entrySlots = entry.system.slots || {};

      // Clear all currently prepared slots first, including levels not present in the saved loadout.
      for (const level of levels) {
        const slotKey = `slot${level}`;
        const slots = entrySlots[slotKey];
        if (!slots) continue;

        const prepared = slots.prepared || [];
        for (let slotIndex = prepared.length - 1; slotIndex >= 0; slotIndex--) {
          await spellcasting.prepareSpell(null, level, slotIndex);
        }
      }

      // Apply saved spells after clearing.
      for (const levelObj of (savedEntry.levels || [])) {
        const level = Number(levelObj.level);
        const slotKey = `slot${level}`;
        const slots = entrySlots[slotKey];
        if (!slots) continue;

        const savedSpellCount = levelObj.spells?.length || 0;
        for (let slotIndex = 0; slotIndex < savedSpellCount; slotIndex++) {
          const spellData = levelObj.spells[slotIndex];
          if (!spellData?.id) {
            addMissingSpell(spellData, "PREPPER.loadout.loadWarning.reasonBadSpell");
            continue;
          }

          if (slotIndex >= slots.max) {
            addMissingSpell(spellData, "PREPPER.loadout.loadWarning.reasonNoSlot");
            continue;
          }

          const spell = actor.items.get(spellData.id);
          if (!spell) {
            addMissingSpell(spellData, "PREPPER.loadout.loadWarning.reasonNotOnActor");
            continue;
          }

          if (spell.type !== "spell") {
            addMissingSpell(spellData, "PREPPER.loadout.loadWarning.reasonBadSpell");
            continue;
          }

          await spellcasting.prepareSpell(spell, level, slotIndex);
        }
      }

      this._showMissingSpellsWarning(missingSpells);
      return true;
    } catch (e) {
      error(`Failed to prepare spell via API: ${e.message}`);
      return false;
    }
  }
}
