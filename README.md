# PF2e SpellPrep

Save, name, and instantly swap **prepared spell loadouts** for Pathfinder 2e prepared spellcasters in Foundry VTT.

Prepared casters (Wizard, Witch, Cleric, Druid, Magus, …) re-choose their spells during Daily Preparations. Doing that by hand can take 20–30 minutes of real time and stalls the whole table. PF2e SpellPrep lets a player set up named loadouts once — **Combat**, **Social**, **Exploration**, whatever you like — and swap between them in a couple of clicks.

> **Target:** Foundry VTT **v14**, Pathfinder Second Edition (`pf2e`) system **8.x**.

## What it does
- Saves a spellcasting entry's current preparation as a named **Loadout** (with an optional description).
- Supports both standard **prepared** casting and **flexible** casting.
- Loadouts are stored **per spellcasting entry** (so multi-tradition characters and archetype dedications work).
- Manage loadouts: create, duplicate, rename, set-to-current, delete, and clear-all.
- Optional **quick-load** (⚡) button on each prepared spellcasting entry.
- Integrates with **PF2e Dailies**: pick a loadout to apply as part of your Daily Preparations.

## Installation (manual / build-free)
This module has **no build step** — Foundry loads the source directly.

1. Copy or symlink this folder into your Foundry data directory as `…/Data/modules/pf2e-spellprep`.
2. Launch Foundry, open your world, and enable **PF2e SpellPrep** in *Manage Modules*.

For development, a symlink is convenient — edit a file, reload Foundry (F5), done:
```bash
ln -s /path/to/this/repo "/path/to/FoundryVTT/Data/modules/pf2e-spellprep"
```

## Usage
1. Open a prepared spellcaster's character sheet → **Spellcasting** tab.
2. Click the **scroll** (📜) button on a prepared spellcasting entry to open the manager.
3. From **Current Preparation**, save the current spells as a new loadout.
4. Later, select a saved loadout and **Load to Actor** to apply it.

## Notes
- Loadouts are stored in actor *flags* under this module.
- Loading a loadout replaces the current prepared slots (prepared casters) or signature spells (flexible casters) for that entry.
- If a saved spell is no longer on the actor (or can't be placed), a warning lists the affected spells and why.

### Coming from PF2e Prepper?
PF2e SpellPrep is **data-compatible** with [PF2e Prepper](https://github.com/robinsving/pf2e-prepper). If an actor has loadouts saved by PF2e Prepper, they appear automatically in SpellPrep, and your first edit migrates them into SpellPrep's own storage — Prepper's data is left untouched.

## Credits & license
PF2e SpellPrep is a fork of **[PF2e Prepper](https://github.com/robinsving/pf2e-prepper)** by **Robin Sving**, brought to Foundry v14 and rebranded. Huge thanks to Robin for the original work.

Licensed under the **MIT License** (see [LICENSE](LICENSE)). Original copyright © 2025 Robin Sving; fork © 2026 ythguanK.
