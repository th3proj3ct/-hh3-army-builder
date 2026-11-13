/**
 * Import unit profiles (role, allegiance, Faction, model tags, points, options) from
 * the BSData horus-heresy-3rd-edition repo (NewRecruit JSON) into this app's catalog
 * format. Rules logic (BattleScribe modifiers/constraints) is NOT imported: the
 * validator owns the rules. Anything that can't be mapped exactly is written to
 * data/bsdata/IMPORT-REPORT.md instead of being guessed silently.
 *
 *   node scripts/import-bsdata.ts <path-to-bsdata-repo> [Catalogue.json ...]
 *
 * Default catalogues: "Legiones Astartes.json" and "Death Guard.json".
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BattlefieldRole, OptionDef, UnitDef } from '../src/model';

type Node = Record<string, any>;

const ROLE_BY_CATEGORY: Record<string, BattlefieldRole> = {
  Warlord: 'Warlord',
  'High Command': 'HighCommand',
  Command: 'Command',
  Retinue: 'Retinue',
  Elites: 'Elites',
  'War-engine': 'WarEngine',
  'War Engine': 'WarEngine',
  Troops: 'Troops',
  Support: 'Support',
  'Lord of War': 'LordOfWar',
  Transport: 'Transport',
  'Heavy Assault': 'HeavyAssault',
  'Heavy Transport': 'HeavyTransport',
  Armour: 'Armour',
  Recon: 'Recon',
  'Fast Attack': 'FastAttack',
};
const LEGIONS = [
  'Dark Angels', "Emperor's Children", 'Iron Warriors', 'White Scars', 'Space Wolves', 'Imperial Fists',
  'Night Lords', 'Blood Angels', 'Iron Hands', 'World Eaters', 'Ultramarines', 'Death Guard',
  'Thousand Sons', 'Sons of Horus', 'Word Bearers', 'Salamanders', 'Raven Guard', 'Alpha Legion',
];
const POINTS = '9893-c379-920b-8982';

const [repo, ...requested] = process.argv.slice(2);
if (!repo) {
  console.error('usage: node scripts/import-bsdata.ts <bsdata-repo> [Catalogue.json ...]');
  process.exit(1);
}
const catalogueFiles = requested.length ? requested : ['Legiones Astartes.json', 'Death Guard.json'];

// ── index every named node across the repo so entryLinks resolve ───────────
const byId = new Map<string, Node>();
const index = (o: unknown) => {
  if (Array.isArray(o)) o.forEach(index);
  else if (o && typeof o === 'object') {
    const n = o as Node;
    if (typeof n.id === 'string' && typeof n.name === 'string' && !byId.has(n.id)) byId.set(n.id, n);
    Object.values(n).forEach(index);
  }
};
for (const f of readdirSync(repo).filter((f) => f.endsWith('.json'))) index(JSON.parse(readFileSync(join(repo, f), 'utf8')));

const sha = execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();

// ── report ──────────────────────────────────────────────────────────────────
const report: Record<string, string[]> = {};
const note = (unit: string, msg: string) => (report[unit] ??= []).push(msg);
let skippedHidden = 0;

// ── helpers ─────────────────────────────────────────────────────────────────
const slug = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cost = (n: Node): number => (n.costs ?? []).find((c: Node) => c.typeId === POINTS || String(c.name).startsWith('Point'))?.value ?? 0;
const parentLimit = (n: Node, type: 'min' | 'max'): number | undefined =>
  (n.constraints ?? []).find((c: Node) => c.type === type && c.field === 'selections' && c.scope === 'parent')?.value;
const hasCostModifier = (n: Node) => (n.modifiers ?? []).some((m: Node) => m.field === POINTS);
const isHidden = (n: Node) => n.hidden === true;

/** A link resolved to its target, with the link's own constraints/hidden/costs layered on top. */
function resolve(n: Node): Node | undefined {
  if (!n.targetId) return n;
  const target = byId.get(n.targetId);
  if (!target) return undefined;
  return {
    ...target,
    name: n.name ?? target.name,
    hidden: n.hidden ?? target.hidden,
    constraints: [...(target.constraints ?? []), ...(n.constraints ?? [])],
    modifiers: [...(target.modifiers ?? []), ...(n.modifiers ?? [])],
    costs: n.costs?.length ? n.costs : target.costs,
    categoryLinks: [...(target.categoryLinks ?? []), ...(n.categoryLinks ?? [])],
  };
}
function children(n: Node): { node: Node; group: boolean }[] {
  const out: { node: Node; group: boolean }[] = [];
  for (const e of n.selectionEntries ?? []) out.push({ node: e, group: false });
  for (const g of n.selectionEntryGroups ?? []) out.push({ node: g, group: true });
  for (const l of n.entryLinks ?? []) {
    if (l.type === 'profile' || l.type === 'rule' || l.type === 'infoGroup') continue;
    const r = resolve(l);
    if (r) out.push({ node: r, group: l.type === 'selectionEntryGroup' });
  }
  return out;
}
/** All purchasable leaves under a node (flattening nested groups and links). */
function leaves(n: Node): Node[] {
  const out: Node[] = [];
  for (const { node, group } of children(n)) {
    if (isHidden(node)) {
      skippedHidden++;
      continue;
    }
    if (group) out.push(...leaves(node));
    else out.push(node);
  }
  return out;
}
const modelTagsOf = (n: Node): string[] =>
  (n.categoryLinks ?? [])
    .map((c: Node) => /^(.*?) Model (Sub-)?Type$/i.exec(String(c.name))?.[1])
    .filter(Boolean)
    .map((t: string) => t.trim());

