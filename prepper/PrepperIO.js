import { MODULE_ID } from "./constants.js";
import PrepperStorage from "./PrepperStorage.js";

/**
 * Import/export helpers for spell loadouts: JSON (lossless, round-trippable) and
 * Markdown (export only, human-readable). Pure functions plus small browser file
 * helpers; no UI state.
 */

const EXPORT_SCHEMA = 1;

// ----------------------------------------------------------------------------
// small helpers
// ----------------------------------------------------------------------------

function capitalise(s) {
    if (!s) return "";
    return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function titleCase(slug) {
    return String(slug ?? "").split(/[-_\s]+/).map(capitalise).join(" ");
}

/** Human label for a trait slug, via PF2e's CONFIG if available. */
function traitLabel(slug) {
    const key = globalThis.CONFIG?.PF2E?.spellTraits?.[slug];
    if (key) {
        const label = game.i18n.localize(key);
        if (label && label !== key) return label;
    }
    return titleCase(slug);
}

function rankLabel(rank) {
    const n = Number(rank) || 0;
    return n === 0 ? "Cantrips" : `Rank ${n}`;
}

/**
 * Format a PF2e cast-time value for Markdown using standard Unicode glyphs that
 * render without the Pathfinder action font (macOS 15+/Win10+): 1/2/3 actions
 * -> ◆/◆◆/◆◆◆, free -> ◇, reaction -> ↻. Durations (e.g. "1 minute") pass through.
 */
function formatActions(time) {
    if (time == null || time === "") return "";
    const t = String(time).trim().toLowerCase();
    if (t === "reaction") return "↻";
    if (t === "free" || t === "0") return "◇";
    if (/^[1-3]$/.test(t)) return "◆".repeat(Number(t));
    const ranged = t.match(/^(\d)\s*to\s*(\d)$/);
    if (ranged) return `${"◆".repeat(Number(ranged[1]))} to ${"◆".repeat(Number(ranged[2]))}`;
    return String(time);
}

function sanitise(part) {
    return String(part ?? "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "export";
}

function entryName(actor, entryId) {
    return actor.items.get(entryId)?.name ?? "Spellcasting";
}

/** Whether JSON exports should be sorted alphabetically (client setting, default on). */
function sortAlpha() {
    try {
        return game.settings.get(MODULE_ID, "sortJsonAlphabetical") !== false;
    } catch (_e) {
        return true;
    }
}

/** Escape a value for use inside a Markdown table cell. */
function cell(value) {
    return String(value ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
}

/** Reduce PF2e enriched HTML to readable plain text. Best-effort. */
function htmlToText(html) {
    if (!html) return "";
    let text;
    try {
        const doc = new DOMParser().parseFromString(String(html), "text/html");
        text = doc.body?.textContent ?? "";
    } catch (_e) {
        text = String(html).replace(/<[^>]+>/g, " ");
    }
    return text
        // @UUID[...]{Label} / @Check[...]{Label} -> Label
        .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1")
        // @UUID[...] / @Check[...] without a label -> drop
        .replace(/@\w+\[[^\]]*\]/g, "")
        // inline rolls [[ ... ]] -> drop the wrapper
        .replace(/\[\[[^\]]*\]\]/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Extract the display fields PF2e shows for a spell (the spell-list columns).
 * Defensive: returns blanks rather than throwing if a path is absent.
 * NOTE: verify these paths against the installed PF2e version.
 */
function spellDetail(spell) {
    const sys = spell?.system ?? {};
    const actions = sys.time?.value != null ? String(sys.time.value) : "";
    const range = sys.range?.value != null ? String(sys.range.value) : "";

    let defense = "";
    const d = sys.defense;
    if (d?.save?.statistic) {
        defense = `${d.save.basic ? "basic " : ""}${capitalise(d.save.statistic)}`;
    } else if (d?.passive?.statistic) {
        defense = d.passive.statistic === "ac" ? "AC" : capitalise(d.passive.statistic);
    } else if (sys.save?.value) {
        // older PF2e shape
        defense = `${sys.save.basic ? "basic " : ""}${capitalise(sys.save.value)}`;
    }

    // Traits: rarity (if not common), traditions, then trait tags.
    const traitSlugs = [];
    if (sys.traits?.rarity && sys.traits.rarity !== "common") traitSlugs.push(sys.traits.rarity);
    for (const t of (sys.traits?.traditions ?? [])) traitSlugs.push(t);
    for (const t of (sys.traits?.value ?? [])) traitSlugs.push(t);
    const traits = traitSlugs.map(traitLabel).filter(Boolean).join(", ");

    // Area, e.g. "10-foot burst".
    let area = "";
    const a = sys.area;
    if (a && (a.value != null || a.type)) {
        area = `${a.value != null ? `${a.value}-foot ` : ""}${a.type ?? ""}`.trim();
        if (a.details) area += `${area ? ", " : ""}${a.details}`;
    }

    return { actions, range, defense, traits, area, description: htmlToText(sys.description?.value ?? "") };
}

// ----------------------------------------------------------------------------
// rank grouping
// ----------------------------------------------------------------------------

/** Group a loadout's stored spells by their prepared slot rank. */
function loadoutRankGroups(actor, loadout) {
    const byRank = new Map();
    for (const lvl of (loadout?.spellcastingEntry?.levels ?? [])) {
        const rank = Number(lvl.level) || 0;
        for (const ref of (lvl.spells ?? [])) {
            const spell = ref.id ? actor.items.get(ref.id) : null;
            const row = { name: spell?.name ?? ref.name ?? "Unknown Spell", ...spellDetail(spell) };
            if (!byRank.has(rank)) byRank.set(rank, []);
            byRank.get(rank).push(row);
        }
    }
    return [...byRank.entries()].sort((a, b) => a[0] - b[0]);
}

/** Group an entry's known/available spells (its spellbook) by base rank. */
function knownSpellRankGroups(actor, entryId) {
    const spells = (actor.itemTypes?.spell ?? []).filter(s => s.system?.location?.value === entryId);
    const byRank = new Map();
    for (const spell of spells) {
        // Cantrips store level.value = 1 but belong in their own group (rank 0).
        const isCantrip = (spell.system?.traits?.value ?? []).includes("cantrip");
        const rank = isCantrip ? 0 : (spell.system?.level?.value ?? 0);
        const row = { name: spell.name, ...spellDetail(spell) };
        if (!byRank.has(rank)) byRank.set(rank, []);
        byRank.get(rank).push(row);
    }
    for (const rows of byRank.values()) rows.sort((a, b) => a.name.localeCompare(b.name));
    return [...byRank.entries()].sort((a, b) => a[0] - b[0]);
}

// ----------------------------------------------------------------------------
// markdown rendering
// ----------------------------------------------------------------------------

function renderOverview(rankGroups, rankPrefix = "##") {
    let out = "";
    for (const [rank, rows] of rankGroups) {
        out += `${rankPrefix} ${rankLabel(rank)}\n\n`;
        out += `| Name | Actions | Defense | Range |\n| --- | --- | --- | --- |\n`;
        for (const r of rows) {
            out += `| ${cell(r.name)} | ${cell(formatActions(r.actions))} | ${cell(r.defense)} | ${cell(r.range)} |\n`;
        }
        out += `\n`;
    }
    return out;
}

function renderDetailed(rankGroups, rankPrefix = "##") {
    const cardPrefix = `${rankPrefix}#`;
    let out = "";
    for (const [rank, rows] of rankGroups) {
        out += `${rankPrefix} ${rankLabel(rank)}\n\n`;
        for (const r of rows) {
            const act = formatActions(r.actions);
            out += `${cardPrefix} ${r.name}${act ? ` (${act})` : ""}\n\n`;
            if (r.traits) out += `*${r.traits}*\n\n`;
            const meta = [];
            if (r.range) meta.push(`**Range** ${r.range}`);
            if (r.area) meta.push(`**Area** ${r.area}`);
            if (r.defense) meta.push(`**Defense** ${r.defense}`);
            if (meta.length) out += `${meta.join("; ")}\n\n`;
            out += `${r.description || "_No description._"}\n\n`;
        }
    }
    return out;
}

// ----------------------------------------------------------------------------
// public builders
// ----------------------------------------------------------------------------

/** Lossless JSON of all loadouts for an entry. */
export function buildLoadoutsJSON(actor, entryId) {
    let loadouts = PrepperStorage.getSpellLoadouts(actor, entryId) ?? {};
    if (sortAlpha()) {
        loadouts = Object.fromEntries(
            Object.entries(loadouts).sort((a, b) => (a[1]?.name || "").localeCompare(b[1]?.name || ""))
        );
    }
    const payload = {
        module: MODULE_ID,
        type: "loadouts",
        schema: EXPORT_SCHEMA,
        exportedAt: new Date().toISOString(),
        actorName: actor.name,
        entryName: entryName(actor, entryId),
        loadouts
    };
    return JSON.stringify(payload, null, 2);
}

/**
 * Parse and validate an exported JSON file, detecting whether it holds loadouts
 * or a known-spell list so the importer can route it.
 * @returns {{type: "loadouts", loadouts: Object} | {type: "known-spells", spells: Array}}
 */
export function parseExportFile(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (_e) {
        throw new Error(game.i18n.localize("PREPPER.io.errorParse"));
    }
    if (!data || data.module !== MODULE_ID) {
        throw new Error(game.i18n.localize("PREPPER.io.errorInvalid"));
    }
    if (data.type === "loadouts" && data.loadouts && typeof data.loadouts === "object") {
        return { type: "loadouts", loadouts: data.loadouts };
    }
    if (data.type === "known-spells" && Array.isArray(data.spells)) {
        return { type: "known-spells", spells: data.spells };
    }
    throw new Error(game.i18n.localize("PREPPER.io.errorInvalid"));
}

/** Markdown reference for all loadouts in an entry. Returns null if there are none. */
export function buildLoadoutsMarkdown(actor, entryId) {
    const loadouts = Object.values(PrepperStorage.getSpellLoadouts(actor, entryId) ?? {})
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (loadouts.length === 0) return null;

    let md = `# ${entryName(actor, entryId)}: Loadouts\n\n*${actor.name}*\n\n`;
    for (const loadout of loadouts) {
        const groups = loadoutRankGroups(actor, loadout);
        md += `## ${loadout.name}\n\n`;
        if (loadout.description) md += `${loadout.description}\n\n`;
        md += `### Overview\n\n${renderOverview(groups, "####") || "_No spells._\n\n"}`;
        md += `### Details\n\n${renderDetailed(groups, "####") || "_No spells._\n\n"}`;
    }
    return md.trimEnd() + "\n";
}

/** Markdown reference for an entry's known-spell list. Returns null if empty. */
export function buildKnownSpellsMarkdown(actor, entryId) {
    const groups = knownSpellRankGroups(actor, entryId);
    if (groups.length === 0) return null;

    let md = `# ${entryName(actor, entryId)}: Known Spells\n\n*${actor.name}*\n\n`;
    md += `# Overview\n\n${renderOverview(groups, "##")}`;
    md += `# Details\n\n${renderDetailed(groups, "##")}`;
    return md.trimEnd() + "\n";
}

/** Lossless JSON of an entry's known-spell list (its spellbook). */
export function buildKnownSpellsJSON(actor, entryId) {
    let spells = (actor.itemTypes?.spell ?? []).filter(s => s.system?.location?.value === entryId);
    if (sortAlpha()) spells = [...spells].sort((a, b) => a.name.localeCompare(b.name));
    const payload = {
        module: MODULE_ID,
        type: "known-spells",
        schema: EXPORT_SCHEMA,
        exportedAt: new Date().toISOString(),
        actorName: actor.name,
        entryName: entryName(actor, entryId),
        spells: spells.map(s => s.toObject())
    };
    return JSON.stringify(payload, null, 2);
}

// ----------------------------------------------------------------------------
// filenames + browser file I/O (version-independent)
// ----------------------------------------------------------------------------

export function loadoutsFilename(actor, entryId, ext) {
    return `${sanitise(actor.name)}-${sanitise(entryName(actor, entryId))}-loadouts.${ext}`;
}

export function knownSpellsFilename(actor, entryId, ext = "md") {
    return `${sanitise(actor.name)}-${sanitise(entryName(actor, entryId))}-known-spells.${ext}`;
}

/**
 * Save text content to a file. Prefers Foundry's saveDataToFile, which works in
 * both the desktop (Electron) app and the browser; a synthetic anchor download
 * does not reliably trigger a save in the Electron app. Falls back to a Blob +
 * anchor download if the helper is unavailable.
 */
export function downloadTextFile(filename, text, mime = "text/plain") {
    const save = foundry.utils?.saveDataToFile ?? globalThis.saveDataToFile;
    if (typeof save === "function") {
        save(text, mime, filename);
        return;
    }

    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Prompt for a file and resolve its text content (null if cancelled). */
export function pickTextFile(accept = ".json") {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.style.display = "none";
        document.body.appendChild(input);
        const cleanup = () => { if (input.parentNode) input.parentNode.removeChild(input); };
        input.addEventListener("change", async () => {
            const file = input.files?.[0] ?? null;
            cleanup();
            if (!file) { resolve(null); return; }
            try { resolve(await file.text()); } catch (_e) { resolve(null); }
        }, { once: true });
        input.addEventListener("cancel", () => { cleanup(); resolve(null); }, { once: true });
        input.click();
    });
}

// ----------------------------------------------------------------------------
// "Export All": a single ZIP, so only one save dialog is needed.
// Minimal STORE-method (uncompressed) ZIP writer; Foundry bundles no zip lib.
// ----------------------------------------------------------------------------

function crc32(bytes) {
    let crc = ~0;
    for (let i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (~crc) >>> 0;
}

function u16(n) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]); }
function u32(n) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]); }

