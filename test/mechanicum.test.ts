/**
 * Mechanicum on real imported units (BSData Mechanicum.json): the import itself, sub-factions
 * (one per detachment), the five sub-faction Apex detachments, and Mechanicum as an ally.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog';
import type { DetachmentInstance, Roster, UnitInstance } from '../src/model';
import { validate } from '../src/validate';
import { addDetachment, emptyState, placeUnit, planWithCommander, planWithSubFaction, setAlliedFaction, setPrimaryLegion, setSubFaction } from '../ui/src/state';
import { forArmyList, slotAccepts } from '../ui/src/fits';

let seq = 0;
const byId = new Map(CATALOG.units.map((d) => [d.id, d]));
const u = (unitId: string, subFaction?: string): UnitInstance => {
  const def = byId.get(unitId);
  if (!def) throw new Error(`unknown unit ${unitId}`);
  return { id: `m${++seq}`, unitId, models: def.points.minModels, options: [], ...(def.factionTrait === null ? { factionTrait: 'Death Guard' } : {}), ...(subFaction ? { subFaction } : {}) };
};
const det = (id: string, defId: string, fills: Record<string, UnitInstance>, armyList = 'mechanicum', unlockedBy?: DetachmentInstance['unlockedBy']): DetachmentInstance => ({
  id,
  defId,
  armyList,
  ...(unlockedBy ? { unlockedBy } : {}),
  extraSlots: [],
  fills: Object.entries(fills).map(([k, unit]) => ({ slotId: `${defId}.${k}`, unit })),
});
const mech = (dets: DetachmentInstance[], allegiance: 'Traitor' | 'Loyalist' = 'Loyalist'): Roster => ({
  name: 'm', catalogVersion: CATALOG.version, pointsLimit: 3000, allegiance, ritesOfWar: {}, detachments: dets,
});
const ids = (r: Roster) => [...new Set(validate(r, CATALOG).errors.map((e) => e.ruleId))].sort();
const fromHC = { detachmentId: 'p', slotId: 'crusade-primary.HighCommand1' };
/** Mechanicum Primary: Archmagos (sub-faction `sub`) in High Command, a Tech-Priest, plus an Apex unlocked by the Archmagos. */
const withApex = (sub: string, apexId: string, fills: Record<string, UnitInstance>) =>
  mech([det('p', 'crusade-primary', { HighCommand1: u('archmagos', sub), Troops1: u('tech-priest', sub) }), det('x', apexId, fills, 'mechanicum', fromHC)]);

describe('Mechanicum import', () => {
  it('imports the Mechanicum list as its own army list with the Mechanicum Faction', () => {
    const units = CATALOG.units.filter((d) => d.armyList === 'mechanicum');
    expect(units.length).toBeGreaterThanOrEqual(39);
    expect(units.every((d) => d.factionTrait === 'Mechanicum')).toBe(true);
    // Mechanicum units stay out of the Legiones Astartes list.
    expect(CATALOG.units.filter((d) => d.armyList === 'legiones-astartes').every((d) => d.factionTrait !== 'Mechanicum')).toBe(true);
  });
  it('reads sub-factions: fixed on Castellax, a choice of seven on an Archmagos', () => {
    expect(byId.get('castellax-battle-maniple')?.subFaction).toBe('Cybernetica');
    expect(byId.get('myrmidon-secutor-host')?.subFaction).toBe('Myrmidax');
    expect(byId.get('archmagos')?.subFactions).toEqual(['Archimandrite', 'Cybernetica', 'Lacrymaerta', 'Macrotek', 'Malagra', 'Myrmidax', 'Reductor']);
  });
  it('reads Officer of the Line (2) from the Magos category and Traitor-only from hidden modifiers', () => {
    expect(byId.get('magos')?.commandAuxUnlocks).toBe(2);
    expect(byId.get('decimator')?.allegiance).toBe('Traitor');
    expect(byId.get('anacharis-scoria')?.allegiance).toBe('Traitor');
    expect(byId.get('castellax-battle-maniple')?.allegiance).toBe('Any');
  });
});

