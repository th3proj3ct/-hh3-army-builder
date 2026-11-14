/**
 * Death Guard golden lists on REAL data: unit points imported from BSData (commit in
 * CATALOG.version), spot-checked against Wahapedia in test/points-crosscheck.test.ts.
 * If BSData points change, the totals asserted here change too — on purpose.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog';
import type { DetachmentInstance, Roster, UnitInstance } from '../src/model';
import { totalPoints } from '../src/points';
import { validate } from '../src/validate';

let seq = 0;
const byId = new Map(CATALOG.units.map((d) => [d.id, d]));

function u(unitId: string, opts: { models?: number; faction?: string; options?: [string, number][] } = {}): UnitInstance {
  const def = byId.get(unitId);
  if (!def) throw new Error(`fixture refers to unknown unit ${unitId}`);
  return {
    id: `dg${++seq}`,
    unitId,
    models: opts.models ?? def.points.minModels,
    options: (opts.options ?? []).map(([optionId, count]) => ({ optionId, count })),
    ...(def.factionTrait === null ? { factionTrait: opts.faction ?? 'Death Guard' } : {}),
  };
}
type Fill = UnitInstance | { unit: UnitInstance; prime: string };
function det(id: string, defId: string, fills: Record<string, Fill>, from?: [string, string]): DetachmentInstance {
  return {
    id,
    defId,
    armyList: 'legiones-astartes',
    // `from` = [parent detachment id, parent slot id]; every parent here is the Primary.
    ...(from ? { unlockedBy: { detachmentId: from[0], slotId: `crusade-primary.${from[1]}` } } : {}),
    extraSlots: [],
    fills: Object.entries(fills).map(([k, f]) => ('unitId' in f ? { slotId: `${defId}.${k}`, unit: f } : { slotId: `${defId}.${k}`, unit: f.unit, primeAdvantage: f.prime })),
  };
}

/** The full legal list; `tweak` returns a variant. */
function deathGuard(tweak: (parts: Record<string, DetachmentInstance>, r: Roster) => void = () => {}): Roster {
  const parts: Record<string, DetachmentInstance> = {
    p: det('p', 'crusade-primary', {
      HighCommand1: u('calas-typhon'),
      Command1: { unit: u('centurion'), prime: 'unnatural-resilience' },
      Command2: u('centurion'),
      Command3: u('centurion'),
      Troops1: { unit: u('tactical-squad', { models: 20 }), prime: 'master-sergeant' },
      Troops2: u('tactical-squad'),
      Troops3: u('inductii-squad-death-guard'),
      Transport1: u('rhino'),
      Transport2: u('rhino'),
    }),
    wl: det('wl', 'warlord', {
      Warlord1: u('mortarion'),
      Retinue1: u('deathshroud-terminator-squad', { models: 5, options: [['deathshroud--melta-bombs', 5]] }),
      HeavyTransport1: u('land-raider-carrier'),
    }),
    av: det('av', 'army-vanguard', { Elites1: u('mortus-poisoner-squad', { models: 10 }) }, ['p', 'HighCommand1']),
    rh: det('rh', 'reaping-host', {
      Troops1: u('tactical-squad'),
      Support1: u('apothecary'),
      HeavyAssault1: u('grave-warden-terminator-squad'),
    }, ['p', 'Command1']),
    as: det('as', 'armoured-support', { Armour1: u('predator'), Armour2: u('predator') }, ['p', 'Command2']),
    hs: det('hs', 'heavy-support', { WarEngine1: u('contemptor-dreadnought') }, ['p', 'Command3']),
  };
  const r: Roster = {
    name: 'Death Guard 3,000',
    catalogVersion: CATALOG.version,
    pointsLimit: 3000,
    missionId: 'core',
    allegiance: 'Traitor',
    ritesOfWar: { 'Death Guard': 'death-guard-legiones-astartes' },
    detachments: [],
  };
  tweak(parts, r);
  r.detachments = Object.values(parts);
  return r;
}

const ruleIds = (r: Roster) => [...new Set(validate(r, CATALOG).errors.map((e) => e.ruleId))].sort();

