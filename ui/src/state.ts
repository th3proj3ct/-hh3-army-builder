/**
 * UI state: the roster plus a little UI-only metadata, changed only through pure
 * operations so every change can be undone and fed to explainChange() as a "what if".
 */
import { CATALOG, FACTIONS, LEGIONS, armyListOf } from '../../src/catalog';
import type { Allegiance, BattlefieldRole, DetachmentDef, DetachmentInstance, Roster, SlotDef, UnitInstance } from '../../src/model';

export interface BuilderState {
  roster: Roster;
  primaryLegion: string;
  /** Faction chosen for each Allied detachment (keyed by detachment id). */
  alliedFaction: Record<string, string>;
}

export const unitDefs = new Map(CATALOG.units.map((u) => [u.id, u]));
export const detDefs = new Map(CATALOG.detachments.map((d) => [d.id, d]));
export const primeDefs = new Map(CATALOG.primeAdvantages.map((p) => [p.id, p]));
export { FACTIONS, LEGIONS, armyListOf };

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const riteFor = (legion: string) => `${legion.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')}-legiones-astartes`;
/** Rites of War only exist for Legions; other Factions (Mechanicum) have none. */
const ritesFor = (faction: string): Record<string, string> => (LEGIONS.includes(faction) ? { [faction]: riteFor(faction) } : {});

export function emptyState(legion = 'Death Guard', pointsLimit = 3000, allegiance: Allegiance = 'Traitor'): BuilderState {
  return {
    primaryLegion: legion,
    alliedFaction: {},
    roster: {
      name: `${legion} army`,
      catalogVersion: CATALOG.version,
      pointsLimit,
      allegiance,
      ritesOfWar: ritesFor(legion),
      detachments: [{ id: 'primary', defId: 'crusade-primary', armyList: armyListOf(legion), extraSlots: [], fills: [] }],
    },
  };
}

// ── lookups ───────────────────────────────────────────────────────────────
export function slotsOf(det: DetachmentInstance): SlotDef[] {
  const def = detDefs.get(det.defId);
  const base = def?.slots ?? [];
  return [...base, ...det.extraSlots.map((x) => ({ id: x.id, role: x.role }))];
}
export const fillOf = (det: DetachmentInstance, slotId: string) => det.fills.find((f) => f.slotId === slotId);
export const childrenOf = (r: Roster, detId: string, slotId: string) =>
  r.detachments.filter((d) => d.unlockedBy?.detachmentId === detId && d.unlockedBy.slotId === slotId);

/** Faction a new "[Legiones Astartes]" unit should take in this detachment. */
export function factionForDetachment(s: BuilderState, detId: string): string {
  let det = s.roster.detachments.find((d) => d.id === detId);
  const seen = new Set<string>();
  while (det?.unlockedBy && !seen.has(det.id)) {
    seen.add(det.id);
    det = s.roster.detachments.find((d) => d.id === det!.unlockedBy!.detachmentId);
  }
  if (det && detDefs.get(det.defId)?.kind === 'Allied') return s.alliedFaction[det.id] ?? s.primaryLegion;
  return s.primaryLegion;
}

/**
 * Sub-faction a new Mechanicum unit should take here: the one already used in the
 * detachment (one per detachment), else the one its Apex needs, else the first offered.
 */
export function subFactionForDetachment(s: BuilderState, detId: string, offered: string[], skipSlot?: string): string {
  const det = s.roster.detachments.find((d) => d.id === detId);
  for (const f of det?.fills ?? []) {
    if (!f.unit || f.slotId === skipSlot) continue;
    const u = unitDefs.get(f.unit.unitId);
    const sub = u?.subFactions ? f.unit.subFaction : u?.subFaction;
    if (sub && offered.includes(sub)) return sub;
  }
  const req = det && detDefs.get(det.defId)?.requirements.find((r) => r.kind === 'unlockedByUnit');
  if (req?.kind === 'unlockedByUnit' && req.subFaction && offered.includes(req.subFaction)) return req.subFaction;
  return offered[0]!;
}