describe('Mechanicum sub-factions', () => {
  const primary = (fills: Record<string, UnitInstance>) => mech([det('p', 'crusade-primary', fills)]);
  it('a Magos and Tech-Priests of one sub-faction are legal', () =>
    expect(ids(primary({ Command1: u('magos', 'Cybernetica'), Troops1: u('tech-priest', 'Cybernetica'), Troops2: u('tech-priest', 'Cybernetica') }))).toEqual([]));
  it('two sub-factions in one detachment are not', () =>
    expect(ids(primary({ Command1: u('magos', 'Cybernetica'), Troops1: u('tech-priest', 'Myrmidax') }))).toEqual(['DET-SINGLE-SUBFACTION']));
  it('a unit that offers sub-factions must take one', () => expect(ids(primary({ Troops1: u('tech-priest') }))).toEqual(['UNIT-SUB-FACTION']));
  it("a fixed sub-faction can't be changed", () => {
    const r = mech([det('p', 'crusade-primary', { Troops1: u('tech-priest', 'Cybernetica') }), det('a', 'tactical-support', { Support1: u('castellax-battle-maniple', 'Myrmidax') }, 'mechanicum', { detachmentId: 'p', slotId: 'crusade-primary.Command1' })]);
    expect(ids(r)).toContain('UNIT-SUB-FACTION');
  });
  it('Traitor-only units are refused in a Loyalist army', () =>
    expect(ids(mech([det('p', 'crusade-primary', { Troops1: u('tech-priest', 'Cybernetica') }), det('a', 'army-vanguard', { Elites1: u('decimator') }, 'mechanicum', fromHC)], 'Loyalist'))).toContain('ARMY-ALLEGIANCE'));
});

describe('Mechanicum Apex detachments (an Archmagos of the matching sub-faction unlocks each)', () => {
  it('Command Maniple: Cybernetica Archmagos, Automata only', () => {
    expect(ids(withApex('Cybernetica', 'command-maniple', { Elites1: u('domitar-battle-maniple'), Support1: u('castellax-battle-maniple'), WarEngine1: u('thanatar-siege-maniple') }))).toEqual([]);
    expect(ids(withApex('Cybernetica', 'command-maniple', { Support1: u('thallax-cohort') }))).toContain('SLOT-RESTRICTION');
  });
  it('Command Maniple needs a Cybernetica Archmagos, not a Myrmidax one', () =>
    expect(ids(withApex('Myrmidax', 'command-maniple', { Elites1: u('myrmidon-secutor-host') }))).toContain('DET-UNLOCK-SPECIFIC'));
  it('Host of Destruction: Myrmidax Archmagos, Myrmidax units only', () => {
    expect(ids(withApex('Myrmidax', 'host-of-destruction', { Elites1: u('myrmidon-secutor-host'), Elites2: u('myrmidon-destructor-host') }))).toEqual([]);
    expect(ids(withApex('Myrmidax', 'host-of-destruction', { Elites1: u('domitar-battle-maniple') }))).toContain('SLOT-RESTRICTION');
  });
  it('Panoply of Cruelty: Lacrymaerta Archmagos, Ursarax Cohorts', () =>
    expect(ids(withApex('Lacrymaerta', 'panoply-of-cruelty', { HeavyAssault1: u('ursarax-cohort') }))).toEqual([]));
  it('Thallax Command Cohort: Reductor Archmagos, Thallax Cohorts', () =>
    expect(ids(withApex('Reductor', 'thallax-command-cohort', { Support1: u('thallax-cohort') }))).toEqual([]));
  it("Crux of Judgement: Malagra Archmagos, Arcuitors, and its Command slots don't unlock", () => {
    const r = withApex('Malagra', 'crux-of-judgement', { Command1: u('arcuitor-magisterium') });
    expect(ids(r)).toEqual([]);
    r.detachments.push(det('y', 'shock-assault', { HeavyAssault1: u('ursarax-cohort') }, 'mechanicum', { detachmentId: 'x', slotId: 'crux-of-judgement.Command1' }));
    expect(ids(r)).toContain('DET-UNLOCK-SOURCE');
  });
  it('the Apex counts toward one sub-faction per detachment on its own', () =>
    // Archmagos is Cybernetica (Primary); the Myrmidax units sit in a different detachment, so no clash.
    expect(ids(withApex('Cybernetica', 'command-maniple', { Elites1: u('domitar-battle-maniple') }))).toEqual([]));
});

describe('army lists stay apart', () => {
  it("Legiones Astartes detachments aren't for Mechanicum (Techmarine Covenant from a Magos)", () => {
    const r = mech([det('p', 'crusade-primary', { Command1: u('magos', 'Cybernetica'), Troops1: u('tech-priest', 'Cybernetica') }), det('x', 'techmarine-covenant', { Support1: u('castellax-battle-maniple') }, 'mechanicum', { detachmentId: 'p', slotId: 'crusade-primary.Command1' })]);
    expect(ids(r)).toContain('DET-ARMY-LIST');
  });
  it('menus agree: Techmarine Covenant is hidden for Mechanicum, Command Maniple for Astartes', () => {
    const def = (id: string) => CATALOG.detachments.find((d) => d.id === id)!;
    expect(forArmyList(def('techmarine-covenant'), 'mechanicum')).toBe(false);
    expect(forArmyList(def('command-maniple'), 'legiones-astartes')).toBe(false);
    expect(forArmyList(def('tactical-support'), 'mechanicum')).toBe(true);
  });
  it('slot hints honour Automata / sub-faction restrictions', () => {
    const cm = CATALOG.detachments.find((d) => d.id === 'command-maniple')!;
    expect(slotAccepts(cm, cm.slots[1]!, byId.get('castellax-battle-maniple')!)).toBe(true);
    expect(slotAccepts(cm, cm.slots[1]!, byId.get('thallax-cohort')!)).toBe(false);
  });
});

