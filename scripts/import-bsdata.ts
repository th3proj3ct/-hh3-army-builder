/**
 * Import unit profiles (role, allegiance, Faction, model tags, points, options) from
 * the BSData horus-heresy-3rd-edition repo (NewRecruit JSON) into this app's catalog
 * format. Rules logic (BattleScribe modifiers/constraints) is NOT imported: the
 * validator owns the rules. Anything that can't be mapped exactly is written to
 * data/bsdata/IMPORT-REPORT.md instead of being guessed silently.
 *
 *   node scripts/import-bsdata.ts <path-to-bsdata-repo> [Catalogue.json ...]
 *
 * Default catalogues: "Legiones Astartes.json", every Legion's own catalogue, and "Mechanicum.json".
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
const catalogueFiles = requested.length ? requested : ['Legiones Astartes.json', ...LEGIONS.map((l) => `${l}.json`), 'Mechanicum.json'];
/** Catalogues that are their own army list (not a Legion of the Legiones Astartes list). */
const ARMY_LISTS: Record<string, { armyList: string; faction: string }> = {
  Mechanicum: { armyList: 'mechanicum', faction: 'Mechanicum' },
};
/** Mechanicum sub-factions ("Mechanicum - Sub-faction"): one per detachment. */
const SUB_FACTIONS = ['Archimandrite', 'Cybernetica', 'Lacrymaerta', 'Macrotek', 'Malagra', 'Myrmidax', 'Reductor'];
/** Name of the catalogue whose root entries are being imported. */
let currentCatalogue = '';

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
/** Catalogue id → Legion, for conditions like "force is an instance of XIV - Death Guard". */
const legionOfCatalogue = new Map<string, string>();
for (const f of readdirSync(repo).filter((f) => f.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(join(repo, f), 'utf8'));
  index(doc);
  const c = doc.catalogue;
  const legion = c && LEGIONS.find((l) => String(c.name).includes(l));
  if (legion) legionOfCatalogue.set(c.id, legion);
}

const sha = execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();

// ── report ──────────────────────────────────────────────────────────────────
const report: Record<string, string[]> = {};
const note = (unit: string, msg: string) => (report[unit] ??= []).push(msg);
let skippedHidden = 0;

// ── helpers ─────────────────────────────────────────────────────────────────
const slug = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isUnconditional = (m: Node) => !m.conditions?.length && !m.conditionGroups?.length && !m.repeats?.length;
/** Points cost, with unconditional cost modifiers applied (e.g. "increment points by 5"). */
const cost = (n: Node): number => {
  let v: number = (n.costs ?? []).find((c: Node) => c.typeId === POINTS || String(c.name).startsWith('Point'))?.value ?? 0;
  for (const m of n.modifiers ?? []) {
    if (m.field !== POINTS || !isUnconditional(m)) continue;
    if (m.type === 'set') v = Number(m.value);
    else if (m.type === 'increment') v += Number(m.value);
    else if (m.type === 'decrement') v -= Number(m.value);
  }
  return v;
};
const parentLimit = (n: Node, type: 'min' | 'max'): number | undefined =>
  (n.constraints ?? []).find((c: Node) => c.type === type && c.field === 'selections' && c.scope === 'parent')?.value;
const hasCostModifier = (n: Node) => (n.modifiers ?? []).some((m: Node) => m.field === POINTS && !isUnconditional(m));
const isHidden = (n: Node) => n.hidden === true;

// ── Legion visibility ───────────────────────────────────────────────────────
// BSData hides Legion armoury entries by default and shows them with a modifier
// such as `set hidden=false if force instanceOf "XIV - Death Guard"`. We evaluate
// those conditions once per Legion. Anything we can't evaluate counts as false,
// so unknown gates (Blackshields, Shattered Legions, upgrades) never leak through.
const ALL_LEGIONS = new Set(LEGIONS);
/** Legions whose armoury items get imported: those of the catalogues being imported. */
const importLegions = new Set(catalogueFiles.map((f) => LEGIONS.find((l) => f.includes(l))).filter(Boolean) as string[]);
interface Ctx { cats: Set<string> }
const catNames = (n: Node): string[] => (n.categoryLinks ?? []).map((c: Node) => String(c.name));

