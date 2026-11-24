/**
 * What a built unit carries, from its imported datasheet: shared by the datasheet viewer
 * and the text export. Datasheets are display-only and large, so they load on first use.
 */
import type { OptionDef, UnitInstance } from '../../src/model';

export interface Datasheet {
  models: { name: string; min: number; max: number; profile: Record<string, string> }[];
  wargear: { model: string; items: string[] }[];
  weapons: { name: string; kind: 'Ranged' | 'Melee'; stats: Record<string, string>; legions?: string[] }[];
  rules: { name: string; summary: string; legions?: string[]; whenSelected?: string; variants?: { when: string; name: string }[]; otherwise?: string }[];
  traits: string[];
  items?: Record<string, string[]>;
}

/** Full text of a special rule, keyed by ruleKey() ("shred (x)"). */
export type Glossary = Record<string, { name: string; text: string }>;
interface DatasheetFile {
  datasheets: Record<string, Datasheet>;
  glossary?: Glossary;
}

// Datasheets are display-only and large, so they load on first use (own bundle chunk).
let cache: Promise<DatasheetFile> | null = null;
const loadFile = () => (cache ??= import('../../data/bsdata/datasheets.json').then((m) => m.default as unknown as DatasheetFile));
export const loadDatasheets = () => loadFile().then((f) => f.datasheets);
export const loadGlossary = () => loadFile().then((f) => f.glossary ?? {});

/**
 * Glossary key: lower case, straight apostrophes, single spaces, and a trailing "(…)" value made
 * generic, so "Shred (6)" and "Shred (X)" share "shred (x)". Must match scripts/import-bsdata.ts.
 */
export const ruleKey = (name: string) =>
  name.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().replace(/\s*\([^)]*\)$/, ' (x)');
/** "Shred (6), Shock (Pinning, Suppressed)" → its rules, split at commas outside brackets. */
export const splitRules = (text: string) =>
  text.split(/,(?![^(]*\))|(?<=\))\s+(?=[A-Z])/).map((x) => x.trim()).filter((x) => x && x !== '-');
/** A rule's text, and its X value when the name carries one ("Shred (6)" → X = 6). */
export function lookupRule(glossary: Glossary, name: string): { name: string; text: string; x?: string } | undefined {
  const hit = glossary[ruleKey(name)] ?? glossary[`${ruleKey(name)} (x)`];
  if (!hit) return undefined;
  const x = /\(([^)]*)\)\s*$/.exec(name)?.[1];
  return { ...hit, ...(x && x.toUpperCase() !== 'X' && /\(X\)$/i.test(hit.name) ? { x } : {}) };
}

/**
 * Work out what a built unit carries: each model type's default kit, minus items swapped
 * out by exchange options, plus every option taken. Returns display lines and the set of
 * weapon profile names in use.
 */
export function buildLoadout(sheet: Datasheet, options: OptionDef[], inst: UnitInstance) {
  const optById = new Map(options.map((o) => [o.id, o]));
  // Model counts: each type at its minimum, extra models go to the first variable type.
  let spare = Math.max(0, inst.models - sheet.models.reduce((s, m) => s + m.min, 0));
  const counts = new Map<string, number>();
  for (const m of sheet.models) {
    const extra = m.max > m.min ? Math.min(spare, m.max - m.min) : 0;
    spare -= extra;
    counts.set(m.name, m.min + extra);
  }
  const unitKit = sheet.wargear.find((w) => w.model === 'Unit')?.items ?? [];
  const lines = sheet.models.map((m) => {
    const n = counts.get(m.name) ?? 0;
    const kit = new Map<string, number>();
    for (const it of [...(sheet.wargear.find((w) => w.model === m.name)?.items ?? []), ...unitKit]) kit.set(it, n);
    for (const sel of inst.options) {
      const o = optById.get(sel.optionId);
      if (!o?.display || (o.display.model ?? m.name) !== m.name) continue;
      kit.set(o.display.item, (kit.get(o.display.item) ?? 0) + sel.count);
      const swapped = o.display.replaces && [...kit.keys()].find((k) => k.toLowerCase() === o.display!.replaces!.toLowerCase());
      if (swapped) kit.set(swapped, Math.max(0, (kit.get(swapped) ?? 0) - sel.count));
    }
    const items = [...kit.entries()].filter(([, c]) => c > 0).map(([it, c]) => (c === n ? it : `${c}× ${it}`));
    return { model: m.name, count: n, items, kit };
  });
  // Unit-level options (no model), e.g. vehicle upgrades.
  const unitLevel = inst.options
    .map((sel) => ({ sel, o: optById.get(sel.optionId) }))
    .filter((x) => x.o?.display && !x.o.display.model && !sheet.models.some((m) => m.name === x.o!.display!.model));
  if (unitLevel.length && sheet.models.length > 1)
    lines.push({ model: 'Unit upgrades', count: 1, items: unitLevel.map((x) => `${x.sel.count > 1 ? `${x.sel.count}× ` : ''}${x.o!.display!.item}`), kit: new Map(unitLevel.map((x) => [x.o!.display!.item, x.sel.count])) });
  else if (unitLevel.length && lines[0]) {
    for (const x of unitLevel) lines[0].kit.set(x.o!.display!.item, x.sel.count);
    lines[0].items = [...lines[0].kit.entries()].filter(([, c]) => c > 0).map(([it, c]) => (c === lines[0]!.count ? it : `${c}× ${it}`));
  }
  const weapons = new Set<string>();
  const carriedItems = new Set<string>();
  for (const l of lines)
    for (const [it, c] of l.kit)
      if (c > 0) {
        carriedItems.add(it.toLowerCase());
        for (const w of sheet.items?.[it] ?? [it]) weapons.add(w);
      }
  return { lines: lines.filter((l) => l.count > 0 || l.items.length), weapons, carriedItems };
}