/**
 * Set a Mechanicum unit's sub-faction. A detachment has one, so every other unit there that
 * can take it follows; units with a fixed sub-faction (Castellax: Cybernetica) can't, and the
 * validator says so.
 */
export function setSubFaction(s: BuilderState, detId: string, slotId: string, subFaction: string): BuilderState {
  return mapDet(s, detId, (d) => ({
    ...d,
    fills: d.fills.map((f) => {
      const offered = f.unit && unitDefs.get(f.unit.unitId)?.subFactions;
      return f.unit && (f.slotId === slotId || offered?.includes(subFaction)) && offered ? { ...f, unit: { ...f.unit, subFaction } } : f;
    }),
  }));
}

/**
 * How many detachments this filled slot may unlock: 1, or X for an Officer of the Line (X)
 * unit in a Command slot (Auxiliaries only). Special Assignment slots unlock nothing.
 */
export function unlockAllowance(det: DetachmentInstance, slot: SlotDef): number {
  const fill = fillOf(det, slot.id);
  if (!fill?.unit || fill.primeAdvantage === 'special-assignment') return 0;
  const u = unitDefs.get(fill.unit.unitId);
  const officer = slot.role === 'Command' ? u?.commandAuxUnlocks ?? 1 : 1;
  // Tank Commander (X): X Auxiliaries, as long as each has only Armour slots.
  return Math.max(officer, u?.tankCommander ?? 0);
}

const NUMBER_WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four' };
/**
 * What this filled slot can unlock, in words: "can unlock one Apex or one Auxiliary detachment",
 * plus Officer of the Line, Tank Commander and Consul-Delegatus variations.
 */
export function unlockSummary(det: DetachmentInstance, slot: SlotDef, used: number): string {
  const fill = fillOf(det, slot.id);
  if (fill?.primeAdvantage === 'special-assignment') return 'is on Special Assignment, so it unlocks nothing.';
  const u = fill?.unit && unitDefs.get(fill.unit.unitId);
  const n = (x: number) => NUMBER_WORDS[x] ?? String(x);
  const parts: string[] = [];
  const allied = detDefs.get(det.defId)?.kind === 'Allied';
  if (slot.role === 'HighCommand') parts.push(allied ? 'one Auxiliary detachment' : 'one Apex or one Auxiliary detachment');
  else if (u?.commandUnlocksApex && !allied) parts.push('one Auxiliary detachment, or one Apex instead (Consul-Delegatus)');
  else if (slot.role === 'Command' && (u?.commandAuxUnlocks ?? 1) > 1) parts.push(`${n(u!.commandAuxUnlocks!)} Auxiliary detachments (Officer of the Line (${u!.commandAuxUnlocks}))`);
  else parts.push('one Auxiliary detachment');
  if (u?.tankCommander) parts.push(`${n(u.tankCommander)} Armour-only Auxiliaries such as Armoured Support (Tank Commander (${u.tankCommander}))`);
  const allowance = unlockAllowance(det, slot);
  return `can unlock ${parts.join(', or ')}${allowance > 1 && used ? ` · ${used} of ${allowance} used` : ''}.`;
}

/** Can this filled slot unlock a detachment (ignoring whether it already has)? */
export function canUnlock(det: DetachmentInstance, slot: SlotDef): boolean {
  const def = detDefs.get(det.defId);
  if (!def?.grantsUnlocks || !['Primary', 'Apex', 'Allied'].includes(def.kind)) return false;
  return slot.role === 'Command' || slot.role === 'HighCommand';
}

// ── pure operations (each returns a new state) ─────────────────────────────
const mapDet = (s: BuilderState, detId: string, f: (d: DetachmentInstance) => DetachmentInstance): BuilderState => ({
  ...s,
  roster: { ...s.roster, detachments: s.roster.detachments.map((d) => (d.id === detId ? f(d) : d)) },
});