function condition(c: Node, legion: string, ctx: Ctx): boolean {
  const target = byId.get(c.childId);
  const name = String(target?.name ?? '');
  if (c.type === 'instanceOf' || c.type === 'notInstanceOf') {
    let v: boolean;
    const catLegion = legionOfCatalogue.get(c.childId);
    if (catLegion !== undefined) v = catLegion === legion;
    // The catalogue being imported is the force's own when it's an army list of its own
    // (Mechanicum: "hidden unless the force is Mechanicum"). Others (Blackshields…) are false.
    else if (target?.type === 'catalogue') v = name === currentCatalogue && name in ARMY_LISTS;
    else if (ctx.cats.has(name)) v = true;
    else if (['model', 'unit', 'parent', 'self', 'ancestor'].includes(c.scope)) v = false;
    else return false; // unknown: treat as not met
    return c.type === 'notInstanceOf' ? !v : v;
  }
  if (['atLeast', 'greaterThan', 'equalTo'].includes(c.type) && LEGIONS.includes(name)) return name === legion;
  return false;
}
function group(g: Node, legion: string, ctx: Ctx): boolean {
  const parts = [
    ...(g.conditions ?? []).map((c: Node) => condition(c, legion, ctx)),
    ...(g.conditionGroups ?? []).map((x: Node) => group(x, legion, ctx)),
  ];
  return g.type === 'or' ? parts.some(Boolean) : parts.every(Boolean);
}
const active = (m: Node, legion: string, ctx: Ctx) =>
  !m.repeats?.length &&
  (m.conditions ?? []).every((c: Node) => condition(c, legion, ctx)) &&
  (m.conditionGroups ?? []).every((g: Node) => group(g, legion, ctx));

/**
 * Points cost in context. Unconditional modifiers always apply. Conditional ones
 * apply when they resolve the same way for every Legion we'd show the entry to
 * (e.g. "set 10 if the unit has Free Power Weapon"); otherwise the base is kept
 * and the caller notes it as approximate.
 */
function costIn(n: Node, ctx: Ctx, legions: Set<string>): { points: number; approximate: boolean } {
  let v = cost(n);
  let approximate = false;
  const who = [...legions];
  for (const m of n.modifiers ?? []) {
    if (m.field !== POINTS || isUnconditional(m)) continue;
    if (m.repeats?.length) {
      approximate = true;
      continue;
    }
    const results = new Set(who.map((l) => active(m, l, ctx)));
    if (results.size > 1) {
      approximate = true;
      continue;
    }
    if (!results.has(true)) continue;
    if (m.type === 'set') v = Number(m.value);
    else if (m.type === 'increment') v += Number(m.value);
    else if (m.type === 'decrement') v -= Number(m.value);
  }
  return { points: v, approximate };
}

/** Legions for which this entry is shown. */
function visibleFor(n: Node, ctx: Ctx): Set<string> {
  const mods = (n.modifiers ?? []).filter((m: Node) => m.field === 'hidden' && m.type === 'set');
  if (!mods.length) return n.hidden === true ? new Set() : ALL_LEGIONS;
  const out = new Set<string>();
  for (const l of LEGIONS) {
    let hidden = n.hidden === true;
    for (const m of mods) if (active(m, l, ctx)) hidden = m.value === true || m.value === 'true';
    if (!hidden) out.add(l);
  }
  return out;
}
const intersect = (a: Set<string>, b: Set<string>) => (a === ALL_LEGIONS ? b : b === ALL_LEGIONS ? a : new Set([...a].filter((x) => b.has(x))));
/** Worth importing: shown for every Legion, or for at least one Legion we import. */
const relevant = (v: Set<string>) => v.size === LEGIONS.length || [...v].some((l) => importLegions.has(l));

