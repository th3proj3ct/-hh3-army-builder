/**
 * UI state: the roster plus a little UI-only metadata, changed only through pure
 * operations so every change can be undone and fed to explainChange() as a "what if".
 */
import { CATALOG, LEGIONS } from '../../src/catalog';
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
export { LEGIONS };

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const riteFor = (legion: string) => `${legion.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')}-legiones-astartes`;

export function emptyState(legion = 'Death Guard', pointsLimit = 3000, allegiance: Allegiance = 'Traitor'): BuilderState {
  return {
    primaryLegion: legion,
    alliedFaction: {},
    roster: {
      name: `${legion} army`,
      catalogVersion: CATALOG.version,
      pointsLimit,
      allegiance,
      ritesOfWar: { [legion]: riteFor(legion) },
      detachments: [{ id: 'primary', defId: 'crusade-primary', armyList: 'legiones-astartes', extraSlots: [], fills: [] }],
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
  const det: DetachmentInstance = {
    id,
    defId,
    armyList: parent?.armyList ?? 'legiones-astartes',
    ...(unlockedBy ? { unlockedBy } : {}),
    ...(def.choice ? { choice: def.choice.options[0] } : {}),
    extraSlots: [],
    fills: [],
  };
  const state: BuilderState = { ...s, roster: { ...s.roster, detachments: [...s.roster.detachments, det] } };
  if (def.kind === 'Allied') state.alliedFaction = { ...s.alliedFaction, [id]: LEGIONS.find((l) => l !== s.primaryLegion)! };
  return { state, id };
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
  const ritesOfWar: Record<string, string> = { ...s.roster.ritesOfWar };
  delete ritesOfWar[prev];
  ritesOfWar[legion] = riteFor(legion);
  // Re-badge placeholder units that carried the old Primary Legion.
  const detachments = s.roster.detachments.map((d) => ({
    ...d,
    fills: d.fills.map((f) => (f.unit?.factionTrait === prev && unitDefs.get(f.unit.unitId)?.factionTrait === null ? { ...f, unit: { ...f.unit, factionTrait: legion } } : f)),
  }));
  return { ...s, primaryLegion: legion, roster: { ...s.roster, name: `${legion} army`, ritesOfWar, detachments } };
}

export function setAlliedFaction(s: BuilderState, detId: string, legion: string): BuilderState {
  const old = s.alliedFaction[detId];
  const ids = new Set([detId, ...s.roster.detachments.filter((d) => d.unlockedBy?.detachmentId === detId).map((d) => d.id)]);
  const ritesOfWar = { ...s.roster.ritesOfWar, [legion]: riteFor(legion) };
  const stillUsed = old && Object.entries(s.alliedFaction).some(([k, v]) => k !== detId && v === old);
  if (old && old !== s.primaryLegion && !stillUsed) delete ritesOfWar[old];
  const detachments = s.roster.detachments.map((d) =>
    ids.has(d.id) ? { ...d, fills: d.fills.map((f) => (f.unit && unitDefs.get(f.unit.unitId)?.factionTrait === null ? { ...f, unit: { ...f.unit, factionTrait: legion } } : f)) } : d,
  );
  return { ...s, alliedFaction: { ...s.alliedFaction, [detId]: legion }, roster: { ...s.roster, ritesOfWar, detachments } };
}

// ── persistence (per-viewer convenience only) ─────────────────────────────
const KEY = 'hh3-builder-state-v1';
export function load(): BuilderState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BuilderState) : null;
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