export function placeUnit(s: BuilderState, detId: string, slotId: string, unitId: string): BuilderState {
  const def = unitDefs.get(unitId);
  if (!def) return s;
  const unit: UnitInstance = {
    id: newId('u'),
    unitId,
    models: def.points.minModels,
    options: [],
    ...(def.factionTrait === null ? { factionTrait: factionForDetachment(s, detId) } : {}),
    ...(def.subFactions ? { subFaction: subFactionForDetachment(s, detId, def.subFactions) } : {}),
  };
  return mapDet(s, detId, (d) => {
    const existing = fillOf(d, slotId);
    const fills = existing ? d.fills.map((f) => (f.slotId === slotId ? { ...f, unit } : f)) : [...d.fills, { slotId, unit }];
    return { ...d, fills };
  });
}

export function removeUnit(s: BuilderState, detId: string, slotId: string): BuilderState {
  // Removing a unit also removes what its slot unlocked (and any extra slot it granted).
  let next = mapDet(s, detId, (d) => ({
    ...d,
    fills: d.fills.filter((f) => f.slotId !== slotId).filter((f) => !d.extraSlots.some((x) => x.id === f.slotId && x.grantedBy.slotId === slotId)),
    extraSlots: d.extraSlots.filter((x) => x.grantedBy.slotId !== slotId),
  }));
  for (const child of childrenOf(next.roster, detId, slotId)) next = removeDetachment(next, child.id);
  return next;
}

/**
 * Where a copy of this slot's unit would go: the first empty slot of the same Battlefield
 * Role in the same detachment (plain slots before Prime ones, so Primes stay free).
 */
export function duplicateTarget(s: BuilderState, detId: string, slotId: string): SlotDef | undefined {
  const det = s.roster.detachments.find((d) => d.id === detId);
  const unit = det && fillOf(det, slotId)?.unit;
  const role = unit && unitDefs.get(unit.unitId)?.role;
  if (!det || !role) return undefined;
  const empty = slotsOf(det).filter((sl) => sl.role === role && !fillOf(det, sl.id)?.unit);
  return empty.find((sl) => !sl.prime) ?? empty[0];
}

/** Copy a unit (size, wargear, Legion) into another empty slot of its role. Prime Advantages aren't copied. */
export function duplicateUnit(s: BuilderState, detId: string, slotId: string): { state: BuilderState; slotId: string } | null {
  const target = duplicateTarget(s, detId, slotId);
  const det = s.roster.detachments.find((d) => d.id === detId);
  const unit = det && fillOf(det, slotId)?.unit;
  if (!target || !unit) return null;
  const copy: UnitInstance = { ...structuredClone(unit), id: newId('u') };
  const state = mapDet(s, detId, (d) => ({ ...d, fills: [...d.fills.filter((f) => f.slotId !== target.id), { slotId: target.id, unit: copy }] }));
  return { state, slotId: target.id };
}

export function updateUnit(s: BuilderState, detId: string, slotId: string, f: (u: UnitInstance) => UnitInstance): BuilderState {
  return mapDet(s, detId, (d) => ({ ...d, fills: d.fills.map((x) => (x.slotId === slotId && x.unit ? { ...x, unit: f(x.unit) } : x)) }));
}

export function setOptionCount(s: BuilderState, detId: string, slotId: string, optionId: string, count: number): BuilderState {
  return updateUnit(s, detId, slotId, (u) => {
    const rest = u.options.filter((o) => o.optionId !== optionId);
    return { ...u, options: count > 0 ? [...rest, { optionId, count }] : rest };
  });
}