/** A link resolved to its target, with the link's own constraints/hidden/costs layered on top. */
function resolve(n: Node): Node | undefined {
  if (!n.targetId) return n;
  const target = byId.get(n.targetId);
  if (!target) return undefined;
  return {
    ...target,
    name: n.name ?? target.name,
    // Hidden if either side says so (a link's `hidden: false` doesn't un-hide its target).
    hidden: n.hidden === true || target.hidden === true,
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
/** All purchasable leaves under a node (flattening nested groups and links), with the Legions that see each. */
function leaves(n: Node, ctx: Ctx = { cats: new Set() }, legions: Set<string> = ALL_LEGIONS): { node: Node; legions: Set<string> }[] {
  const out: { node: Node; legions: Set<string> }[] = [];
  for (const { node, group } of children(n)) {
    const vis = intersect(legions, visibleFor(node, ctx));
    if (!vis.size || !relevant(vis)) {
      skippedHidden++;
      continue;
    }
    if (group) out.push(...leaves(node, ctx, vis));
    else out.push({ node, legions: vis });
  }
  return out;
}
/** Option gate for a visibility set: undefined when every Legion sees it. */
const gate = (v: Set<string>) => (v.size === LEGIONS.length ? {} : { factionTraits: [...v].sort() });
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
        // Size is usually a parent-scope limit on the model; some units (Procurators) put the
        // whole unit's size on one model at unit scope instead.
        const unitScope = (type: 'min' | 'max'): number | undefined =>
          (node.constraints ?? []).find((c: Node) => c.type === type && c.field === 'selections' && c.scope === 'unit')?.value;
        const min = parentLimit(node, 'min') ?? unitScope('min') ?? 0;
        const max = parentLimit(node, 'max') ?? unitScope('max') ?? min;
        if (parentLimit(node, 'min') === undefined && unitScope('min') !== undefined)
          note(unit.name, `unit size ${min}–${max} read from "${node.name}" (unit-scope limit); upgraded models counted inside it`);
        if (inGroup) note(unit.name, `model "${node.name}" sits in a choice group; counted as if always present`);
        if ((node.modifiers ?? []).some((m: Node) => m.field !== 'category' && m.type !== 'add'))
          note(unit.name, `model "${node.name}" has modifiers (size/cost may change by Legion or upgrade); base values used`);
        models.push({ node, min, max, cost: cost(node) });
      }
    }
  };
  walk(unit, false);
  // A one-model unit whose model has no minimum (e.g. sits in a choice group) still has that model.
  if (models.length && models.every((m) => m.min === 0) && models.filter((m) => m.max >= 1).length === 1) {
    const only = models.find((m) => m.max >= 1)!;
    only.min = 1;
    note(unit.name, `no model has a minimum; counted as one "${only.node.name}"`);
  }
  if (!models.length) {
    // Batteries (e.g. Rapier Battery) are made of sub-units ("Rapier Crew", 1–4 at 40 pts),
    // not single models. Count each sub-unit as one element of the unit's size.
    for (const { node, group } of children(unit)) {
      if (group || node.type !== 'unit') continue;
      const min = parentLimit(node, 'min') ?? 0;
      const max = parentLimit(node, 'max') ?? min;
      note(unit.name, `made of "${node.name}" sub-units; unit size counts ${node.name}s (${min}–${max})`);
      models.push({ node, min, max, cost: cost(node) });
    }
  }
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

  const unitCats = catNames(unit);
  const fromContainer = (container: Node, owner: ModelInfo | null, path: string, legions: Set<string> = ALL_LEGIONS) => {
    const ctx: Ctx = { cats: new Set([...unitCats, ...(owner ? catNames(owner.node) : [])]) };
    for (const { node, group } of children(container)) {
      if (node.type === 'model') continue;
      const vis = intersect(legions, visibleFor(node, ctx));
      if (!vis.size || !relevant(vis)) {
        skippedHidden++;
        continue;
      }
      if (node.name === 'Prime Unit' || /Detachment Choice|Sub-faction/.test(node.name)) continue;
      const perOwner = owner ? (owner.min === owner.max ? owner.max : 'models' as const) : 1;
      const label = owner ? `${owner.node.name}: ` : '';
      if (group) {
        const defId = node.defaultSelectionEntryId;
        const gmax = parentLimit(node, 'max');
        const isExchange = Boolean(defId) || (gmax !== undefined && (parentLimit(node, 'min') ?? 0) >= 1);
        if (!isExchange) {
          fromContainer(node, owner, `${path}/${slug(node.name)}`, vis);
          continue;
        }
        const groupKey = `${unitId}/${owner ? slug(owner.node.name) : 'unit'}/${slug(node.name)}`;
        const k = gmax ?? 1;
        const cap = perOwner === 'models' ? ('models' as const) : perOwner * k;
        const groupLeaves = leaves(node, ctx, vis);
        // What an exchange swaps out: the group's default entry, or failing that its label
        // ("May exchange bolter for:" → "Bolter").
        const fromLabel = /exchange (?:its |their |this model's )?(.+?) for\b/i.exec(String(node.name))?.[1];
        const replaces =
          groupLeaves.find((x) => x.node.id === defId)?.node.name ??
          (fromLabel ? fromLabel.charAt(0).toUpperCase() + fromLabel.slice(1) : undefined);
        for (const { node: leaf, legions: leafVis } of groupLeaves) {
          const { points: p, approximate } = costIn(leaf, ctx, leafVis);
          if (leaf.id === defId || p === 0) continue;
          if (approximate) note(unitName, `"${leaf.name}" cost changes under some conditions; ${p} used`);
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
          add({ id: `${owner ? slug(owner.node.name) + '--' : ''}${slug(leaf.name)}`, name: `${label}${leaf.name}`, cost: { points: p, per: owner ? 'model' : 'unit' }, max, group: groupKey, groupMax: cap, ...gate(leafVis),
            display: { ...(owner ? { model: owner.node.name } : {}), item: leaf.name, ...(replaces ? { replaces } : {}) } });
        }
      } else {
        const { points: p, approximate } = costIn(node, ctx, vis);
        if (node.type === 'upgrade' && p === 0) continue;
        if (p === 0) {
          // A free container entry (e.g. "Options") may still hold priced children.
          if (children(node).length) fromContainer(node, owner, `${path}/${slug(node.name)}`, vis);
          continue;
        }
        if (approximate) note(unitName, `"${node.name}" cost changes under some conditions; ${p} used`);
        const m = parentLimit(node, 'max') ?? 1;
        const max: number | 'models' = owner ? (owner.min === owner.max ? owner.max * m : 'models') : m;
        add({ id: `${owner ? slug(owner.node.name) + '--' : ''}${slug(node.name)}`, name: `${label}${node.name}`, cost: { points: p, per: owner ? 'model' : 'unit' }, max, ...gate(vis),
          display: { ...(owner ? { model: owner.node.name } : {}), item: node.name } });
      }
    }
  };
  for (const m of models) fromContainer(m.node, m, slug(m.node.name));
  fromContainer(unit, null, 'unit');
  if (variable.length > 1) note(unitName, `options on ${variable.map((v) => v.node.name).join(' / ')} are capped by total unit size, not per model type`);
  return opts;
}