describe('Death Guard on imported BSData points', () => {
  it('catalog is stamped with the BSData commit', () => {
    expect(CATALOG.version).toMatch(/^bsdata-[0-9a-f]{7,}$/);
  });

  it('LEGAL: full 3,000 pt Death Guard list (Mortarion, Typhon, Reaping Host, Unnatural Resilience)', () => {
    const r = deathGuard();
    const res = validate(r, CATALOG);
    expect(res.errors.map((e) => e.message)).toEqual([]);
    // 870+80 primary · 425+260+265 warlord · 130 vanguard · 355 reaping · 200 armour · 150 heavy
    expect(res.totals.points).toBe(2735);
    expect(res.totals.warlordAndLordOfWar).toBe(425); // Mortarion only; Deathshroud/Land Raider don't count
    expect(res.totals.points).toBe(totalPoints(r, CATALOG));
  });

  it('LEGAL: 2,000 pt Death Guard list without Mortarion', () => {
    const r = deathGuard((p, ro) => {
      delete p.wl;
      delete p.hs;
      delete p.as;
      ro.pointsLimit = 2000;
      delete ro.missionId;
    });
    expect(ruleIds(r)).toEqual([]);
  });

  const illegal: [string, string[], Parameters<typeof deathGuard>[0]][] = [
    ['Loyalist army can\'t field Mortarion or Typhon', ['ARMY-ALLEGIANCE'], (_p, r) => (r.allegiance = 'Loyalist')],
    ['Reaping Host Troops slot can\'t take an Assault Squad', ['SLOT-RESTRICTION'], (p) => (p.rh!.fills[0]!.unit = u('assault-squad'))],
    ['Grave Wardens are Heavy Assault, not Troops', ['SLOT-ROLE-MATCH'], (p) => (p.rh!.fills[0]!.unit = u('grave-warden-terminator-squad'))],
    ['Unnatural Resilience only for a Centurion', ['PRIME-ELIGIBILITY'], (p) => {
      p.p!.fills[1]!.primeAdvantage = undefined;
      p.p!.fills[4]!.primeAdvantage = 'unnatural-resilience';
    }],
    ['Mortarion + Fellblade break the shared 25% (425 + 650 > 750)', ['ARMY-POINTS', 'LOW-CAP'], (p) => (p.low = det('low', 'lord-of-war', { LordOfWar1: u('fellblade-super-heavy-battle-tank') }))],
    ['Deathshroud max 10 models', ['UNIT-MODEL-COUNT'], (p) => (p.wl!.fills[1]!.unit = u('deathshroud-terminator-squad', { models: 11 }))],
    // 100 + 8×45 + 10×5 + 10×5 = 560 replaces 260 → 3,035
    ['10 kitted-out Deathshroud push the list over 3,000', ['ARMY-POINTS'], (p) =>
      (p.wl!.fills[1]!.unit = u('deathshroud-terminator-squad', { models: 10, options: [['deathshroud--melta-bombs', 10], ['deathshroud--grenade-harness', 10]] }))],
    ['Typhon\'s High Command slot can\'t unlock two detachments', ['DET-UNLOCK-ONE'], (p) => (p.rh!.unlockedBy = { detachmentId: 'p', slotId: 'crusade-primary.HighCommand1' })],
    ['Death Guard needs a Rite of War', ['ARMY-RITE-OF-WAR'], (_p, r) => (r.ritesOfWar = {})],
    ['Core Mission at 2,500 pts also bars Mortarion', ['ARMY-MISSION-LIMIT', 'ARMY-POINTS', 'WARLORD-MIN-LIMIT'], (_p, r) => (r.pointsLimit = 2500)],
    ['Iron Warriors Tactical Squad in a Death Guard detachment', ['ARMY-RITE-OF-WAR', 'DET-SINGLE-FACTION'], (p) => (p.p!.fills[5]!.unit = u('tactical-squad', { faction: 'Iron Warriors' }))],
  ];
  for (const [name, expected, tweak] of illegal) {
    it(`ILLEGAL: ${name}`, () => expect(ruleIds(deathGuard(tweak))).toEqual([...expected].sort()));
  }
});

describe('Death Guard armoury (imported from BSData Legion-gated entries)', () => {
  const opts = (unitId: string) => byId.get(unitId)!.options;
  const ARMOURY = ['Power scythe', 'Alchem caster', 'Alchem combi-flamer', 'Alchem flamer', 'Heavy alchem flamer', 'Heavy Alchem flamers'];

  it('every Death Guard-only option on a generic unit is a Death Guard armoury item', () => {
    const gated = CATALOG.units
      .filter((u) => u.factionTrait === null)
      .flatMap((u) => u.options.filter((o) => o.factionTraits?.length === 1 && o.factionTraits[0] === 'Death Guard'));
    expect(gated.length).toBeGreaterThan(100);
    for (const o of gated) expect(ARMOURY).toContain(o.name.split(': ').pop());
  });

  it('Legion-gated options name only real Legions', () => {
    const legions = new Set(CATALOG.armyLists.find((l) => l.id === 'legiones-astartes')!.factionChoices);
    for (const o of CATALOG.units.flatMap((u) => u.options)) for (const f of o.factionTraits ?? []) expect(legions).toContain(f);
  });

  it('a Death Guard Sergeant can take an alchem combi-flamer (+10)', () => {
    const r = deathGuard((p) => (p.p!.fills[5]!.unit = u('tactical-squad', { options: [['sergeant--alchem-combi-flamer', 1]] })));
    const res = validate(r, CATALOG);
    expect(res.errors).toEqual([]);
    expect(res.totals.points).toBe(2735 + 10);
  });

  it('an Iron Warriors Sergeant cannot', () => {
    const r = deathGuard((p, ro) => {
      p.p!.fills[5]!.unit = u('tactical-squad', { faction: 'Iron Warriors', options: [['sergeant--alchem-combi-flamer', 1]] });
      ro.ritesOfWar['Iron Warriors'] = 'iron-warriors-legiones-astartes';
    });
    expect(ruleIds(r)).toEqual(['DET-SINGLE-FACTION', 'OPT-GATED']);
  });

  it('power scythe is +10 for a model swapping a power weapon, +20 from the bolter list', () => {
    expect(opts('cataphractii-terminator-squad').find((o) => o.id === 'cataphractii-terminator-sergeant--power-scythe')?.cost.points).toBe(10);
    expect(opts('tactical-squad').find((o) => o.id === 'sergeant--power-scythe')?.cost.points).toBe(20);
  });

  it('other Legions\' hidden options (Thousand Sons cults) are only offered to Thousand Sons', () => {
    const cults = CATALOG.units.flatMap((u) => u.options).filter((o) => /^(Athanaean|Corvidae|Pavoni|Pyrae|Raptora)$/.test(o.name.split(': ').pop()!));
    expect(cults.length).toBeGreaterThan(0);
    for (const o of cults) expect(o.factionTraits).toEqual(['Thousand Sons']);
  });

  it('Terminators no longer list a paid combi-bolter they already carry for free', () => {
    expect(opts('cataphractii-terminator-squad').some((o) => /: Combi-bolter$/.test(o.name) && o.cost.points === 5)).toBe(false);
  });
});
