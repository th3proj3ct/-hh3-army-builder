/**
 * Legiones Astartes detachments (Liber Astartes, as shown on Wahapedia, re-read 13 Nov 2026),
 * on real imported units. Each specific-unit Auxiliary is checked three ways: legal when its
 * own unit unlocks it, refused when another Command unit does, refused for the wrong units.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog';
import type { DetachmentInstance, Roster, UnitInstance } from '../src/model';
import { validate } from '../src/validate';
import { forPrimaryLegion } from '../ui/src/fits';

let seq = 0;
const byId = new Map(CATALOG.units.map((d) => [d.id, d]));
const u = (unitId: string): UnitInstance => {
  const def = byId.get(unitId);
  if (!def) throw new Error(`unknown unit ${unitId}`);
  return { id: `a${++seq}`, unitId, models: def.points.minModels, options: [], ...(def.factionTrait === null ? { factionTrait: 'Death Guard' } : {}) };
};
const det = (id: string, defId: string, fills: Record<string, UnitInstance>, fromCommand1 = false): DetachmentInstance => ({
  id,
  defId,
  armyList: 'legiones-astartes',
  ...(fromCommand1 ? { unlockedBy: { detachmentId: 'p', slotId: 'crusade-primary.Command1' } } : {}),
  extraSlots: [],
  fills: Object.entries(fills).map(([k, unit]) => ({ slotId: `${defId}.${k}`, unit })),
});
/** Primary with `commander` in Command 1 and a Tactical Squad, plus one unlocked Auxiliary. */
const army = (commander: string, auxId: string, fills: Record<string, UnitInstance>, allegiance: 'Traitor' | 'Loyalist' = 'Traitor'): Roster => ({
  name: 't',
  catalogVersion: CATALOG.version,
  pointsLimit: 3000,
  allegiance,
  ritesOfWar: { 'Death Guard': 'death-guard-legiones-astartes' },
  detachments: [det('p', 'crusade-primary', { Command1: u(commander), Troops1: u('tactical-squad') }), det('x', auxId, fills, true)],
});
const ids = (r: Roster) => [...new Set(validate(r, CATALOG).errors.map((e) => e.ruleId))].sort();

describe('Legiones Astartes detachments: slot layouts match Wahapedia', () => {
  const layout = (id: string) => CATALOG.detachments.find((d) => d.id === id)!.slots.map((s) => `${s.prime ? '*' : ''}${s.role}`).join(',');
  const expected: Record<string, string> = {
    'linebreaker-echelon': 'HeavyAssault,HeavyAssault,Retinue,WarEngine',
    'maelstrom-sentry-battery': 'Support,Support,Recon,Recon,Recon',
    'daemonic-manifestation': 'HeavyAssault,HeavyAssault,HeavyAssault',
    'veteran-cadre': 'Retinue,Elites,HeavyTransport',
    'apothecarion-delegation': '*Support,Support,Support,Support,Support,Support',
    'techmarine-covenant': '*Support,Support,Support,Support,Support,Support',
    'recon-demi-company': '*Recon,Recon,Recon,FastAttack',
    'storm-battery': 'Support,Support,Armour,Armour',
    'dreadnought-talon': 'WarEngine,WarEngine,WarEngine',
  };
  for (const [id, slots] of Object.entries(expected)) it(id, () => expect(layout(id)).toBe(slots));
});