/**
 * Allegiance gates written as `hidden` modifiers on the root link, e.g. Decimator:
 * "hidden if the roster has Loyalist". Only modifiers whose every condition is a
 * Traitor/Loyalist roster check are read; anything else is left to the category test.
 */
function allegianceFromHidden(link: Node): 'Traitor' | 'Loyalist' | undefined {
  const mods = (link.modifiers ?? []).filter((m: Node) => m.field === 'hidden' && m.type === 'set' && (m.value === true || m.value === 'true'));
  const conds = (m: Node): Node[] => [...(m.conditions ?? []), ...(m.conditionGroups ?? []).flatMap((g: Node) => conds(g))];
  const isAllegianceCheck = (c: Node) => ['Traitor', 'Loyalist'].includes(String(byId.get(c.childId)?.name)) && c.scope === 'roster';
  const test = (c: Node, side: string) => {
    const has = String(byId.get(c.childId)?.name) === side ? 1 : 0;
    if (c.type === 'atLeast') return has >= c.value;
    if (c.type === 'greaterThan') return has > c.value;
    if (c.type === 'equalTo') return has === c.value;
    if (c.type === 'lessThan') return has < c.value;
    return false;
  };
  const evalGroup = (g: Node, side: string): boolean => {
    const parts = [...(g.conditions ?? []).map((c: Node) => test(c, side)), ...(g.conditionGroups ?? []).map((x: Node) => evalGroup(x, side))];
    return g.type === 'or' ? parts.some(Boolean) : parts.every(Boolean);
  };
  const hiddenFor = (side: string) =>
    mods.some((m: Node) => conds(m).length > 0 && conds(m).every(isAllegianceCheck) && evalGroup({ ...m, type: 'and' }, side));
  const l = hiddenFor('Loyalist');
  const t = hiddenFor('Traitor');
  return l && !t ? 'Traitor' : t && !l ? 'Loyalist' : undefined;
}

/** Sub-faction: fixed by a category on the unit or its models, or chosen from a "Sub-faction" group. */
function subFactionOf(unit: Node, models: ModelInfo[]): { subFaction?: string; subFactions?: string[] } {
  const cats = new Set([...catNames(unit), ...models.flatMap((m) => catNames(m.node))]);
  const fixed = SUB_FACTIONS.filter((s) => cats.has(s));
  if (fixed.length === 1) return { subFaction: fixed[0] };
  const group = children(unit).find((c) => c.group && /Sub-faction/.test(String(c.node.name)));
  if (!group) return {};
  const names = leaves(group.node).map((x) => String(x.node.name)).filter((n) => SUB_FACTIONS.includes(n));
  return names.length ? { subFactions: [...new Set(names)].sort() } : {};
}

