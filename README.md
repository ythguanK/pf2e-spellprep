# PF2e SpellPrep

Save, name, and instantly swap **prepared spell loadouts** for Pathfinder 2e prepared spellcasters in Foundry VTT.

Prepared casters (Wizard, Witch, Cleric, Druid, Magus, …) re-choose their spells during Daily Preparations. Doing that by hand can take 20–30 minutes of real time and stalls the whole table. PF2e SpellPrep lets a player set up named loadouts once: **Combat**, **Social**, **Exploration**, *whatever-you-like*; and swap between them in a couple of clicks.

> **Target:** Foundry VTT **v14**, Pathfinder Second Edition (`pf2e`) system **8.x**.
> **Code is entirely AI-generated via Claude 4.8** Ignore references to "Fable 5.0" in the code, Claude has disassociative identity disorder as at 13th June 2026, probably due to Anthropic having to block 5.0 on the 12th because Anthropic won't bend the knee to Kegseth.
>Testing <u>was</u> performed by an actual human GM on both local and Forge-hosted copies of Foundry, but has been limited to classes present in my campaign.

## What it does
- Saves a spellcasting entry's current preparation as a named **Loadout** (with an optional description).
- Supports both standard **prepared** casting and **flexible** casting.
- Loadouts are stored **per spellcasting entry** (so multi-tradition characters and archetype dedications work).
- Manage loadouts: create, duplicate, rename, set-to-current, delete, and clear-all.
- Optionally includes your prepared **cantrips** in loadouts (toggle in the manager).
- **Import and export** loadouts and your known-spell list: JSON (lossless backup and transfer), Markdown (a readable reference), or everything at once as a zip.
- Optional **quick-load** (⚡) button on each prepared spellcasting entry.
- Integrates with **PF2e Dailies**: pick a loadout to apply as part of your Daily Preparations.
- Works with **PF2e Unified Spellbook**: the loadout button appears in its unified view too.

## Installation
In Foundry VTT, open **Add-on Modules → Install Module**, and paste this **Manifest URL**:

```
https://github.com/ythguanK/pf2e-spellprep/releases/latest/download/module.json
```

Click **Install**, then enable **PF2e SpellPrep** in your world under *Manage Modules*. The Pathfinder Second Edition (`pf2e`) system is required.

### For local development (build-free)
This module has **no build step**, so Foundry loads the source files directly, which allows very fast iteration on a locally installed version.
Instead of installing the released version, symlink the repository into your Foundry data directory; edit a file and reload the world to see changes:

```bash
ln -s /path/to/this/repo "/path/to/FoundryVTT/Data/modules/pf2e-spellprep"
```

> Don't run both at once: the dev symlink and a manifest-installed copy share the id `pf2e-spellprep` and will collide.

## Usage
1. Open a prepared spellcaster's character sheet → **Spellcasting** tab.
2. Click the **scroll** (📜) button on a prepared spellcasting entry to open the manager.
3. From **Current Preparation**, save the current spells as a new loadout.
4. Later, select a saved loadout and **Load to Actor** to apply it.

## Cantrips
Loadouts can include your prepared cantrips. Use the **Include Cantrips** toggle in the manager's left rail (on by default) to decide; when off, saving and loading loadouts leaves your cantrips untouched. Loadouts saved without cantrips never disturb your current cantrips on load.

## Import and export
From the manager's left rail, **Export** offers:
- **JSON: Loadouts** and **JSON: Known Spells**: lossless backups you can re-import (on the same character, or transferred to another). Importing loadouts merges them in; importing known spells adds any spells missing from the spellbook and skips those already present.
- **Markdown: Loadouts** and **Markdown: Known Spells**: a readable reference (a table per spell rank, then each spell's full detail). Export only.
- **Export All**: every available file bundled into a single `.zip`.

**Import** reads a JSON file and detects automatically whether it holds loadouts or known spells. The client setting **Sort JSON Exports Alphabetically** (on by default) controls the export order.

## PF2e Dailies integration
If you use the [PF2e Dailies](https://foundryvtt.com/packages/pf2e-dailies) module, SpellPrep can apply a loadout as part of your **Daily Preparations**, so swapping spells becomes one step of your normal rest.

**Enable it** (off by default):
1. **Game Settings → Configure Settings → Module Settings → PF2e SpellPrep**.
2. Tick **Enable PF2e Dailies Integration** and save (this is a world-level setting and reloads the world).

**Use it:**
- Open **Daily Preparations**. For each prepared spellcasting entry that has at least one saved loadout, a **Change Spell Loadout** row appears with a dropdown of that entry's loadouts.
- The default is **Keep current** (the row is not remembered between days). Pick a loadout and the chosen loadout is applied when you accept your daily preparations.

> Requires the PF2e Dailies module to be installed and active, and at least one saved loadout on the entry. (Verified with PF2e Dailies 4.18.1.)

## PF2e Unified Spellbook "integration"
SpellPrep works alongside [PF2e Unified Spellbook](https://foundryvtt.com/packages/pf2e-unified-spellbook), but it's a hack as Unified Spellbook doesn't have a module API. 
In its **Unified View**, the scroll (📜) button is added to each prepared spellcasting entry's sub-header (e.g. "Arcane Prepared Spells"). This is controlled by theSpellPrep setting **Unified Spellbook: Show Loadout Button** setting (on by default). If a future Unified Spellbook update changes its layout, it should fail safely and silently (the button simply stops appearing and nothing else is affected). Worst case you can turn it off.

## Notes
- Loadouts are stored in actor *flags* under this module.
- Loading a loadout replaces the current prepared slots (prepared casters) or signature spells (flexible casters) for that entry.
- If a saved spell is no longer on the actor (or can't be placed), a warning lists the affected spells and why.
- This is unlikely to be moved to the Bazaar as I'd have to purchase an anonymous Foundry licence.

### Coming from PF2e Prepper?
PF2e SpellPrep is **data-compatible** with [PF2e Prepper](https://github.com/robinsving/pf2e-prepper). If an actor has loadouts saved by PF2e Prepper, they appear automatically in SpellPrep, and your first edit migrates them into SpellPrep's own storage. Prepper's data is left untouched.

## Credits & license
PF2e SpellPrep is a fork of **[PF2e Prepper](https://github.com/robinsving/pf2e-prepper)** by **Robin Sving**, brought to Foundry v14 and rebranded. Full credit to Robin's AI LLM for the original work :D

Licensed under the **MIT License** (see [LICENSE](LICENSE)). Original copyright © 2025 Robin Sving; fork © 2026 ythguanK.