// ── one unit ────────────────────────────────────────────────────────────────
interface ModelInfo { node: Node; min: number; max: number; cost: number }

function collectModels(unit: Node): ModelInfo[] {
  const models: ModelInfo[] = [];
  const walk = (n: Node, inGroup: boolean) => {
    for (const { node, group } of children(n)) {
      if (group) walk(node, true);
      else if (node.type === 'model') {
        const min = parentLimit(node, 'min') ?? 0;
        const max = parentLimit(node, 'max') ?? min;
        if (inGroup) note(unit.name, `model "${node.name}" sits in a choice group; counted as if always present`);
        if ((node.modifiers ?? []).some((m: Node) => m.field !== 'category' && m.type !== 'add'))
          note(unit.name, `model "${node.name}" has modifiers (size/cost may change by Legion or upgrade); base values used`);
        models.push({ node, min, max, cost: cost(node) });
      }
    }
  };
  walk(unit, false);
  return models;
}

function optionsFor(unitName: string, unitId: string, models: ModelInfo[], unit: Node): OptionDef[] {
  const opts: OptionDef[] = [];
  const used = new Set<string>();
  const add = (o: OptionDef) => {
    let id = o.id;
    for (let i = 2; used.has(id); i++) id = `${o.id}-${i}`;
    used.add(id);
    opts.push({ ...o, id });
  };
  const variable = models.filter((m) => m.max > m.min);

  const fromContainer = (container: Node, owner: ModelInfo | null, path: string) => {
    for (const { node, group } of children(container)) {
      if (isHidden(node)) {
        skippedHidden++;
        continue;
      }
      if (node.type === 'model') continue;
      if (node.name === 'Prime Unit' || /Detachment Choice/.test(node.name)) continue;
      const perOwner = owner ? (owner.min === owner.max ? owner.max : 'models' as const) : 1;
      const label = owner ? `${owner.node.name}: ` : '';
      if (group) {
        const defId = node.defaultSelectionEntryId;
        const gmax = parentLimit(node, 'max');
        const isExchange = Boolean(defId) || (gmax !== undefined && (parentLimit(node, 'min') ?? 0) >= 1);
        if (!isExchange) {
          fromContainer(node, owner, `${path}/${slug(node.name)}`);
          continue;
        }
        const groupKey = `${unitId}/${owner ? slug(owner.node.name) : 'unit'}/${slug(node.name)}`;
        const k = gmax ?? 1;
        const cap = perOwner === 'models' ? ('models' as const) : perOwner * k;
        for (const leaf of leaves(node)) {
          const p = cost(leaf);
          if (leaf.id === defId || p === 0) continue;
          if (hasCostModifier(leaf)) note(unitName, `"${leaf.name}" cost changes under some conditions; base ${p} used`);
          const leafMax = parentLimit(leaf, 'max');
          let max: number | 'models' = cap;
          const unitMax = (leaf.constraints ?? []).find((c: Node) => c.type === 'max' && c.scope === 'unit');
          if (unitMax) {
            const rep = (leaf.modifiers ?? []).find((m: Node) => m.field === unitMax.id && m.repeats?.length);
            const per = rep?.repeats?.[0]?.value;
            const totalMax = models.reduce((s, m) => s + m.max, 0);
            max = per ? Math.floor(totalMax / per) * (rep.value ?? 1) + unitMax.value : unitMax.value;
            note(unitName, `"${leaf.name}" cap scales with unit size; ${max} used (the cap at maximum size)`);
          } else if (leafMax !== undefined && typeof cap === 'number') max = Math.min(cap, leafMax * (owner?.max ?? 1));
          add({ id: `${owner ? slug(owner.node.name) + '--' : ''}${slug(leaf.name)}`, name: `${label}${leaf.name}`, cost: { points: p, per: owner ? 'model' : 'unit' }, max, group: groupKey, groupMax: cap });
        }
      } else {
        const p = cost(node);
        if (node.type === 'upgrade' && p === 0) continue;
        if (p === 0) {
          // A free container entry (e.g. "Options") may still hold priced children.
          if (children(node).length) fromContainer(node, owner, `${path}/${slug(node.name)}`);
          continue;
        }
        if (hasCostModifier(node)) note(unitName, `"${node.name}" cost changes under some conditions; base ${p} used`);
        const m = parentLimit(node, 'max') ?? 1;
        const max: number | 'models' = owner ? (owner.min === owner.max ? owner.max * m : 'models') : m;
        add({ id: `${owner ? slug(owner.node.name) + '--' : ''}${slug(node.name)}`, name: `${label}${node.name}`, cost: { points: p, per: owner ? 'model' : 'unit' }, max });
      }
    }
  };
  for (const m of models) fromContainer(m.node, m, slug(m.node.name));
  fromContainer(unit, null, 'unit');
  if (variable.length > 1) note(unitName, `options on ${variable.map((v) => v.node.name).join(' / ')} are capped by total unit size, not per model type`);
  return opts;
}