describe('specific-unit Auxiliaries', () => {
  it('Dreadnought Talon: Mortificator + Contemptors is legal', () =>
    expect(ids(army('mortificator', 'dreadnought-talon', { WarEngine1: u('contemptor-dreadnought'), WarEngine2: u('contemptor-dreadnought') }))).toEqual([]));
  it('Dreadnought Talon: a Centurion can\'t unlock it', () =>
    expect(ids(army('centurion', 'dreadnought-talon', { WarEngine1: u('contemptor-dreadnought') }))).toEqual(['DET-UNLOCK-SPECIFIC']));
  it('Dreadnought Talon: only Contemptors', () =>
    expect(ids(army('mortificator', 'dreadnought-talon', { WarEngine1: u('leviathan-dreadnought') }))).toEqual(['SLOT-RESTRICTION']));

  it('Storm Battery: Siege Breaker + Rapier Battery + Vindicator is legal', () =>
    expect(ids(army('siege-breaker', 'storm-battery', { Support1: u('rapier-battery'), Armour1: u('vindicator-siege-tank') }))).toEqual([]));
  it('Storm Battery: Armour slots only take Arquitor Bombards or Vindicators', () =>
    expect(ids(army('siege-breaker', 'storm-battery', { Armour1: u('predator') }))).toEqual(['SLOT-RESTRICTION']));

  it('Recon Demi-company: Vigilator + Reconnaissance Squad is legal', () =>
    expect(ids(army('vigilator', 'recon-demi-company', { Recon1: u('reconnaissance-squad') }))).toEqual([]));
  it('Recon Demi-company: Recon slots only take Reconnaissance Squads', () =>
    expect(ids(army('vigilator', 'recon-demi-company', { Recon1: u('tarantula-battery') }))).toEqual(['SLOT-RESTRICTION']));

  it('Veteran Cadre: Legion Champion unlocks it, no unit restrictions', () =>
    expect(ids(army('legion-champion', 'veteran-cadre', { Retinue1: u('deathshroud-terminator-squad') }))).toEqual([]));

  it('Daemonic Manifestation needs a Traitor Esoterist', () =>
    expect(ids(army('esoterist', 'daemonic-manifestation', {}, 'Loyalist'))).toContain('DET-UNLOCK-SPECIFIC'));

  it('Techmarine Covenant: any Command unit, Support slots only take Techmarines', () => {
    expect(ids(army('centurion', 'techmarine-covenant', { Support1: u('techmarine') }))).toEqual([]);
    expect(ids(army('centurion', 'techmarine-covenant', { Support1: u('apothecary') }))).toEqual(['SLOT-RESTRICTION']);
  });
});

describe('Officer of the Line (X): Centurions unlock two Auxiliaries from a Command slot', () => {
  /** Primary with `commander` in Command 1, plus one Auxiliary per entry, all unlocked from Command 1. */
  const many = (commander: string, auxes: [string, Record<string, UnitInstance>][]): Roster => ({
    ...army(commander, auxes[0]![0], auxes[0]![1]),
    detachments: [
      det('p', 'crusade-primary', { Command1: u(commander), Troops1: u('tactical-squad') }),
      ...auxes.map(([id, fills], i) => det(`x${i}`, id, fills, true)),
    ],
  });
  const armour = ['armoured-support', { Armour1: u('predator') }] as [string, Record<string, UnitInstance>];
  const heavy = ['heavy-support', { WarEngine1: u('contemptor-dreadnought') }] as [string, Record<string, UnitInstance>];
  const third = ['tactical-support', { Troops1: u('tactical-squad') }] as [string, Record<string, UnitInstance>];

  it('the importer picked the rule up for Centurions', () => {
    expect(byId.get('centurion')?.commandAuxUnlocks).toBe(2);
    expect(byId.get('centurion-in-terminator-armour')?.commandAuxUnlocks).toBe(2);
  });
  it('a Centurion unlocks two Auxiliaries', () => expect(ids(many('centurion', [armour, heavy]))).toEqual([]));
  it('but not three', () => expect(ids(many('centurion', [armour, heavy, third]))).toEqual(['DET-UNLOCK-ONE']));
  it('a commander without the rule still unlocks one', () => expect(ids(many('master-of-signals', [armour, heavy]))).toEqual(['DET-UNLOCK-ONE']));
});

describe('Legion-specific detachments are hidden for other Legions', () => {
  const visibleFor = (legion: string) => CATALOG.detachments.filter((d) => forPrimaryLegion(d, legion)).map((d) => d.id);
  it('Death Guard sees Reaping Host and the generic ones, not other Legions\' detachments', () => {
    const dg = visibleFor('Death Guard');
    expect(dg).toContain('reaping-host');
    expect(dg).toContain('dreadnought-talon');
    for (const other of ['exalted-conclave', 'medusan-vanguard', 'brotherhood-of-the-phoenix']) expect(dg).not.toContain(other);
  });
  it('Word Bearers see Exalted Conclave but not Reaping Host', () => {
    const wb = visibleFor('Word Bearers');
    expect(wb).toContain('exalted-conclave');
    expect(wb).not.toContain('reaping-host');
  });
});
