import { CATALOG } from '../../src/catalog';
import { explainChange } from '../../src/explain';
import type { Issue } from '../../src/model';
import { addDetachment, detDefs, placeUnit, type BuilderState } from './state';

/** Split "X happened — Rule: Title." into its two halves for display. */
export function splitMessage(m: string): { what: string; rule: string } {
  const i = m.lastIndexOf(' — Rule: ');
  return i < 0 ? { what: m, rule: '' } : { what: m.slice(0, i), rule: m.slice(i + 9).replace(/\.$/, '') };
}

/** Errors that placing `unitId` in this slot would introduce. Empty ⇒ allowed. */
export function unitReasons(s: BuilderState, detId: string, slotId: string, unitId: string): Issue[] {
  return explainChange(s.roster, CATALOG, (draft) => placeUnit({ ...s, roster: draft }, detId, slotId, unitId).roster);
}

/**
 * Errors that adding a detachment would introduce, minus the ones you fix by
 * filling it (empty detachment, "must include a Paragon / unit X").
 */
export function detachmentReasons(s: BuilderState, defId: string, unlockedBy?: { detachmentId: string; slotId: string }): Issue[] {
  const def = detDefs.get(defId);
  return explainChange(s.roster, CATALOG, (draft) => addDetachment({ ...s, roster: draft }, defId, unlockedBy).state.roster).filter(
    (e) =>
      e.ruleId !== 'ARMY-DETACHMENT-NOT-EMPTY' &&
      e.ruleId !== 'WARLORD-PARAGON' &&
      !(e.ruleId === 'DET-REQUIREMENT' && def && e.message.startsWith(`${def.name} must include`)),
  );
}
