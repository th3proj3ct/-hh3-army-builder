/**
 * Legion Additional Detachments on real imported units. Layouts were read from each Legion's
 * Wahapedia page (chart markup) on 14 Nov 2026; every one is built for its own Legion with a
 * unit that fits, and refused for another Legion.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog';
import { LEGION_DETACHMENTS } from '../src/core-data';
import type { DetachmentDef, Roster, UnitInstance } from '../src/model';
import { validate } from '../src/validate';
import { slotAccepts } from '../ui/src/fits';

const byId = new Map(CATALOG.units.map((d) => [d.id, d]));
const detDef = (id: string) => CATALOG.detachments.find((d) => d.id === id)!;
const legionOf = (d: DetachmentDef) => d.requirements.find((r) => r.kind === 'primaryFaction')!.factions[0]!;

describe('layouts match Wahapedia (★ = Prime)', () => {
  const layout = (id: string) => detDef(id).slots.map((s) => `${s.prime ? '*' : ''}${s.role}`).join(',');
  const expected: Record<string, string> = {
    'ironwing-gauntlet': 'HeavyTransport,HeavyTransport,Armour,Armour',
    'dreadwing-cadre': '*Support,Support,Support',
    'stormwing-muster': '*Troops,*Troops,Transport,Transport',
    'deathwing-conclave': '*Retinue,Elites,HeavyAssault',
    'ravenwing-lance': '*FastAttack,FastAttack,Recon,Recon',
    'firewing-echelon': '*Recon,Recon,Elites,Elites',
    'primacy-wing': 'Retinue,Elites,FastAttack,FastAttack',
    'brotherhood-of-the-phoenix': 'Warlord,*HighCommand,HighCommand,HighCommand,Command',
    'ironfire-cohort': '*Armour,Armour,Support,Support',
    'hammer-of-olympia': '*HeavyAssault,HeavyAssault,HeavyTransport,*Troops,Troops',
    'chogorian-warband': '*FastAttack,FastAttack,Recon,Recon',
    'bloodied-claw': '*Troops,Troops,HeavyAssault,HeavyAssault',
    'siege-gauntlet': '*Troops,Troops,HeavyAssault,Support',
    'terror-assault': '*Troops,Troops,FastAttack,FastAttack',
    'atramentar-hunt': '*Retinue,*HeavyAssault,*HeavyAssault',
    'revelation-host': '*Troops,Troops,Elites,Elites',
    'spearhead-phalanx': 'HeavyTransport,Armour,HeavyAssault',
    'medusan-vanguard': '*Command,HeavyAssault,HeavyAssault,Support,WarEngine',
    'berserker-cadre': '*Troops,HeavyAssault,HeavyAssault,Elites',
    'sons-of-bodt': '*Support,*Support,Troops,Troops,Troops',
    'primus-demi-company': '*Command,Troops,Troops,Support,FastAttack',
    'reaping-host': '*Troops,Troops,Support,HeavyAssault',
    'prosperine-convocation': '*Troops,FastAttack,Elites,HeavyTransport',
    'supremacy-cadre': '*Troops,*Troops,HeavyAssault,Elites',
    'exalted-conclave': '*Troops,*Troops,Elites,Elites',
    'immolation-covenant': '*Support,Support,Armour,Armour',
    'decapitation-cadre': 'Recon,Recon,Elites,Elites',
    'headhunter-leviathal': '*Recon,*Recon,Elites,Elites',
  };
  for (const [id, slots] of Object.entries(expected)) it(id, () => expect(layout(id)).toBe(slots));
  it('every Legion has at least one Additional Detachment', () => {
    const legions = new Set(CATALOG.detachments.flatMap((d) => d.requirements.filter((r) => r.kind === 'primaryFaction').flatMap((r) => (r.kind === 'primaryFaction' ? r.factions : []))));
    expect(legions.size).toBe(18);
  });
});

describe('restrictions name real units', () => {
  for (const d of CATALOG.detachments)
    for (const s of d.slots)
      for (const id of s.restriction?.unitIds ?? [])
        if (s.restriction?.armyList !== 'daemons-of-the-ruinstorm') it(`${d.name} → ${id}`, () => expect(byId.has(id)).toBe(true));
});

describe('each Legion detachment works for its own Legion only', () => {
  let seq = 0;
  const inst = (unitId: string, faction: string): UnitInstance => {
    const def = byId.get(unitId)!;
    return { id: `l${++seq}`, unitId, models: def.points.minModels, options: [], ...(def.factionTrait === null ? { factionTrait: faction } : {}) };
  };
  /** First unit that fits a slot: the Legion's own units first, then generic ones. */
  const fitting = (d: DetachmentDef, slotIdx: number, legion: string) => {
    const slot = d.slots[slotIdx]!;
    const ok = CATALOG.units.filter((u) => u.armyList === 'legiones-astartes' && slotAccepts(d, slot, u) && (u.factionTrait === null || u.factionTrait === legion) && u.allegiance !== 'Loyalist' && !u.modelTags.includes('Unique'));
    return (ok.find((u) => u.factionTrait === legion) ?? ok[0])?.id;
  };
  const build = (d: DetachmentDef, primaryLegion: string): Roster => {
    const legion = legionOf(d);
    const unlockSlot = d.kind === 'Apex' ? 'HighCommand1' : 'Command1';
    // The Hammer of Olympia needs a Warsmith in the army; let it be the High Command unit unlocking it.
    const commander = d.id === 'hammer-of-olympia' && primaryLegion === legion ? 'warsmith' : d.kind === 'Apex' ? 'praetor' : 'centurion';
    const primaryFills = { [unlockSlot]: commander, Troops1: 'tactical-squad' };
    const unitId = fitting(d, 0, legion)!;
    return {
      name: 't', catalogVersion: CATALOG.version, pointsLimit: 3000, allegiance: 'Traitor',
      ritesOfWar: { [primaryLegion]: `${primaryLegion.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')}-legiones-astartes` },
      detachments: [
        { id: 'p', defId: 'crusade-primary', armyList: 'legiones-astartes', extraSlots: [], fills: Object.entries(primaryFills).map(([k, u]) => ({ slotId: `crusade-primary.${k}`, unit: inst(u, primaryLegion) })) },
        { id: 'x', defId: d.id, armyList: 'legiones-astartes', unlockedBy: { detachmentId: 'p', slotId: `crusade-primary.${unlockSlot}` }, extraSlots: [], fills: [{ slotId: d.slots[0]!.id, unit: inst(unitId, legion) }] },
      ],
    };
  };
  const ids = (r: Roster) => [...new Set(validate(r, CATALOG).errors.map((e) => e.ruleId))].sort();
  for (const d of LEGION_DETACHMENTS) {
    const legion = legionOf(d);
    it(`${d.name}: legal for ${legion}`, () => expect(ids(build(d, legion))).toEqual([]));
    it(`${d.name}: refused for another Legion`, () => expect(ids(build(d, legion === 'Death Guard' ? 'Sons of Horus' : 'Death Guard'))).toContain('DET-REQUIREMENT'));
  }
});