describe('Mechanicum in the builder', () => {
  it('a Death Guard army can take a Mechanicum Allied detachment', () => {
    let s = emptyState('Death Guard');
    s = placeUnit(s, 'primary', 'crusade-primary.Command1', 'centurion');
    s = placeUnit(s, 'primary', 'crusade-primary.Troops1', 'tactical-squad');
    const a = addDetachment(s, 'allied');
    s = setAlliedFaction(a.state, a.id, 'Mechanicum');
    const allied = s.roster.detachments.find((d) => d.id === a.id)!;
    expect(allied.armyList).toBe('mechanicum');
    expect(s.roster.ritesOfWar).not.toHaveProperty('Mechanicum');
    s = placeUnit(s, a.id, 'allied.Command1', 'magos');
    s = placeUnit(s, a.id, 'allied.Troops1', 'tech-priest');
    s = setSubFaction(s, a.id, 'allied.Command1', 'Macrotek'); // the Tech-Priest follows: one per detachment
    s = placeUnit(s, a.id, 'allied.Troops2', 'tech-priest'); // a new unit joins as the detachment's sub-faction
    const subs = s.roster.detachments.find((d) => d.id === a.id)!.fills.map((f) => f.unit?.subFaction);
    expect(subs).toEqual(['Macrotek', 'Macrotek', 'Macrotek']);
    expect(ids(s.roster)).toEqual([]);
  });
  it('sub-factions only have to match within a detachment (Reductor Primary, Cybernetica Thanatar in its Auxiliary)', () => {
    let s = emptyState('Mechanicum', 3000, 'Loyalist');
    s = placeUnit(s, 'primary', 'crusade-primary.Command1', 'magos');
    const a = addDetachment(s, 'heavy-support', { detachmentId: 'primary', slotId: 'crusade-primary.Command1' });
    s = placeUnit(a.state, a.id, 'heavy-support.WarEngine1', 'thanatar-siege-maniple'); // Cybernetica, fixed
    s = placeUnit(s, 'primary', 'crusade-primary.Troops1', 'tech-priest');
    s = setSubFaction(s, 'primary', 'crusade-primary.Command1', 'Reductor');
    expect(ids(s.roster)).toEqual([]); // different detachments
  });
  it('switching the Primary to Mechanicum starts a fresh Mechanicum list', () => {
    let s = placeUnit(emptyState('Death Guard'), 'primary', 'crusade-primary.Troops1', 'tactical-squad');
    s = setPrimaryLegion(s, 'Mechanicum');
    expect(s.roster.detachments).toHaveLength(1);
    expect(s.roster.detachments[0]!.armyList).toBe('mechanicum');
    expect(s.roster.detachments[0]!.fills).toEqual([]);
    expect(s.roster.ritesOfWar).toEqual({});
  });
  it('"→ Cybernetica" switches an Archmagos already in the slot (and its detachment) and adds Command Maniple', () => {
    let s = emptyState('Mechanicum', 3000, 'Loyalist');
    s = placeUnit(s, 'primary', 'crusade-primary.HighCommand1', 'archmagos');
    s = placeUnit(s, 'primary', 'crusade-primary.Troops1', 'tech-priest');
    const link = { detachmentId: 'primary', slotId: 'crusade-primary.HighCommand1' };
    expect(planWithSubFaction(s, 'command-maniple', link)?.subFaction).toBe('Cybernetica');
    const next = planWithSubFaction(s, 'command-maniple', link)!.state;
    expect(next.roster.detachments[0]!.fills.map((f) => f.unit?.subFaction)).toEqual(['Cybernetica', 'Cybernetica']);
    next.roster.detachments[1]!.fills.push({ slotId: 'command-maniple.Support1', unit: u('castellax-battle-maniple') });
    expect(ids(next.roster)).toEqual([]);
    // Nothing to switch when it's already Cybernetica, or for a detachment without a sub-faction unlock.
    expect(planWithSubFaction(next, 'command-maniple', link)).toBeNull();
    expect(planWithSubFaction(s, 'storm-battery', link)).toBeNull();
  });
  it('"+ Archmagos" plans a Cybernetica Archmagos for Command Maniple', () => {
    let s = emptyState('Mechanicum', 3000, 'Loyalist');
    s = placeUnit(s, 'primary', 'crusade-primary.Troops1', 'tech-priest');
    const plan = planWithCommander(s, 'command-maniple', 'primary');
    expect(plan?.unitId).toBe('archmagos');
    const hc = plan!.state.roster.detachments[0]!.fills.find((f) => f.slotId === plan!.slotId)!.unit!;
    expect(hc.subFaction).toBe('Cybernetica');
  });
});
