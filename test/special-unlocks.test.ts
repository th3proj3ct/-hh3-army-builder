/**
 * Special rules that change what a Command/High Command unit unlocks (BSData Special Rules):
 * Tip of the Spear (Planetfall Speartip), Consul-Delegatus (an Apex from a Command slot) and
 * Tank Commander (X) (X Armour-only Auxiliaries).
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog';
import type { DetachmentInstance, Roster, UnitInstance } from '../src/model';
import { validate } from '../src/validate';
import { emptyState, placeUnit, planWithCommander, unlockSummary } from '../ui/src/state';

let seq = 0;
const byId = new Map(CATALOG.units.map((d) => [d.id, d]));
const u = (unitId: string): UnitInstance => {
  const def = byId.get(unitId)!;
  return { id: `s${++seq}`, unitId, models: def.points.minModels, options: [], ...(def.factionTrait === null ? { factionTrait: 'Death Guard' } : {}) };
};
const det = (id: string, defId: string, fills: Record<string, string>, from?: string): DetachmentInstance => ({
  id, defId, armyList: 'legiones-astartes', extraSlots: [],
  ...(from ? { unlockedBy: { detachmentId: 'p', slotId: `crusade-primary.${from}` } } : {}),
  fills: Object.entries(fills).map(([k, unitId]) => ({ slotId: `${defId}.${k}`, unit: u(unitId) })),
});
const army = (primary: Record<string, string>, ...rest: DetachmentInstance[]): Roster => ({
  name: 't', catalogVersion: CATALOG.version, pointsLimit: 3000, allegiance: 'Traitor',
  ritesOfWar: { 'Death Guard': 'death-guard-legiones-astartes' },
  detachments: [det('p', 'crusade-primary', { Troops1: 'tactical-squad', ...primary }), ...rest],
});
const ids = (r: Roster) => [...new Set(validate(r, CATALOG).errors.map((e) => e.ruleId))].sort();
const speartip = (id = 'x', from = 'Command1') => det(id, 'planetfall-speartip', { Retinue1: 'praetorian-command-squad-with-jump-packs', Elites1: 'veteran-assault-squad' }, from);

describe('Tip of the Spear → Planetfall Speartip', () => {
  it('a Master of Descent in the Primary Detachment makes it available', () =>
    expect(ids(army({ Command1: 'master-of-descent' }, speartip()))).toEqual([]));
  it('without a Master of Descent it is locked', () => expect(ids(army({ Command1: 'centurion' }, speartip()))).toEqual(['DET-UNLOCK-SPECIFIC']));
  it('only once per army', () =>
    expect(ids(army({ Command1: 'master-of-descent', Command2: 'centurion' }, speartip('x'), speartip('y', 'Command2')))).toEqual(['DET-MAX-ONCE']));
  it('Retinue: Praetorian Command Squad with Jump Packs; Elites: Veteran Assault Squads', () =>
    expect(ids(army({ Command1: 'master-of-descent' }, det('x', 'planetfall-speartip', { Retinue1: 'praetorian-command-squad', Elites1: 'veteran-assault-squad' }, 'Command1')))).toEqual(['SLOT-RESTRICTION']));
  it('"+ Master of Descent" puts one in a free Primary Command slot and unlocks it there', () => {
    const s = placeUnit(emptyState('Death Guard'), 'primary', 'crusade-primary.Troops1', 'tactical-squad');
    const plan = planWithCommander(s, 'planetfall-speartip', 'primary')!;
    expect(plan.unitId).toBe('master-of-descent');
    expect(plan.parentDetId).toBe('primary');
    expect(plan.slotId).toMatch(/Command\d$/);
  });
});

describe('Consul-Delegatus: an Apex from a Command slot', () => {
  it('a Delegatus in a Command slot may unlock an Apex', () =>
    expect(ids(army({ Command1: 'delegatus' }, det('x', 'army-vanguard', { Elites1: 'veteran-assault-squad' }, 'Command1')))).toEqual([]));
  it('a Centurion may not', () =>
    expect(ids(army({ Command1: 'centurion' }, det('x', 'army-vanguard', { Elites1: 'veteran-assault-squad' }, 'Command1')))).toEqual(['DET-UNLOCK-CMD']));
  it('one Apex *instead of* the Auxiliary, not both', () =>
    expect(ids(army({ Command1: 'delegatus' }, det('x', 'army-vanguard', { Elites1: 'veteran-assault-squad' }, 'Command1'), det('y', 'armoured-support', { Armour1: 'predator' }, 'Command1')))).toEqual(['DET-UNLOCK-ONE']));
  it('only one Consul-Delegatus per army', () => expect(ids(army({ Command1: 'delegatus', Command2: 'mounted-delegatus' }))).toEqual(['ARMY-CONSUL-ONE']));
});

describe('Tank Commander (X): X Armour-only Auxiliaries', () => {
  const tanks = (second: DetachmentInstance) =>
    army({ HighCommand1: 'spartan-prometheus-command-tank' }, det('x', 'armoured-support', { Armour1: 'predator' }, 'HighCommand1'), second);
  it('the Spartan Prometheus imports with Tank Commander (2)', () => expect(byId.get('spartan-prometheus-command-tank')?.tankCommander).toBe(2));
  it('unlocks two Armoured Supports', () => expect(ids(tanks(det('y', 'armoured-support', { Armour1: 'predator' }, 'HighCommand1')))).toEqual([]));
  it('but not Armoured Support plus Shock Assault', () =>
    expect(ids(tanks(det('y', 'shock-assault', { HeavyAssault1: 'cataphractii-terminator-squad' }, 'HighCommand1')))).toEqual(['DET-UNLOCK-ONE']));
  it('the builder says so', () => {
    const s = placeUnit(emptyState('Death Guard'), 'primary', 'crusade-primary.HighCommand1', 'spartan-prometheus-command-tank');
    const d = s.roster.detachments[0]!;
    expect(unlockSummary(d, CATALOG.detachments[0]!.slots[0]!, 0)).toContain('two Armour-only Auxiliaries');
  });
});