function importUnit(link: Node, catalogueName: string, role: BattlefieldRole, factionFromLink: string | null, armyList: string, idSuffix?: string): UnitDef | undefined {
  const unit = resolve(link);
  if (!unit) return undefined;
  const cats = [...(unit.categoryLinks ?? []).map((c: Node) => String(c.name))];
  const allegiance = cats.includes('Traitor') ? 'Traitor' : cats.includes('Loyalist') ? 'Loyalist' : allegianceFromHidden(link) ?? 'Any';
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
  const id = slug(unit.name) + (idSuffix ? `-${slug(idSuffix)}` : '');
  if (!datasheets[id]) datasheets[id] = datasheetFor(unit, models);
  // Officer of the Line (X): unconditional on the unit → X Auxiliary unlocks from a Command slot.
  // Some catalogues (Mechanicum) carry it as a category on the unit instead of a rule link.
  const officer =
    datasheets[id]!.rules.find((r) => !r.whenSelected && !r.legions && /^Officer of the Line \((\d+)\)$/.test(r.name))?.name ??
    cats.find((c) => /^Officer of the Line \((\d+)\)$/.test(c));
  const commandAuxUnlocks = officer ? Number(/\((\d+)\)/.exec(officer)![1]) : undefined;
  // Other unlock-changing rules, when the unit always has them.
  const always = (re: RegExp) => datasheets[id]!.rules.find((r) => !r.whenSelected && !r.legions && re.test(r.name))?.name;
  const consul = always(/^Consul-Delegatus$/);
  const tank = always(/^Tank Commander \((\d+)\)$/);
  const tags = [...new Set(models.flatMap((m) => modelTagsOf(m.node)))];
  return {
    id,
    name: unit.name,
    armyList,
    role,
    allegiance,
    factionTrait: factionFromLink,
    modelTags: tags,
    ...subFactionOf(unit, models),
    // List-building facts the validator checks (Inductii: no Primes; the Legiones Astartes
    // Primary Detachments: Battlesmith, Master of the Legion, Move 0).
    ...(() => {
      const ds = datasheets[id]!;
      const rules = [
        ...((unit.entryLinks ?? []).some((l: Node) => l.name === 'Inductii') || /Inductii/.test(unit.name) ? ['Inductii'] : []),
        ...(always(/^Battlesmith \(\d+\)$/) ? ['Battlesmith'] : []),
        ...(ds.traits.includes('Master of the Legion') ? ['Master of the Legion'] : []),
        ...(ds.models.some((m) => m.profile.M === '0' || m.profile.M === '-') ? ['Immobile'] : []),
      ];
      return rules.length ? { rules } : {};
    })(),
    ...(commandAuxUnlocks && commandAuxUnlocks > 1 ? { commandAuxUnlocks } : {}),
    ...(consul ? { commandUnlocksApex: true } : {}),
    ...(tank ? { tankCommander: Number(/\((\d+)\)/.exec(tank)![1]) } : {}),
    points: { base, minModels, maxModels, perExtraModel: perExtra },
    options: optionsFor(unit.name, id, models, unit),
    source: { book: 'BSData horus-heresy-3rd-edition', version: sha, section: `${catalogueName.trim()} › ${unit.name}` },
  };
}

// ── datasheets (display only; the validator never reads these) ─────────────
export interface Datasheet {
  models: { name: string; min: number; max: number; profile: Record<string, string> }[];
  wargear: { model: string; items: string[] }[];
  weapons: { name: string; kind: 'Ranged' | 'Melee'; stats: Record<string, string>; legions?: string[] }[];
  /** `legions`: only for these Legions. `whenSelected`: only once that option is taken. */
  /** `variants`: name when an option is taken or a sub-faction chosen; `otherwise`: name when none applies. */
  rules: { name: string; summary: string; legions?: string[]; whenSelected?: string; variants?: { when: string; name: string }[]; otherwise?: string }[];
  traits: string[];
  /** Wargear item name → names of the weapon profiles it carries (e.g. a combi-weapon's two profiles). */
  items: Record<string, string[]>;
}
const chars = (p: Node): Record<string, string> =>
  Object.fromEntries((p.characteristics ?? []).map((c: Node) => [String(c.name), String(c.$text ?? '')]));