export function setPrime(s: BuilderState, detId: string, slotId: string, primeId: string | undefined): BuilderState {
  return mapDet(s, detId, (d) => {
    const dropExtra = d.extraSlots.filter((x) => x.grantedBy.slotId === slotId).map((x) => x.id);
    let extraSlots = d.extraSlots.filter((x) => x.grantedBy.slotId !== slotId);
    let fills = d.fills.filter((f) => !dropExtra.includes(f.slotId)).map((f) => (f.slotId === slotId ? { ...f, primeAdvantage: primeId } : f));
    if (!primeId) fills = fills.map((f) => (f.slotId === slotId ? { slotId: f.slotId, ...(f.unit ? { unit: f.unit } : {}) } : f));
    const adv = primeId ? primeDefs.get(primeId) : undefined;
    const eff = adv?.effect;
    if (eff?.kind === 'addSlot' && primeId) {
      const role = extraSlotRoles(eff)[0] ?? 'Troops';
      extraSlots = [...extraSlots, { id: `x-${slotId}`, role, grantedBy: { slotId, primeAdvantageId: primeId } }];
    }
    return { ...d, fills, extraSlots };
  });
}

const ADDABLE: BattlefieldRole[] = ['Troops', 'Elites', 'Support', 'Retinue', 'Transport', 'HeavyTransport', 'HeavyAssault', 'Armour', 'Recon', 'FastAttack', 'WarEngine', 'HighCommand', 'Command', 'Warlord', 'LordOfWar'];
/** Roles a slot-granting Prime Advantage may add. */
export function extraSlotRoles(eff: { allowedRoles?: BattlefieldRole[]; excludedRoles?: BattlefieldRole[] }): BattlefieldRole[] {
  return (eff.allowedRoles ?? ADDABLE).filter((r) => !eff.excludedRoles?.includes(r));
}

export function setExtraSlotRole(s: BuilderState, detId: string, extraId: string, role: BattlefieldRole): BuilderState {
  return mapDet(s, detId, (d) => ({ ...d, extraSlots: d.extraSlots.map((x) => (x.id === extraId ? { ...x, role } : x)), fills: d.fills.filter((f) => f.slotId !== extraId) }));
}

export function addDetachment(s: BuilderState, defId: string, unlockedBy?: { detachmentId: string; slotId: string }): { state: BuilderState; id: string } {
  const def = detDefs.get(defId) as DetachmentDef;
  const id = newId(defId);
  const parent = unlockedBy && s.roster.detachments.find((d) => d.id === unlockedBy.detachmentId);
  const primaryList = s.roster.detachments.find((d) => detDefs.get(d.defId)?.kind === 'Primary')?.armyList ?? armyListOf(s.primaryLegion);
  const alliedDefault = LEGIONS.find((l) => l !== s.primaryLegion)!;
  const det: DetachmentInstance = {
    id,
    defId,
    armyList: parent?.armyList ?? (def.kind === 'Allied' ? armyListOf(alliedDefault) : primaryList),
    ...(unlockedBy ? { unlockedBy } : {}),
    ...(def.choice ? { choice: def.choice.options[0] } : {}),
    extraSlots: [],
    fills: [],
  };
  const state: BuilderState = { ...s, roster: { ...s.roster, detachments: [...s.roster.detachments, det] } };
  if (def.kind === 'Allied') {
    state.alliedFaction = { ...s.alliedFaction, [id]: alliedDefault };
    state.roster = { ...state.roster, ritesOfWar: { ...ritesFor(alliedDefault), ...state.roster.ritesOfWar } };
  }
  return { state, id };
}

/**
 * For a detachment only a specific unit can unlock (Storm Battery ← Siege Breaker): find an
 * empty slot of that unit's role in a detachment that can unlock (the one the menu was opened
 * from first, then the others), put the unit there and add the detachment linked to it.
 * Returns null when there's no such unit or no free slot.
 */
