# Upstream baseline

PF2e SpellPrep is a fork of [PF2e Prepper](https://github.com/robinsving/pf2e-prepper) by Robin Sving (MIT). The fork was taken as a flat snapshot rather than a git clone, so upstream changes are reviewed and ported by hand. This file records the upstream version the fork was last reconciled against and what was done with each upstream change.

## Current baseline: PF2e Prepper 2.0.0 (commit 963bd00, 2026-08-25)

Reconciled 2026-11-07. Upstream moved from 1.2.0 (the original fork point) to 2.0.0 in six commits.

| Upstream change | Decision |
|---|---|
| Cantrips in loadouts for prepared casters (slot0, group id `cantrips`) | Already in SpellPrep since v0.4.0, behind the **Include Cantrips** toggle. Kept SpellPrep's version. |
| Cantrips in loadouts for flexible casters (read from slot0, restored with `prepareSpell`; signature handling skips cantrips) | **Ported, with a fix.** Gated by the same Include Cantrips toggle. Upstream identifies cantrips by `system.level.value === 0`, which never matches in PF2e 8.x (a cantrip's level value is its base level, usually 1, and cantrip-ness is the `cantrip` trait / `isCantrip`). SpellPrep uses an `isCantrip` helper instead. Verified headlessly on Foundry 14.370 / PF2e 8.7.0 with `foundry-utils/spellprep-cantrip-test.mjs`. |
| `_prepareSlotLevel` helper shared by the clear-then-fill logic | **Ported**, adapted to SpellPrep's id-then-name spell resolution. |
| `formatVersion` stamped on saved loadouts, "Outdated format" badge, and a Loadout Format Changes settings menu | **Not ported.** Upstream needs these because loading an old loadout wipes the actor's cantrips. SpellPrep deliberately leaves cantrips untouched when a loadout has none stored, so there is nothing to warn about. |
| `compatibility.verified` raised to Foundry 14 | Already set in SpellPrep. |
| Vitest test suite and TODO.md removal | Not applicable: SpellPrep is build-free with no Node toolchain. |

## How to rebaseline

1. Fetch upstream and diff from the baseline commit above to `origin/main`, ignoring `package-lock.json`, `dist/` and `tests/`.
2. Port what is relevant, keeping SpellPrep's own behaviour where the two differ (notably the cantrip toggle and name-based spell matching).
3. Update the baseline commit and the table above.