function concatBytes(parts) {
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
}

/** Build an uncompressed ZIP from [{name, content}] text entries. */
function buildZip(files) {
    const enc = new TextEncoder();
    const locals = [];
    const central = [];
    let offset = 0;

    for (const f of files) {
        const nameBytes = enc.encode(f.name);
        const data = enc.encode(f.content);
        const crc = crc32(data);

        const local = concatBytes([
            u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
            u32(crc), u32(data.length), u32(data.length),
            u16(nameBytes.length), u16(0), nameBytes, data
        ]);
        locals.push(local);

        central.push(concatBytes([
            u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
            u32(crc), u32(data.length), u32(data.length),
            u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
            u32(offset), nameBytes
        ]));

        offset += local.length;
    }

    const centralBytes = concatBytes(central);
    const eocd = concatBytes([
        u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
        u32(centralBytes.length), u32(offset), u16(0)
    ]);

    return concatBytes([...locals, centralBytes, eocd]);
}

/** Build a ZIP of every available export (JSON always; Markdown when non-empty). */
export function buildExportAllZip(actor, entryId) {
    const base = `${sanitise(actor.name)}-${sanitise(entryName(actor, entryId))}`;
    const files = [
        { name: `${base}-loadouts.json`, content: buildLoadoutsJSON(actor, entryId) },
        { name: `${base}-known-spells.json`, content: buildKnownSpellsJSON(actor, entryId) }
    ];
    const mdLoadouts = buildLoadoutsMarkdown(actor, entryId);
    if (mdLoadouts) files.push({ name: `${base}-loadouts.md`, content: mdLoadouts });
    const mdKnown = buildKnownSpellsMarkdown(actor, entryId);
    if (mdKnown) files.push({ name: `${base}-known-spells.md`, content: mdKnown });
    return buildZip(files);
}

export function exportAllFilename(actor, entryId) {
    return `${sanitise(actor.name)}-${sanitise(entryName(actor, entryId))}-spellprep.zip`;
}