export function planWithCommander(
  s: BuilderState,
  defId: string,
  preferDetId?: string,
): { state: BuilderState; unitId: string; parentDetId: string; slotId: string; newDetId: string } | null {
  const def = detDefs.get(defId);
  const req = def?.requirements.find((r) => r.kind === 'unlockedByUnit' || r.kind === 'primaryIncludesUnit');
  if (!def || !req || (req.kind !== 'unlockedByUnit' && req.kind !== 'primaryIncludesUnit')) return null;
  if (req.kind === 'unlockedByUnit' && req.allegiance && req.allegiance !== s.roster.allegiance) return null;
  // "Primary Detachment includes X" (Planetfall Speartip ← Master of Descent): X goes in the Primary.
  const primaryOnly = req.kind === 'primaryIncludesUnit';
  const unitId = req.unitIds.find((id) => {
    const u = unitDefs.get(id);
    return u && (u.allegiance === 'Any' || u.allegiance === s.roster.allegiance);
  });
  const unit = unitId && unitDefs.get(unitId);
  if (!unitId || !unit) return null;
  const parents = [...s.roster.detachments].sort((a, b) => Number(b.id === preferDetId) - Number(a.id === preferDetId));
  for (const parent of parents) {
    const pdef = detDefs.get(parent.defId);
    if (!pdef?.grantsUnlocks || !['Primary', 'Apex', 'Allied'].includes(pdef.kind)) continue;
    if (def.kind === 'Apex' && pdef.kind === 'Allied') continue;
    if (primaryOnly && pdef.kind !== 'Primary') continue;
    const free = slotsOf(parent).find((sl) => sl.role === unit.role && canUnlock(parent, sl) && !fillOf(parent, sl.id)?.unit && !sl.restriction);
    if (!free) continue;
    let placed = placeUnit(s, parent.id, free.id, unitId);
    // A sub-faction Apex (Command Maniple ← Cybernetica Archmagos): give the commander that sub-faction.
    if (req.kind === 'unlockedByUnit' && req.subFaction && unit.subFactions?.includes(req.subFaction)) placed = setSubFaction(placed, parent.id, free.id, req.subFaction);
    const added = addDetachment(placed, defId, { detachmentId: parent.id, slotId: free.id });
    return { state: added.state, unitId, parentDetId: parent.id, slotId: free.id, newDetId: added.id };
  }
  return null;
}

/**
 * For a sub-faction Apex (Command Maniple ← Cybernetica Archmagos) when the right unit is
 * already in this slot with another sub-faction: switch it (and, one per detachment, the
 * rest of its detachment) to that sub-faction and add the detachment linked to it.
 */
export function planWithSubFaction(
  s: BuilderState,
  defId: string,
  link: { detachmentId: string; slotId: string },
): { state: BuilderState; unitId: string; subFaction: string; newDetId: string } | null {
  const req = detDefs.get(defId)?.requirements.find((r) => r.kind === 'unlockedByUnit');
  if (req?.kind !== 'unlockedByUnit' || !req.subFaction) return null;
  const unit = s.roster.detachments.find((d) => d.id === link.detachmentId)?.fills.find((f) => f.slotId === link.slotId)?.unit;
  const def = unit && unitDefs.get(unit.unitId);
  if (!unit || !def || !req.unitIds.includes(def.id) || !def.subFactions?.includes(req.subFaction) || unit.subFaction === req.subFaction) return null;
  const added = addDetachment(setSubFaction(s, link.detachmentId, link.slotId, req.subFaction), defId, link);
  return { state: added.state, unitId: def.id, subFaction: req.subFaction, newDetId: added.id };
}

export function removeDetachment(s: BuilderState, detId: string): BuilderState {
  const doomed = new Set([detId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of s.roster.detachments)
      if (d.unlockedBy && doomed.has(d.unlockedBy.detachmentId) && !doomed.has(d.id)) {
        doomed.add(d.id);
        grew = true;
      }
  }
  const alliedFaction = { ...s.alliedFaction };
  doomed.forEach((id) => delete alliedFaction[id]);
  return { ...s, alliedFaction, roster: { ...s.roster, detachments: s.roster.detachments.filter((d) => !doomed.has(d.id)) } };
}

export function setChoice(s: BuilderState, detId: string, choice: string): BuilderState {
  return mapDet(s, detId, (d) => ({ ...d, choice }));
}

