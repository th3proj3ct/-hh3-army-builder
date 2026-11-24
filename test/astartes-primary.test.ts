/**
 * Legiones Astartes Primary Detachments (Warhammer Community, Nov 2026) on real imported units:
 * layouts, each detachment's restrictions and benefits, and switching type in the builder.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog';
import type { DetachmentInstance, Roster, UnitInstance } from '../src/model';
import { validate } from '../src/validate';
import { addBenefitSlot, benefitAllowance, emptyState, exchangeSlot, exchangesFor, placeUnit, setPrimaryDetachment, slotsOf } from '../ui/src/state';
import { deathGuardSample } from '../ui/src/samples';

let seq = 0;
const byId = new Map(CATALOG.units.map((d) => [d.id, d]));
type Fill = string | { unit: string; prime?: string; options?: [string, number][] };
const u = (spec: Fill): UnitInstance => {
  const s = typeof spec === 'string' ? { unit: spec } : spec;
  const def = byId.get(s.unit);
  if (!def) throw new Error(`unknown unit ${s.unit}`);
  return {
    id: `p${++seq}`,
    unitId: s.unit,
    models: def.points.minModels,
    options: (s.options ?? []).map(([optionId, count]) => ({ optionId, count })),
    ...(def.factionTrait === null ? { factionTrait: 'Death Guard' } : {}),
  };
};
const det = (id: string, defId: string, fills: Record<string, Fill>, extra: Partial<DetachmentInstance> = {}): DetachmentInstance => ({
  id,
  defId,
  armyList: 'legiones-astartes',
  extraSlots: [],
  fills: Object.entries(fills).map(([k, f]) => ({ slotId: `${defId}.${k}`, unit: u(f), ...(typeof f !== 'string' && f.prime ? { primeAdvantage: f.prime } : {}) })),
  ...extra,
});
const army = (primary: DetachmentInstance, ...rest: DetachmentInstance[]): Roster => ({
  name: 't', catalogVersion: CATALOG.version, pointsLimit: 3000, allegiance: 'Traitor',
  ritesOfWar: { 'Death Guard': 'death-guard-legiones-astartes' },
  detachments: [primary, ...rest],
});
const result = (r: Roster) => validate(r, CATALOG);
const ids = (r: Roster) => [...new Set(result(r).errors.map((e) => e.ruleId))].sort();
const from = (slot: string) => ({ unlockedBy: { detachmentId: 'p', slotId: slot } });

describe('layouts (★ = Prime)', () => {
  const layout = (id: string) => CATALOG.detachments.find((d) => d.id === id)!.slots.map((s) => `${s.prime ? '*' : ''}${s.role}`).join(',');
  it('Pride of the Legion', () =>
    expect(layout('pride-of-the-legion')).toBe('HighCommand,*Command,Command,Retinue,Retinue,Retinue,*HeavyAssault,HeavyAssault,HeavyAssault,HeavyAssault,HeavyAssault,*Elites,Elites,Elites,Elites,Elites'));
  it('Fury of the Ancients', () =>
    expect(layout('fury-of-the-ancients')).toBe('HighCommand,Retinue,*Command,Command,*WarEngine,WarEngine,WarEngine,WarEngine,WarEngine,*WarEngine,WarEngine,WarEngine,WarEngine,WarEngine'));
  it('Sky-Hunter Phalanx', () =>
    expect(layout('sky-hunter-phalanx')).toBe('HighCommand,*Command,Command,Retinue,Retinue,*FastAttack,FastAttack,FastAttack,FastAttack,FastAttack,*FastAttack,FastAttack,FastAttack,FastAttack,FastAttack'));
  it('Armoured Spearhead (no Prime slots)', () =>
    expect(layout('armoured-spearhead')).toBe('HighCommand,Command,Command,Command,Transport,Armour,Armour,Armour,Armour,Armour,Armour,Armour,Armour,Armour,Armour'));
  it('Orbital Drop Assault', () =>
    expect(layout('orbital-drop-assault')).toBe('HighCommand,*Command,Command,Retinue,*HeavyAssault,HeavyAssault,*Troops,Troops,*Elites,Elites,Transport,Transport'));
});

describe('Pride of the Legion', () => {
  const pride = (fills: Record<string, Fill>, extra: Partial<DetachmentInstance> = {}) => det('p', 'pride-of-the-legion', { HighCommand1: 'praetor', ...fills }, extra);
  it('legal with a Master of the Legion and Elites', () => expect(ids(army(pride({ Elites1: 'veteran-assault-squad' })))).toEqual([]));
  it('needs a Master of the Legion', () =>
    expect(ids(army(det('p', 'pride-of-the-legion', { Command1: 'centurion', Elites1: 'veteran-assault-squad' })))).toEqual(['PRIMARY-UNIT-LIMITS']));
  it('Officer Cadre is allowed, Reaping Host is not', () => {
    expect(ids(army(pride({ Elites1: 'veteran-assault-squad' }), det('a', 'officer-cadre', { Command1: 'centurion' }, from('pride-of-the-legion.HighCommand1'))))).toEqual([]);
    expect(ids(army(pride({ Command1: 'centurion' }), det('a', 'reaping-host', { Troops1: 'tactical-squad' }, from('pride-of-the-legion.Command1'))))).toContain('PRIMARY-ALLOWED-DETACHMENTS');
  });
  it('one Heavy Transport slot per filled Retinue/Heavy Assault/Elites slot', () => {
    const one = pride({ Elites1: 'veteran-assault-squad' }, { benefitSlots: [{ id: 'b1', role: 'HeavyTransport' }] });
    one.fills.push({ slotId: 'b1', unit: u('land-raider-carrier') });
    expect(ids(army(one))).toEqual([]);
    const two = pride({ Elites1: 'veteran-assault-squad' }, { benefitSlots: [{ id: 'b1', role: 'HeavyTransport' }, { id: 'b2', role: 'HeavyTransport' }] });
    expect(ids(army(two))).toContain('PRIMARY-EXTRA-SLOTS');
  });
  it("its Lord of War Detachment only takes Transport units", () => {
    const low = det('l', 'lord-of-war', { LordOfWar1: 'mortarion' });
    expect(ids(army(pride({ Elites1: 'veteran-assault-squad' }), low))).toContain('PRIMARY-UNIT-LIMITS');
  });
  it("Prime Advantages that add slots aren't allowed", () =>
    expect(ids(army(pride({ Elites1: { unit: 'veteran-assault-squad', prime: 'logistical-benefit' } }, { extraSlots: [{ id: 'x', role: 'Troops', grantedBy: { slotId: 'pride-of-the-legion.Elites1', primeAdvantageId: 'logistical-benefit' } }] })))).toContain('PRIMARY-NO-SLOT-PRIMES'));
});

describe('Fury of the Ancients', () => {
  const fury = (fills: Record<string, Fill>) => det('p', 'fury-of-the-ancients', fills);
  it('a Forge Lord and Contemptors are legal; Ancient of War on a Prime Walker', () =>
    expect(ids(army(fury({ Command1: 'forge-lord', WarEngine1: { unit: 'contemptor-dreadnought', prime: 'ancient-of-war' } })))).toEqual([]));
  it("Command models need Battlesmith (a Centurion doesn't have it)", () =>
    expect(ids(army(fury({ Command1: 'centurion', WarEngine1: 'contemptor-dreadnought' })))).toEqual(['PRIMARY-UNIT-LIMITS']));
  it('Ancient of War is only for Fury of the Ancients, and only Walkers', () => {
    expect(ids(army(det('p', 'crusade-primary', { Troops1: { unit: 'tactical-squad', prime: 'ancient-of-war' } })))).toContain('PRIME-DET-ALLOWED');
    expect(ids(army(fury({ Command1: { unit: 'forge-lord', prime: 'ancient-of-war' } })))).toContain('PRIME-ELIGIBILITY');
  });
});

describe('Armoured Spearhead', () => {
  const spear = (fills: Record<string, Fill>) => det('p', 'armoured-spearhead', fills);
  it('a Predator with a Decurion upgrade may fill a Command slot', () =>
    expect(ids(army(spear({ Command1: { unit: 'predator', options: [['predator--decurion-locus', 1]] }, Armour1: 'predator' })))).toEqual([]));
  it('without the Decurion upgrade it may not', () => expect(ids(army(spear({ Command1: 'predator' })))).toContain('SLOT-ROLE-MATCH'));
  it('non-Vehicles need Battlesmith; Move 0 units are out', () => {
    expect(ids(army(spear({ Command1: 'forge-lord', Armour1: 'predator' })))).toEqual([]);
    expect(ids(army(spear({ Command1: 'centurion', Armour1: 'predator' })))).toEqual(['PRIMARY-UNIT-LIMITS']);
    expect(ids(army(spear({ Armour1: 'predator', Transport1: 'drop-pod' })))).toEqual(['PRIMARY-UNIT-LIMITS']);
  });
  it('the builder adds the Decurion upgrade when a Predator goes in a Command slot', () => {
    const s = placeUnit(setPrimaryDetachment(emptyState('Death Guard'), 'armoured-spearhead').state, 'primary', 'armoured-spearhead.Command1', 'predator');
    expect(s.roster.detachments[0]!.fills[0]!.unit!.options.map((o) => o.optionId)).toEqual(['predator--decurion-locus']);
    expect(ids(s.roster)).toEqual([]);
  });
});

describe('Sky-Hunter Phalanx and Orbital Drop Assault', () => {
  it("Sky-Hunter: non-Antigrav units are only a warning (they can't deploy unless carried by a Flyer)", () => {
    const r = army(det('p', 'sky-hunter-phalanx', { FastAttack1: 'scimitar-jetbike-squadron', Command1: 'centurion' }));
    expect(ids(r)).toEqual([]);
    expect(result(r).warnings.map((w) => w.ruleId)).toContain('PRIMARY-DEPLOYMENT');
  });
  it('Orbital Drop: at most one First Strike', () => {
    const p = det('p', 'orbital-drop-assault', { Command1: 'centurion', Command2: 'centurion', Troops1: 'tactical-squad' });
    const fs = (id: string, slot: string) => det(id, 'first-strike', { FastAttack1: 'scimitar-jetbike-squadron' }, from(`orbital-drop-assault.${slot}`));
    expect(ids(army(p, fs('a', 'Command1')))).toEqual([]);
    expect(ids(army(p, fs('a', 'Command1'), fs('b', 'Command2')))).toContain('PRIMARY-ALLOWED-DETACHMENTS');
  });
  it('Orbital Drop: a Transport or Heavy Transport slot per non-Vehicle unit', () => {
    let s = setPrimaryDetachment(emptyState('Death Guard'), 'orbital-drop-assault').state;
    s = placeUnit(s, 'primary', 'orbital-drop-assault.Troops1', 'tactical-squad');
    expect(benefitAllowance(s, s.roster.detachments[0]!)).toEqual({ allowed: 1, used: 0 });
    s = addBenefitSlot(s, 'primary', 'Transport');
    expect(ids(s.roster)).toEqual([]);
    s = addBenefitSlot(s, 'primary', 'HeavyTransport');
    expect(ids(s.roster)).toContain('PRIMARY-EXTRA-SLOTS');
  });
});

describe('switching the Primary Detachment type', () => {
  it('units move to matching slots; ones with no slot are dropped and reported', () => {
    const r = setPrimaryDetachment(deathGuardSample(), 'pride-of-the-legion');
    const p = r.state.roster.detachments.find((d) => d.defId === 'pride-of-the-legion')!;
    expect(p.fills.map((f) => f.unit!.unitId)).toEqual(expect.arrayContaining(['calas-typhon', 'centurion']));
    expect(r.dropped).toEqual(expect.arrayContaining(['Tactical Squad', 'Rhino']));
    // Detachments unlocked from slots that still exist keep their link.
    for (const d of r.state.roster.detachments.filter((x) => x.unlockedBy))
      expect(p.fills.some((f) => f.slotId === d.unlockedBy!.slotId)).toBe(true);
  });
  it('and back again, with nothing lost that fits', () => {
    const there = setPrimaryDetachment(emptyState('Death Guard'), 'pride-of-the-legion').state;
    const filled = placeUnit(there, 'primary', 'pride-of-the-legion.Command1', 'centurion');
    const back = setPrimaryDetachment(filled, 'crusade-primary');
    expect(back.dropped).toEqual([]);
    expect(back.state.roster.detachments[0]!.fills[0]!.slotId).toBe('crusade-primary.Command1');
  });
});

describe('Sky-Hunter Phalanx: White Scars slot exchanges', () => {
  const ws = (fills: Record<string, Fill>, swaps: Record<string, 'Elites' | 'Support'>) => {
    const d = det('p', 'sky-hunter-phalanx', fills, { slotExchanges: Object.fromEntries(Object.entries(swaps).map(([k, v]) => [`sky-hunter-phalanx.${k}`, v])) });
    for (const f of d.fills) if (f.unit && byId.get(f.unit.unitId)?.factionTrait === null) f.unit.factionTrait = 'White Scars';
    return { ...army(d), ritesOfWar: { 'White Scars': 'white-scars-legiones-astartes' } };
  };
  it('a Retinue slot exchanged for Elites takes Golden Keshig', () =>
    expect(ids(ws({ Command1: 'centurion', Retinue1: 'golden-keshig' }, { Retinue1: 'Elites' }))).toEqual([]));
  it('a Fast Attack slot exchanged for Support takes a Kyzagan Assault Speeder, and nothing else', () => {
    expect(ids(ws({ Command1: 'centurion', FastAttack2: 'kyzagan-assault-speeder' }, { FastAttack2: 'Support' }))).toEqual([]);
    expect(ids(ws({ Command1: 'centurion', FastAttack2: 'techmarine' }, { FastAttack2: 'Support' }))).toContain('SLOT-RESTRICTION');
  });
  it("only for White Scars, and only the exchanges the detachment offers", () => {
    const dg = army(det('p', 'sky-hunter-phalanx', { Command1: 'centurion' }, { slotExchanges: { 'sky-hunter-phalanx.Retinue1': 'Elites' } }));
    expect(ids(dg)).toContain('PRIMARY-SLOT-EXCHANGE');
    expect(ids(ws({ Command1: 'centurion' }, { Command2: 'Elites' } as never))).toContain('PRIMARY-SLOT-EXCHANGE');
  });
  it('the builder offers the exchange only to White Scars, and an exchanged Prime slot is no longer Prime', () => {
    let s = setPrimaryDetachment(emptyState('White Scars'), 'sky-hunter-phalanx').state;
    const d = () => s.roster.detachments[0]!;
    expect(exchangesFor(s, d(), 'sky-hunter-phalanx.FastAttack1').map((x) => x.to)).toEqual(['Support']);
    s = exchangeSlot(s, 'primary', 'sky-hunter-phalanx.FastAttack1', 'Support');
    const slot = slotsOf(d()).find((x) => x.id === 'sky-hunter-phalanx.FastAttack1')!;
    expect([slot.role, !!slot.prime]).toEqual(['Support', false]);
    s = exchangeSlot(s, 'primary', 'sky-hunter-phalanx.FastAttack1', undefined);
    expect(d().slotExchanges).toBeUndefined();
    const dg = setPrimaryDetachment(emptyState('Death Guard'), 'sky-hunter-phalanx').state;
    expect(exchangesFor(dg, dg.roster.detachments[0]!, 'sky-hunter-phalanx.Retinue1')).toEqual([]);
  });
});

describe('Ancient of War: Walkers that are not Malefic', () => {
  it('Malefic is imported as a model sub-type (Mhara Gal Dreadnought, Gal Vorbak)', () => {
    expect(byId.get('mhara-gal-dreadnought')?.modelTags).toEqual(expect.arrayContaining(['Walker', 'Malefic']));
    expect(byId.get('gal-vorbak')?.modelTags).toContain('Malefic');
    expect(byId.get('contemptor-dreadnought')?.modelTags).not.toContain('Malefic');
  });
  it('a Mhara Gal Dreadnought (Malefic Walker) may not take it', () => {
    const r = army(det('p', 'fury-of-the-ancients', { WarEngine1: { unit: 'mhara-gal-dreadnought', prime: 'ancient-of-war' } }));
    const e = result(r).errors.find((x) => x.ruleId === 'PRIME-ELIGIBILITY');
    expect(e?.message).toMatch(/Malefic/);
  });
});