function importUnit(link: Node, catalogueName: string, role: BattlefieldRole, factionFromLink: string | null): UnitDef | undefined {
  const unit = resolve(link);
  if (!unit) return undefined;
  const cats = [...(unit.categoryLinks ?? []).map((c: Node) => String(c.name))];
  const allegiance = cats.includes('Traitor') ? 'Traitor' : cats.includes('Loyalist') ? 'Loyalist' : 'Any';
  const models = collectModels(unit);
  if (!models.length) {
    note(unit.name, 'no model entries found; skipped');
    return undefined;
  }
  const minModels = models.reduce((s, m) => s + m.min, 0);
  const maxModels = models.reduce((s, m) => s + m.max, 0);
  const base = cost(unit) + models.reduce((s, m) => s + m.min * m.cost, 0);
  const variable = models.filter((m) => m.max > m.min);
  const perExtra = variable[0]?.cost ?? 0;
  if (new Set(variable.map((v) => v.cost)).size > 1)
    note(unit.name, `extra models cost different amounts (${variable.map((v) => `${v.node.name} ${v.cost}`).join(', ')}); ${perExtra} per extra model used`);
  if (hasCostModifier(unit)) note(unit.name, 'unit cost changes under some conditions; base used');
  const id = slug(unit.name);
  const tags = [...new Set(models.flatMap((m) => modelTagsOf(m.node)))];
  return {
    id,
    name: unit.name,
    armyList: 'legiones-astartes',
    role,
    allegiance,
    factionTrait: factionFromLink,
    modelTags: tags,
    ...((unit.entryLinks ?? []).some((l: Node) => l.name === 'Inductii') || /Inductii/.test(unit.name) ? { rules: ['Inductii'] } : {}),
    points: { base, minModels, maxModels, perExtraModel: perExtra },
    options: optionsFor(unit.name, id, models, unit),
    source: { book: 'BSData horus-heresy-3rd-edition', version: sha, section: `${catalogueName.trim()} › ${unit.name}` },
  };
}