export function setPrimaryLegion(s: BuilderState, legion: string): BuilderState {
  const prev = s.primaryLegion;
  // Another army list (Legion ↔ Mechanicum): none of the units carry over, so start a fresh list.
  if (armyListOf(prev) !== armyListOf(legion)) return emptyState(legion, s.roster.pointsLimit, s.roster.allegiance);
  const ritesOfWar: Record<string, string> = { ...s.roster.ritesOfWar };
  delete ritesOfWar[prev];
  Object.assign(ritesOfWar, ritesFor(legion));
  // Re-badge placeholder units that carried the old Primary Legion.
  const detachments = s.roster.detachments.map((d) => ({
    ...d,
    fills: d.fills.map((f) => (f.unit?.factionTrait === prev && unitDefs.get(f.unit.unitId)?.factionTrait === null ? { ...f, unit: { ...f.unit, factionTrait: legion } } : f)),
  }));
  return { ...s, primaryLegion: legion, roster: { ...s.roster, name: `${legion} army`, ritesOfWar, detachments } };
}

export function setAlliedFaction(s: BuilderState, detId: string, legion: string): BuilderState {
  const old = s.alliedFaction[detId];
  const det = s.roster.detachments.find((d) => d.id === detId);
  if (det && det.armyList !== armyListOf(legion)) {
    // Another army list: its units can't carry over. Empty it and drop what it unlocked.
    let next = s;
    for (const child of s.roster.detachments.filter((d) => d.unlockedBy?.detachmentId === detId)) next = removeDetachment(next, child.id);
    next = mapDet(next, detId, (d) => ({ ...d, armyList: armyListOf(legion), fills: [], extraSlots: [] }));
    const rites = { ...next.roster.ritesOfWar };
    const stillUsedOld = old && Object.entries(next.alliedFaction).some(([k, v]) => k !== detId && v === old);
    if (old && old !== s.primaryLegion && !stillUsedOld) delete rites[old];
    return { ...next, alliedFaction: { ...next.alliedFaction, [detId]: legion }, roster: { ...next.roster, ritesOfWar: { ...rites, ...ritesFor(legion) } } };
  }
  const ids = new Set([detId, ...s.roster.detachments.filter((d) => d.unlockedBy?.detachmentId === detId).map((d) => d.id)]);
  const ritesOfWar = { ...s.roster.ritesOfWar, ...ritesFor(legion) };
  const stillUsed = old && Object.entries(s.alliedFaction).some(([k, v]) => k !== detId && v === old);
  if (old && old !== s.primaryLegion && !stillUsed) delete ritesOfWar[old];
  const detachments = s.roster.detachments.map((d) =>
    ids.has(d.id) ? { ...d, fills: d.fills.map((f) => (f.unit && unitDefs.get(f.unit.unitId)?.factionTrait === null ? { ...f, unit: { ...f.unit, factionTrait: legion } } : f)) } : d,
  );
  return { ...s, alliedFaction: { ...s.alliedFaction, [detId]: legion }, roster: { ...s.roster, ritesOfWar, detachments } };
}

// ── persistence (per-viewer convenience only) ─────────────────────────────
const KEY = 'hh3-builder-state-v1';
/**
 * Units whose id gained a Faction suffix when every Legion's version was imported
 * (inductii-squad → inductii-squad-death-guard): point saved lists at the new id.
 */
export function migrate(s: BuilderState): BuilderState {
  const slug = (x: string) => x.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fix = (u: UnitInstance): UnitInstance => {
    if (unitDefs.has(u.unitId)) return u;
    const owner = u.factionTrait ?? s.primaryLegion;
    const renamed = `${u.unitId}-${slug(owner)}`;
    return unitDefs.has(renamed) ? { ...u, unitId: renamed } : u;
  };
  return {
    ...s,
    roster: { ...s.roster, detachments: s.roster.detachments.map((d) => ({ ...d, fills: d.fills.map((f) => (f.unit ? { ...f, unit: fix(f.unit) } : f)) })) },
  };
}
export function load(): BuilderState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw) as BuilderState) : null;
  } catch {
    return null;
  }
}
export function save(s: BuilderState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the builder still works, it just won't remember */
  }
}
