import type { Catalog, Roster, UnitDef, UnitInstance } from './model';

/**
 * Points for one unit: base cost (covers minModels) + extra models + options.
 * All values are integers, so totals never drift. Unknown options cost 0 here;
 * the validator reports them separately (OPT-EXISTS).
 */
export function unitPoints(inst: UnitInstance, def: UnitDef): number {
  const extraModels = Math.max(0, inst.models - def.points.minModels);
  let total = def.points.base + extraModels * def.points.perExtraModel;
  for (const sel of inst.options) {
    const opt = def.options.find((o) => o.id === sel.optionId);
    if (opt) total += opt.cost.points * sel.count;
  }
  return total;
}

export function* rosterUnits(roster: Roster): Generator<{ detachmentId: string; slotId: string; unit: UnitInstance }> {
  for (const det of roster.detachments) {
    for (const fill of det.fills) {
      if (fill.unit) yield { detachmentId: det.id, slotId: fill.slotId, unit: fill.unit };
    }
  }
}

export function totalPoints(roster: Roster, catalog: Catalog): number {
  const byId = new Map(catalog.units.map((u) => [u.id, u]));
  let total = 0;
  for (const { unit } of rosterUnits(roster)) {
    const def = byId.get(unit.unitId);
    if (def) total += unitPoints(unit, def);
  }
  return total;
}

/** "no more than X% (rounded up to the nearest whole number) of the Points Limit". */
export function shareCap(limit: number, share: number): number {
  return Math.ceil(limit * share);
}