const profilesOf = (n: Node): Node[] => [
  ...(n.profiles ?? []),
  ...(n.infoLinks ?? []).filter((l: Node) => l.type === 'profile').map((l: Node) => byId.get(l.targetId)).filter(Boolean),
];
/** Apply BSData's unconditional name modifiers, e.g. "Line (X)" → "Line (2)". */
function displayName(name: string, modifiers: Node[] = []): string {
  let n = name;
  for (const m of modifiers) {
    if (m.field !== 'name' || !isUnconditional(m)) continue;
    const v = String(m.value);
    if (m.type === 'set') n = v;
    else if (m.type === 'replace' && m.arg !== undefined) n = n.split(String(m.arg)).join(v);
    else if (m.type === 'append') n = `${n} ${v}`;
    else if (m.type === 'prepend') n = `${v} ${n}`;
  }
  return n;
}
const ruleSummary = (r: Node | undefined): string => {
  // BSData rule text usually opens with a one-line summary in quotes; keep just that.
  const d = String(r?.description ?? '').trim().replace(/^["“]/, '');
  const close = d.search(/["”]/); // closing quote of the summary, with or without a full stop
  const first = (close >= 0 ? d.slice(0, close) : d.split(/(?<=\.)\s/)[0]!).replace(/\s+/g, ' ').trim().replace(/([^.!?:])$/, '$1.');
  return first.length > 220 ? `${first.slice(0, 217)}…` : first;
};

function datasheetFor(unit: Node, models: ModelInfo[]): Datasheet {
  const weapons = new Map<string, Datasheet['weapons'][number]>();
  const rules = new Map<string, Datasheet['rules'][number]>();
  const traits = new Set<string>();
  const seen = new Set<Node>();
  const items: Record<string, string[]> = {};
  const weaponNames = (n: Node) => profilesOf(n).filter((p) => p.typeName === 'Ranged Weapon' || p.typeName === 'Melee Weapon').map((p) => String(p.name));
  const visit = (n: Node, depth: number, ctx: Ctx = { cats: new Set() }, legions: Set<string> = ALL_LEGIONS) => {
    if (seen.has(n) || depth > 8) return;
    seen.add(n);
    if (n.type !== 'model' && n.type !== 'unit') {
      // An item's profiles may sit on the entry or one level down (e.g. "Two twin volkite calivers").
      const own = [...weaponNames(n), ...children(n).filter((c) => !c.group).flatMap((c) => weaponNames(c.node))];
      if (own.length) items[n.name] = [...new Set([...(items[n.name] ?? []), ...own])];
    }
    for (const p of profilesOf(n)) {
      if ((p.typeName === 'Ranged Weapon' || p.typeName === 'Melee Weapon') && !(weapons.get(p.name) && !weapons.get(p.name)!.legions))
        weapons.set(p.name, {
          name: p.name,
          kind: p.typeName === 'Ranged Weapon' ? 'Ranged' : 'Melee',
          stats: chars(p),
          ...(legions.size === LEGIONS.length ? {} : { legions: [...legions].filter((l) => importLegions.has(l)) }),
        });
    }
    for (const { node } of children(n)) {
      if (node.type === 'model' || node.name === 'Prime Unit') continue;
      const vis = intersect(legions, visibleFor(node, ctx));
      if (vis.size && relevant(vis)) visit(node, depth + 1, ctx, vis);
    }
  };
  /**
   * Rules/traits shown on the unit or a model. BSData attaches many conditionally: hidden
   * until an upgrade is taken (Aberrant, Clone) or an oath is sworn (Blackshields). Only keep
   * what is shown unconditionally, per Legion, or once a named option is selected.
   */
  const addRule = (link: Node, target: Node | undefined, ctx: Ctx) => {
    const merged: Node = { hidden: link.hidden === true || target?.hidden === true, modifiers: [...(target?.modifiers ?? []), ...(link.modifiers ?? [])] };
    const name = displayName(String(link.name ?? target?.name ?? ''), merged.modifiers);
    // Name that depends on one selected item, e.g. "Bulky (2)" with an Outrider, "Bulky (3)" with a jetbike.
    const nameMods = (merged.modifiers as Node[])
      .filter((m) => m.field === 'name' && m.type === 'set' && !m.conditionGroups?.length && m.conditions?.length === 1)
      .map((m) => ({ c: m.conditions[0], name: String(m.value) }));
    // Or one that depends on the unit's sub-faction: "Bulky (10)" if Myrmidax, "Bulky (7)" otherwise.
    const isSub = (c: Node) => SUB_FACTIONS.includes(String(byId.get(c.childId)?.name)) && c.scope === 'ancestor';
    const variants = [
      ...nameMods
        .filter(({ c }) => (c.type === 'atLeast' || c.type === 'greaterThan') && ['unit', 'model', 'parent', 'self'].includes(c.scope) && byId.get(c.childId)),
      ...nameMods.filter(({ c }) => c.type === 'instanceOf' && isSub(c)),
    ].map(({ c, name }) => ({ when: String(byId.get(c.childId)!.name), name }));
    const otherwise = nameMods.find(({ c }) => c.type === 'notInstanceOf' && isSub(c))?.name;
    const vis = visibleFor(merged, ctx);
    if (vis.size) {
      if (!relevant(vis)) return;
      const legions = vis.size === LEGIONS.length ? undefined : [...vis].filter((l) => importLegions.has(l));
      if (!rules.has(name) || !legions)
        rules.set(name, { name, summary: ruleSummary(target), ...(legions ? { legions } : {}), ...(variants.length ? { variants } : {}), ...(otherwise ? { otherwise } : {}) });
      return;
    }
    // Hidden for everyone: is it revealed by taking one specific option on this unit/model?
    const whenSelected = (merged.modifiers as Node[])
      .filter((m) => m.field === 'hidden' && m.type === 'set' && (m.value === false || m.value === 'false') && !m.conditionGroups?.length && m.conditions?.length === 1)
      .map((m) => m.conditions[0])
      .find((c: Node) => (c.type === 'atLeast' || c.type === 'greaterThan') && ['unit', 'model', 'parent', 'self'].includes(c.scope) && byId.get(c.childId)?.type !== 'catalogue');
    if (whenSelected && !rules.has(name)) {
      const option = String(byId.get(whenSelected.childId)?.name ?? '');
      if (option) rules.set(name, { name, summary: ruleSummary(target), whenSelected: option });
    }
  };
  const unitLevelRules = (n: Node, ctx: Ctx) => {
    for (const l of n.infoLinks ?? []) {
      const t = byId.get(l.targetId);
      if (l.type === 'rule') addRule(l, t, ctx);
      if (l.type === 'profile' && t?.typeName === 'Traits' && visibleFor({ hidden: l.hidden === true || t?.hidden === true, modifiers: [...(t?.modifiers ?? []), ...(l.modifiers ?? [])] }, ctx).size === LEGIONS.length)
        traits.add(l.name);
    }
    for (const r of n.rules ?? []) addRule(r, r, ctx);
  };
  unitLevelRules(unit, { cats: new Set(catNames(unit)) });
  // Default kit: free fixed entries plus each exchange group's default (or first free) choice.
  const defaultKit = (start: Node): string[] => {
    const items: string[] = [];
    const walk = (n: Node) => {
      for (const { node, group } of children(n)) {
        if (isHidden(node) || node.name === 'Prime Unit' || node.type === 'model' || /Detachment|Witchblood|Sub-faction/.test(node.name)) continue;
        if (group) {
          const opts = leaves(node).filter((x) => x.legions.size === LEGIONS.length).map((x) => x.node);
          const required = (parentLimit(node, 'min') ?? 0) >= 1;
          const def = opts.find((x: Node) => x.id === node.defaultSelectionEntryId) ?? (required ? opts.find((x: Node) => cost(x) === 0) : undefined);
          if (def) items.push(def.name);
          else if (!required) walk(node);
        } else if (cost(node) === 0 && (parentLimit(node, 'min') ?? 0) >= 1) items.push(node.name);
        else if (cost(node) === 0 && !parentLimit(node, 'max') && profilesOf(node).some((p) => /Weapon/.test(p.typeName))) items.push(node.name);
      }
    };
    walk(start);
    return [...new Set(items)];
  };
  const wargear: Datasheet['wargear'] = [];
  for (const m of models) {
    unitLevelRules(m.node, { cats: new Set([...catNames(unit), ...catNames(m.node)]) });
    visit(m.node, 0, { cats: new Set([...catNames(unit), ...catNames(m.node)]) });
    wargear.push({ model: m.node.name, items: defaultKit(m.node) });
  }
  // Kit carried on the unit entry itself (e.g. Primarchs' named weapons).
  const unitKit = defaultKit(unit);
  if (unitKit.length) {
    if (models.length === 1) wargear[0]!.items = [...new Set([...wargear[0]!.items, ...unitKit])];
    else wargear.push({ model: 'Unit', items: unitKit });
  }
  visit(unit, 0);
  return {
    models: models.map((m) => {
      const prof = profilesOf(m.node).find((p) => p.typeName === 'Profile') ?? profilesOf(m.node)[0];
      return { name: m.node.name, min: m.min, max: m.max, profile: prof ? chars(prof) : {} };
    }),
    wargear,
    weapons: [...weapons.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
    rules: [...rules.values()].sort((a, b) => a.name.localeCompare(b.name)),
    traits: [...traits],
    items,
  };
}
const datasheets: Record<string, Datasheet> = {};

// ── run ─────────────────────────────────────────────────────────────────────
const units = new Map<string, UnitDef>();
/**
 * Names that several catalogues define as *different* units (every Legion has its own
 * "Inductii Squad"). Those get the Faction in their id (inductii-squad-death-guard) so no
 * Legion's version overwrites another's. Links to one shared unit keep the plain id.
 */
const targetsByName = new Map<string, Set<string>>();
for (const file of catalogueFiles) {
  const cat = JSON.parse(readFileSync(join(repo, file), 'utf8')).catalogue;
  for (const l of cat?.entryLinks ?? []) targetsByName.set(String(l.name), (targetsByName.get(String(l.name)) ?? new Set()).add(String(l.targetId)));
}
const perFaction = new Set([...targetsByName].filter(([, t]) => t.size > 1).map(([n]) => n));
const skippedLinks: string[] = [];
for (const file of catalogueFiles) {
  const doc = JSON.parse(readFileSync(join(repo, file), 'utf8'));
  const cat = doc.catalogue ?? doc.gameSystem;
  // Units defined in a Legion's own catalogue belong to that Legion even when the
  // link doesn't carry the trait (e.g. Mortus Poisoner Squad, Death Guard Inductii).
  currentCatalogue = String(cat.name);
  const own = ARMY_LISTS[currentCatalogue];
  const catalogueLegion = own?.faction ?? LEGIONS.find((l) => String(cat.name).includes(l)) ?? null;
  const armyList = own?.armyList ?? 'legiones-astartes';
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
      own?.faction ??
      linkCats.map((c) => String(c.name)).find((n) => LEGIONS.includes(n)) ??
      (ownEntries.has(link.targetId) ? catalogueLegion : null);
    const def = importUnit(link, cat.name, role, faction, armyList, perFaction.has(String(link.name)) ? faction ?? undefined : undefined);
    if (!def) continue;
    const prev = units.get(def.id);
    if (prev && prev.armyList !== def.armyList) note(def.name, `id "${def.id}" is used by two army lists (${prev.armyList}, ${def.armyList}); kept ${prev.armyList}`);
    if (prev && prev.role !== def.role) note(def.name, `linked with two roles (${prev.role}, ${def.role}); kept ${prev.role}`);
    if (!prev) units.set(def.id, def);
  }
}

const outDir = join(import.meta.dirname, '..', 'data', 'bsdata');
mkdirSync(outDir, { recursive: true });
const sorted = [...units.values()].sort((a, b) => a.name.localeCompare(b.name));

// ── special-rules glossary (display only: hover text in datasheets) ─────────
// Every rule named by an imported datasheet (unit rules and weapons' "Special Rules"),
// with its full BSData text. "Shred (6)" is looked up as "Shred (X)". Where a name has
// more than one text, Special Rules.json wins, then the game system, then catalogues.
const ruleText = new Map<string, string>();
{
  const files = readdirSync(repo).filter((f) => f.endsWith('.json'));
  const rank = (f: string) => (f === 'Special Rules.json' ? 0 : f === 'Horus Heresy 3rd Edition.json' ? 1 : 2);
  for (const f of files.sort((a, b) => rank(a) - rank(b))) {
    const walk = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        const n = o as Node;
        if (typeof n.name === 'string' && typeof n.description === 'string' && n.description.trim().length > 20 && !n.typeId && !ruleText.has(n.name.trim()))
          ruleText.set(n.name.trim(), n.description.replace(/\s+/g, ' ').trim());
        Object.values(n).forEach(walk);
      }
    };
    walk(JSON.parse(readFileSync(join(repo, f), 'utf8')));
  }
}
/**
 * Glossary key: lower case, straight apostrophes, single spaces, and any trailing "(…)" value
 * made generic, so "Shred (6)", "Shred (4+)" and "Shred (X)" all share "shred (x)".
 * ui/src/loadout.ts › ruleKey must stay identical.
 */
const ruleKey = (name: string) =>
  name.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().replace(/\s*\([^)]*\)$/, ' (x)');
/** Split "Shred (6), Shock (Pinning, Suppressed)" at commas outside brackets; BSData sometimes omits the comma ("Shred (4+) Reaping Blow (2)"). */
const splitRules = (text: string) => text.split(/,(?![^(]*\))|(?<=\))\s+(?=[A-Z])/).map((x) => x.trim()).filter((x) => x && x !== '-');
const byKey = new Map<string, { name: string; text: string }>();
for (const [name, text] of ruleText) if (!byKey.has(ruleKey(name))) byKey.set(ruleKey(name), { name, text });
const glossary: Record<string, { name: string; text: string }> = {};
const missingRules = new Set<string>();
const wantRule = (raw: string) => {
  for (const key of [ruleKey(raw), `${ruleKey(raw)} (x)`]) {
    const hit = byKey.get(key);
    if (hit) return void (glossary[key] = hit);
  }
  missingRules.add(raw.trim());
};
for (const u of sorted) {
  const ds = datasheets[u.id];
  if (!ds) continue;
  for (const r of ds.rules) {
    wantRule(r.name);
    for (const v of r.variants ?? []) wantRule(v.name);
    if (r.otherwise) wantRule(r.otherwise);
  }
  for (const w of ds.weapons) for (const part of splitRules(w.stats['Special Rules'] ?? '')) wantRule(part);
}

writeFileSync(
  join(outDir, 'datasheets.json'),
  JSON.stringify({ commit: sha, glossary, datasheets: Object.fromEntries(sorted.map((u) => [u.id, datasheets[u.id]])) }) + '\n',
);
writeFileSync(join(outDir, 'units.json'),JSON.stringify({ source: 'https://github.com/BSData/horus-heresy-3rd-edition', commit: sha, catalogues: catalogueFiles, units: sorted }, null, 2) + '\n');

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
  '## Special rules with no text found (no hover text in datasheets)',
  '',
  ...[...missingRules].sort().map((s) => `- ${s}`),
  '',
  '## Per-unit notes',
  '',
  ...Object.entries(report).sort(([a], [b]) => a.localeCompare(b)).flatMap(([u, msgs]) => [`### ${u}`, ...[...new Set(msgs)].map((m) => `- ${m}`), '']),
];
writeFileSync(join(outDir, 'IMPORT-REPORT.md'), lines.join('\n'));
console.log(`Imported ${sorted.length} units from ${catalogueFiles.join(', ')} @ ${sha}; ${Object.keys(report).length} units with notes, ${skippedLinks.length} links skipped.`);