describe('special cases', () => {
  it('Hammer of Olympia needs a Warsmith or Perturabo in the army', () => {
    const d = detDef('hammer-of-olympia');
    expect(d.requirements.some((r) => r.kind === 'armyIncludesUnit' && r.unitIds.includes('warsmith') && r.unitIds.includes('perturabo'))).toBe(true);
    const roster: Roster = {
      name: 't', catalogVersion: CATALOG.version, pointsLimit: 3000, allegiance: 'Traitor', ritesOfWar: { 'Iron Warriors': 'iron-warriors-legiones-astartes' },
      detachments: [
        { id: 'p', defId: 'crusade-primary', armyList: 'legiones-astartes', extraSlots: [], fills: [
          { slotId: 'crusade-primary.HighCommand1', unit: { id: 'a', unitId: 'praetor', models: 1, options: [], factionTrait: 'Iron Warriors' } },
          { slotId: 'crusade-primary.Troops1', unit: { id: 'b', unitId: 'tactical-squad', models: 10, options: [], factionTrait: 'Iron Warriors' } },
        ] },
        { id: 'x', defId: 'hammer-of-olympia', armyList: 'legiones-astartes', unlockedBy: { detachmentId: 'p', slotId: 'crusade-primary.HighCommand1' }, extraSlots: [], fills: [
          { slotId: 'hammer-of-olympia.Troops1', unit: { id: 'c', unitId: 'tactical-squad', models: 10, options: [], factionTrait: 'Iron Warriors' } },
        ] },
      ],
    };
    expect(validate(roster, CATALOG).errors.map((e) => e.ruleId)).toEqual(['DET-REQUIREMENT']);
  });
  it('Atramentar Hunt allows only the Atramentar Prime Advantage, which needs Night Lords Terminators', () => {
    expect(detDef('atramentar-hunt').allowedPrimeAdvantages).toEqual(['atramentar']);
    const adv = CATALOG.primeAdvantages.find((p) => p.id === 'atramentar')!;
    expect(adv.unitRequirement?.factionTraits).toEqual(['Night Lords']);
    expect(adv.unitRequirement?.unitIds).toContain('cataphractii-terminator-squad');
  });
  it('the new Mechanicum detachments are Mechanicum only', () => {
    for (const id of ['taghmata-cohort', 'apprentice-cadre', 'heart-of-power', 'iron-phalanx']) expect(detDef(id).armyLists).toEqual(['mechanicum']);
  });
});
