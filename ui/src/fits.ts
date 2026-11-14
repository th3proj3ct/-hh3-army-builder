/**
 * "Where can this unit go?" and "What fits in this slot?" — derived from the same
 * catalog data the validator uses (slot roles, restrictions, requirements).
 */
import { CATALOG, armyListOf } from '../../src/catalog';
import type { Allegiance, BattlefieldRole, DetachmentDef, SlotDef, UnitDef } from '../../src/model';
import { roleLabel } from '../../src/validate';
import { unitDefs } from './state';

/** Display order for role groups. */
export const ROLE_ORDER: BattlefieldRole[] = [
  'HighCommand', 'Command', 'Troops', 'Retinue', 'Elites', 'Support', 'Transport', 'HeavyTransport',
  'HeavyAssault', 'Armour', 'WarEngine', 'Recon', 'FastAttack', 'Warlord', 'LordOfWar',
];

export function slotAccepts(det: DetachmentDef, slot: SlotDef, u: UnitDef, choice?: string): boolean {
  if (u.role !== slot.role) return false;
  const r = slot.restriction;
  if (r?.unitIds && !r.unitIds.includes(u.id)) return false;
  if (r?.excludeUnitIds?.includes(u.id)) return false;
  if (r?.modelTag && !u.modelTags.includes(r.modelTag)) return false;
  if (r?.subFaction && u.subFaction !== r.subFaction && !u.subFactions?.includes(r.subFaction)) return false;
  if (r?.armyList && u.armyList !== r.armyList) return false;
  if (r?.nameContainsDetachmentChoice) {
    const options = choice ? [choice] : det.choice?.options ?? [];
    if (!options.some((o) => u.name.includes(o))) return false;
  }
  return true;
}

/** Unit display name; falls back to a readable form of the id for units not imported yet. */
const unitName = (id: string) => unitDefs.get(id)?.name ?? id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * False for another Legion's own detachments (e.g. Exalted Conclave needs a Word Bearers
 * Primary). Menus hide those entirely; the validator still enforces the rule.
 */
export function forPrimaryLegion(def: DetachmentDef, legion: string): boolean {
  return def.requirements.every((r) => r.kind !== 'primaryFaction' || r.factions.includes(legion));
}

/** False for detachments another army list owns (e.g. Techmarine Covenant for a Mechanicum detachment). */
export function forArmyList(def: DetachmentDef, armyList: string): boolean {
  return !def.armyLists || def.armyLists.includes(armyList);
}

/** How a detachment becomes available, in one short phrase. */
export function howAvailable(def: DetachmentDef): string {
  const base: Record<DetachmentDef['kind'], string> = {
    Primary: 'every army has one',
    Auxiliary: 'unlocked by a filled Command or High Command slot',
    Apex: 'unlocked by a filled High Command slot',
    Allied: 'always available; different Legion/Faction, ≤50% of points',
    LordOfWar: 'always available; shares the 25% cap',
    Warlord: 'one per army',
  };
  return [base[def.kind], ...extraRequirements(def)].join(' · ');
}

/**
 * Only the conditions beyond the detachment's kind (e.g. "Death Guard Primary only",
 * "needs Master of Signals in a Command slot"). Used where the kind's own rule is
 * already obvious, such as the "Unlock a detachment" menu.
 */
export function extraRequirements(def: DetachmentDef): string[] {
  const reqs: string[] = [];
  for (const r of def.requirements) {
    if (r.kind === 'primaryFaction') reqs.push(`${r.factions.join('/')} Primary only`);
    if (r.kind === 'allegiance') reqs.push(`${r.value} only`);
    if (r.kind === 'minPointsLimit') reqs.push(`${r.value.toLocaleString('en')}+ pts`);
    if (r.kind === 'unlockedByUnit')
      reqs.push(`needs ${r.subFaction ? `a ${r.subFaction} ` : ''}${r.unitIds.map((id) => unitName(id)).join('/')} in a ${def.kind === 'Apex' ? 'High Command' : 'Command'} slot`);
    if (r.kind === 'armyIncludesUnit') reqs.push(`army must include ${r.unitIds.map((id) => unitName(id)).join(' or ')}`);
  }
  return reqs;
}

export interface Fit {
  def: DetachmentDef;
  slots: number;
  prime: number;
  note?: string;
}

/** Every detachment with a slot this unit can fill. */
export function detachmentsFor(u: UnitDef): Fit[] {
  const fits: Fit[] = [];
  for (const def of CATALOG.detachments) {
    if (!forArmyList(def, u.armyList)) continue;
    const ok = def.slots.filter((s) => slotAccepts(def, s, u));
    if (ok.length) {
      const chosen = def.choice && ok.some((s) => s.restriction?.nameContainsDetachmentChoice) ? def.choice.options.find((o) => u.name.includes(o)) : undefined;
      fits.push({ def, slots: ok.length, prime: ok.filter((s) => s.prime).length, ...(chosen ? { note: `when set to ${chosen}` } : {}) });
    }
    // High Command units can also sit in a Command Prime slot via Special Assignment.
    if (u.role === 'HighCommand') {
      const sa = def.slots.filter((s) => s.role === 'Command' && s.prime && (!s.restriction?.unitIds || s.restriction.unitIds.includes(u.id)));
      if (sa.length) fits.push({ def, slots: sa.length, prime: sa.length, note: 'via Special Assignment (Command Prime slot)' });
    }
  }
  return fits;
}

/** Units that could fill a role in this detachment, for "what fits?" lists. */
export function unitsFitting(def: DetachmentDef, role: BattlefieldRole, opts: { faction: string; allegiance: Allegiance; choice?: string }): UnitDef[] {
  const slot = def.slots.find((s) => s.role === role);
  if (!slot) return [];
  return CATALOG.units
    .filter((u) => slotAccepts(def, slot, u, opts.choice))
    .filter((u) => u.factionTrait === opts.faction || (u.factionTrait === null && u.armyList === armyListOf(opts.faction)))
    .filter((u) => u.allegiance === 'Any' || u.allegiance === opts.allegiance)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** "Recon ×2, ★Troops" style summary of a detachment's slots, grouped by role. */
export function slotSummary(def: DetachmentDef): { role: BattlefieldRole; count: number; prime: number; label: string }[] {
  const out = new Map<BattlefieldRole, { count: number; prime: number }>();
  for (const s of def.slots) {
    const e = out.get(s.role) ?? { count: 0, prime: 0 };
    e.count++;
    if (s.prime) e.prime++;
    out.set(s.role, e);
  }
  return [...out.entries()].map(([role, e]) => ({ role, ...e, label: `${roleLabel(role)} ×${e.count}${e.prime ? ` (${e.prime}★)` : ''}` }));
}