// ── run ─────────────────────────────────────────────────────────────────────
const units = new Map<string, UnitDef>();
const skippedLinks: string[] = [];
for (const file of catalogueFiles) {
  const doc = JSON.parse(readFileSync(join(repo, file), 'utf8'));
  const cat = doc.catalogue ?? doc.gameSystem;
  // Units defined in a Legion's own catalogue belong to that Legion even when the
  // link doesn't carry the trait (e.g. Mortus Poisoner Squad, Death Guard Inductii).
  const catalogueLegion = LEGIONS.find((l) => String(cat.name).includes(l)) ?? null;
  const ownEntries = new Set((cat.sharedSelectionEntries ?? []).map((e: Node) => e.id));
  for (const link of cat.entryLinks ?? []) {
    const linkCats = (link.categoryLinks ?? []) as Node[];
    const primary = linkCats.find((c) => c.primary)?.name as string | undefined;
    const role = primary ? ROLE_BY_CATEGORY[primary] : undefined;
    if (!role) {
      skippedLinks.push(`${file}: ${link.name} (category "${primary ?? 'none'}")`);
      continue;
    }
    const faction =
      linkCats.map((c) => String(c.name)).find((n) => LEGIONS.includes(n)) ??
      (ownEntries.has(link.targetId) ? catalogueLegion : null);
    const def = importUnit(link, cat.name, role, faction);
    if (!def) continue;
    const prev = units.get(def.id);
    if (prev && prev.role !== def.role) note(def.name, `linked with two roles (${prev.role}, ${def.role}); kept ${prev.role}`);
    if (!prev) units.set(def.id, def);
  }
}

const outDir = join(import.meta.dirname, '..', 'data', 'bsdata');
mkdirSync(outDir, { recursive: true });
const sorted = [...units.values()].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(outDir, 'units.json'), JSON.stringify({ source: 'https://github.com/BSData/horus-heresy-3rd-edition', commit: sha, catalogues: catalogueFiles, units: sorted }, null, 2) + '\n');

const lines = [
  '# BSData import report',
  '',
  `Commit \`${sha}\`, catalogues: ${catalogueFiles.join(', ')}. Units imported: **${sorted.length}**. Hidden (Legion-conditional) option entries skipped: ${skippedHidden}.`,
  '',
  'Generated by `scripts/import-bsdata.ts`. Do not edit by hand. Every line below is a place where the import is approximate; check those units by hand before trusting their points.',
  '',
  '## Root entries not imported (not a plain Battlefield Role)',
  '',
  ...skippedLinks.map((s) => `- ${s}`),
  '',
  '## Per-unit notes',
  '',
  ...Object.entries(report).sort(([a], [b]) => a.localeCompare(b)).flatMap(([u, msgs]) => [`### ${u}`, ...[...new Set(msgs)].map((m) => `- ${m}`), '']),
];
writeFileSync(join(outDir, 'IMPORT-REPORT.md'), lines.join('\n'));
console.log(`Imported ${sorted.length} units from ${catalogueFiles.join(', ')} @ ${sha}; ${Object.keys(report).length} units with notes, ${skippedLinks.length} links skipped.`);
