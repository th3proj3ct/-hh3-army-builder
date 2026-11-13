import { describe, expect, it } from 'vitest';
import type { Roster } from '../src/model';
import { RULES } from '../src/rules';
import { validate } from '../src/validate';
import { CATALOG, det, roster, slot, u } from './fixtures';

const P = 'crusade-primary';
const primary = (fills: Parameters<typeof det>[2] = { Troops1: u('tactical-squad') }) => det('p', P, fills);
const xslot = (id: string, role: any, from: string, adv = 'logistical-benefit') => ({ id, role, grantedBy: { slotId: slot(P, from), primeAdvantageId: adv } });

interface Case {
  name: string;
  roster: Roster;
  /** Exact set of rule ids expected in `errors` (empty ⇒ legal). */
  violates: string[];
}

// ─────────────────────────────── LEGAL ───────────────────────────────
const legal: Case[] = [
  { name: 'L01 minimal: one Troops unit in the Primary', violates: [], roster: roster([primary()]) },
  {
    name: 'L02 High Command unlocks an Apex, Command unlocks an Auxiliary',
    violates: [],
    roster: roster([
      primary({ HighCommand1: u('praetor'), Command1: u('centurion'), Troops1: u('tactical-squad') }),
      det('apex', 'combat-retinue', { Retinue1: u('command-squad') }, { from: ['p', slot(P, 'HighCommand1')] }),
      det('aux', 'armoured-support', { Armour1: u('predator') }, { from: ['p', slot(P, 'Command1')] }),
    ]),
  },
  {
    name: 'L03 High Command slot spent on an Auxiliary instead of an Apex',
    violates: [],
    roster: roster([
      primary({ HighCommand1: u('praetor'), Troops1: u('tactical-squad') }),
      det('aux', 'tactical-support', { Troops1: u('tactical-squad'), Support1: u('apothecary') }, { from: ['p', slot(P, 'HighCommand1')] }),
    ]),
  },
  {
    name: 'L04 chain: Primary HC → Officer Cadre; Officer Cadre Command → Heavy Support',
    violates: [],
    roster: roster([
      primary({ HighCommand1: u('praetor'), Troops1: u('tactical-squad') }),
      det('oc', 'officer-cadre', { Command1: u('centurion') }, { from: ['p', slot(P, 'HighCommand1')] }),
      det('hs', 'heavy-support', { WarEngine1: u('contemptor') }, { from: ['oc', slot('officer-cadre', 'Command1')] }),
    ]),
  },
  {
    name: 'L05 Allied Mechanicum detachment with its own linked Auxiliary',
    violates: [],
    roster: roster([
      primary(),
      det('al', 'allied', { Command1: u('magos'), Troops1: u('thallax') }, { list: 'mechanicum' }),
      det('alx', 'tactical-support', { Troops1: u('thallax') }, { list: 'mechanicum', from: ['al', slot('allied', 'Command1')] }),
    ]),
  },
  {
    name: 'L06 Warlord + Lord of War exactly at the shared 25% cap (450 + 300 = 750 of 3,000)',
    violates: [],
    roster: roster([
      primary(),
      det('wl', 'warlord', { Warlord1: u('sanguinius'), Retinue1: u('command-squad') }),
      det('low', 'lord-of-war', { LordOfWar1: u('small-low') }),
    ]),
  },
  {
    name: 'L07 Lord of War in a 2,000 point game (no Warlord allowed, LoW fine under 25%)',
    violates: [],
    roster: roster([primary(), det('low', 'lord-of-war', { LordOfWar1: u('small-low') })], { pointsLimit: 2000 }),
  },
  {
    name: 'L08 Logistical Benefit adds an Armour slot to the Primary',
    violates: [],
    roster: roster([
      det('p', P, { Troops1: { unit: u('tactical-squad'), prime: 'logistical-benefit' }, 'x-armour': u('predator') }, { extra: [xslot('x-armour', 'Armour', 'Troops1')] }),
    ]),
  },
  {
    name: 'L09 Special Assignment: a second High Command unit in the Command Prime slot',
    violates: [],
    roster: roster([primary({ HighCommand1: u('praetor'), Command1: { unit: u('praetor'), prime: 'special-assignment' }, Troops1: u('tactical-squad') })]),
  },
  {
    name: 'L10 Master of Signals unlocks a Maelstrom Sentry Battery with its restricted units',
    violates: [],
    roster: roster([
      primary({ Command1: u('master-of-signals'), Troops1: u('tactical-squad') }),
      det('msb', 'maelstrom-sentry-battery', { Support1: u('araknae-quad-accelerator-platform'), Recon1: u('tarantula-battery') }, { from: ['p', slot(P, 'Command1')] }),
    ]),
  },
  {
    name: "L11 Traitor army: '[Allegiance]' units become Traitor, Traitor-only unit allowed",
    violates: [],
    roster: roster(
      [primary({ Troops1: u('tactical-squad', { faction: 'Sons of Horus' }), Troops2: u('despoiler-squad', { faction: 'Sons of Horus' }) })],
      { allegiance: 'Traitor', ritesOfWar: { 'Sons of Horus': 'Sons of Horus-rite' } },
    ),
  },
  {
    name: 'L12 wargear within limits: split exchanges, one-per-unit items, one Decurion',
    violates: [],
    roster: roster([
      primary({
        Troops1: u('tactical-squad', { models: 12, options: [['chainsword', 6], ['combi', 6], ['vexilla', 1], ['ba-armoury', 1]] }),
        Transport1: u('rhino', { options: [['decurion-defensor', 1]] }),
      }),
    ]),
  },
  {
    name: 'L13 two copies of the same Auxiliary from two Command slots',
    violates: [],
    roster: roster([
      primary({ Command1: u('centurion'), Command2: u('centurion'), Troops1: u('tactical-squad') }),
      det('a1', 'armoured-support', { Armour1: u('predator') }, { from: ['p', slot(P, 'Command1')] }),
      det('a2', 'armoured-support', { Armour1: u('predator') }, { from: ['p', slot(P, 'Command2')] }),
    ]),
  },
  {
    name: 'L14 Prime Advantages on both Primary Prime slots',
    violates: [],
    roster: roster([primary({ Command1: { unit: u('centurion'), prime: 'combat-veterans' }, Troops1: { unit: u('tactical-squad'), prime: 'master-sergeant' } })]),
  },
  {
    name: 'L15 Linebreaker Echelon set to Tartaros with Tartaros units',
    violates: [],
    roster: roster([
      primary({ HighCommand1: u('praetor'), Troops1: u('tactical-squad') }),
      det('lb', 'linebreaker-echelon', { HeavyAssault1: u('tartaros-squad'), Retinue1: u('tartaros-command') }, { from: ['p', slot(P, 'HighCommand1')], choice: 'Tartaros' }),
    ]),
  },
  { name: 'L16 Core Mission at 3,000 points', violates: [], roster: roster([primary()], { missionId: 'core' }) },
];

// ────────────────────────────── ILLEGAL ──────────────────────────────
const illegal: Case[] = [
  { name: 'I01 no Primary Detachment', violates: ['ARMY-ONE-PRIMARY'], roster: roster([det('low', 'lord-of-war', { LordOfWar1: u('small-low') })]) },
  { name: 'I02 two Primary Detachments', violates: ['ARMY-ONE-PRIMARY'], roster: roster([primary(), det('p2', P, { Troops1: u('tactical-squad') })]) },
  {
    name: 'I03 empty Auxiliary detachment',
    violates: ['ARMY-DETACHMENT-NOT-EMPTY'],
    roster: roster([primary({ HighCommand1: u('praetor'), Troops1: u('tactical-squad') }), det('aux', 'armoured-support', {}, { from: ['p', slot(P, 'HighCommand1')] })]),
  },
  {
    name: 'I04 over the points limit',
    violates: ['ARMY-POINTS'],
    roster: roster([primary({ HighCommand1: u('praetor'), Troops1: u('tactical-squad', { models: 20 }), Troops2: u('tactical-squad', { models: 20 }), Troops3: u('tactical-squad', { models: 20 }), Troops4: u('tactical-squad', { models: 20 }) })], { pointsLimit: 900 }),
  },
  { name: 'I05 Armour unit in a Troops slot', violates: ['SLOT-ROLE-MATCH'], roster: roster([primary({ Troops1: u('predator') })]) },
  {
    name: 'I06 Auxiliary with nothing unlocking it',
    violates: ['DET-UNLOCK-REQUIRED'],
    roster: roster([primary(), det('aux', 'armoured-support', { Armour1: u('predator') })]),
  },
  {
    name: 'I07 Command slot used to unlock an Apex',
    violates: ['DET-UNLOCK-CMD'],
    roster: roster([primary({ Command1: u('centurion'), Troops1: u('tactical-squad') }), det('apex', 'combat-retinue', { Retinue1: u('command-squad') }, { from: ['p', slot(P, 'Command1')] })]),
  },
  {
    name: 'I08 one Command slot unlocking two Auxiliaries',
    violates: ['DET-UNLOCK-ONE'],
    roster: roster([
      primary({ Command1: u('centurion'), Troops1: u('tactical-squad') }),
      det('a1', 'armoured-support', { Armour1: u('predator') }, { from: ['p', slot(P, 'Command1')] }),
      det('a2', 'heavy-support', { WarEngine1: u('contemptor') }, { from: ['p', slot(P, 'Command1')] }),
    ]),
  },
  {
    name: 'I09 Special Assignment slot used to unlock a detachment',
    violates: ['PRIME-SPECIAL-ASSIGNMENT'],
    roster: roster([
      primary({ Command1: { unit: u('praetor'), prime: 'special-assignment' }, Troops1: u('tactical-squad') }),
      det('aux', 'armoured-support', { Armour1: u('predator') }, { from: ['p', slot(P, 'Command1')] }),
    ]),
  },
  {
    name: 'I10 Allied detachment of the same Faction as the Primary',
    violates: ['ALLIED-FACTION'],
    roster: roster([primary(), det('al', 'allied', { Command1: u('centurion') })]),
  },
  {
    name: 'I11 Allied cap counts linked Auxiliaries (FAQ): 570 + 480 > 1,000',
    violates: ['ALLIED-CAP'],
    roster: roster(
      [
        primary(),
        det('al', 'allied', { Command1: u('magos'), Troops1: u('thallax', { models: 6 }), Troops2: u('thallax', { models: 6 }) }, { list: 'mechanicum' }),
        det('alx', 'tactical-support', { Troops1: u('thallax', { models: 6 }), Troops2: u('thallax', { models: 6 }) }, { list: 'mechanicum', from: ['al', slot('allied', 'Command1')] }),
      ],
      { pointsLimit: 2000 },
    ),
  },
  {
    name: 'I12 Warlord Detachment in a 2,500 point game',
    violates: ['WARLORD-MIN-LIMIT'],
    roster: roster([primary(), det('wl', 'warlord', { Warlord1: u('sanguinius') })], { pointsLimit: 2500 }),
  },
  {
    name: 'I13 Warlord + Lord of War over the shared 25% (450 + 450 > 750)',
    violates: ['LOW-CAP'],
    roster: roster([primary(), det('wl', 'warlord', { Warlord1: u('sanguinius') }), det('low', 'lord-of-war', { LordOfWar1: u('fellblade') })]),
  },
  {
    name: 'I14 Warlord Detachment without a Paragon model',
    violates: ['WARLORD-PARAGON'],
    roster: roster([primary(), det('wl', 'warlord', { Warlord1: u('warlord-no-paragon') })]),
  },
  { name: 'I15 Traitor-only unit in a Loyalist army', violates: ['ARMY-ALLEGIANCE'], roster: roster([primary({ Troops1: u('despoiler-squad') })]) },
  {
    name: 'I16 Unique model in a Prime slot taking Combat Veterans',
    violates: ['PRIME-UNIQUE'],
    roster: roster([primary({ Command1: { unit: u('named-captain'), prime: 'combat-veterans' } })]),
  },
  {
    name: 'I17 Master Sergeant twice in one detachment',
    violates: ['PRIME-ONCE'],
    roster: roster([primary({ Command1: { unit: u('centurion'), prime: 'master-sergeant' }, Troops1: { unit: u('tactical-squad'), prime: 'master-sergeant' } })]),
  },
  {
    name: 'I18 Logistical Benefit used to add a Command slot',
    violates: ['PRIME-EXTRA-SLOT'],
    roster: roster([det('p', P, { Troops1: { unit: u('tactical-squad'), prime: 'logistical-benefit' }, 'x-cmd': u('centurion') }, { extra: [xslot('x-cmd', 'Command', 'Troops1')] })]),
  },
  {
    name: 'I19 restricted slot: Apothecary in a Maelstrom Support slot',
    violates: ['SLOT-RESTRICTION'],
    roster: roster([
      primary({ Command1: u('master-of-signals'), Troops1: u('tactical-squad') }),
      det('msb', 'maelstrom-sentry-battery', { Support1: u('apothecary') }, { from: ['p', slot(P, 'Command1')] }),
    ]),
  },
  {
    name: 'I20 FAQ: Logistical Benefit slot inherits the Apothecary-only restriction',
    violates: ['SLOT-RESTRICTION-EXTRA'],
    roster: roster([
      primary({ Command1: u('centurion'), Troops1: u('tactical-squad') }),
      {
        ...det('apo', 'apothecarion-delegation', { Support1: { unit: u('apothecary'), prime: 'logistical-benefit' }, 'x-sup': u('araknae-quad-accelerator-platform') }, { from: ['p', slot(P, 'Command1')] }),
        extraSlots: [{ id: 'x-sup', role: 'Support', grantedBy: { slotId: slot('apothecarion-delegation', 'Support1'), primeAdvantageId: 'logistical-benefit' } }],
      },
    ]),
  },
  {
    name: 'I21 Linebreaker set to Tartaros holding Cataphractii',
    violates: ['SLOT-RESTRICTION'],
    roster: roster([
      primary({ HighCommand1: u('praetor'), Troops1: u('tactical-squad') }),
      det('lb', 'linebreaker-echelon', { HeavyAssault1: u('cataphractii-squad') }, { from: ['p', slot(P, 'HighCommand1')], choice: 'Tartaros' }),
    ]),
  },
  {
    name: 'I22 wargear: 12 bolter exchanges in a 10-model unit',
    violates: ['OPT-GROUP'],
    roster: roster([primary({ Troops1: u('tactical-squad', { options: [['chainsword', 6], ['combi', 6]] }) })]),
  },
  {
    name: 'I23 two Legiones Decurion upgrades on one Rhino',
    violates: ['OPT-DECURION-ONE'],
    roster: roster([primary({ Troops1: u('tactical-squad'), Transport1: u('rhino', { options: [['decurion-defensor', 1], ['decurion-locus', 1]] }) })]),
  },
  {
    name: "I24 Blood Angels armoury item on an Iron Hands unit",
    violates: ['OPT-GATED'],
    roster: roster([primary({ Troops1: u('tactical-squad', { faction: 'Iron Hands', options: [['ba-armoury', 1]] }) })], { ritesOfWar: { 'Iron Hands': 'Iron Hands-rite' } }),
  },
  {
    name: 'I25 two Legions in one detachment',
    violates: ['DET-SINGLE-FACTION'],
    roster: roster([primary({ Troops1: u('tactical-squad'), Troops2: u('tactical-squad', { faction: 'Iron Hands' }) })], { ritesOfWar: { 'Blood Angels': 'Blood Angels-rite', 'Iron Hands': 'Iron Hands-rite' } }),
  },
  {
    name: 'I26 unlock loop between two Officer Cadres (also Command→Apex)',
    violates: ['DET-UNLOCK-CMD', 'DET-UNLOCK-CYCLE'],
    roster: roster([
      primary(),
      det('a', 'officer-cadre', { Command1: u('centurion') }, { from: ['b', slot('officer-cadre', 'Command1')] }),
      det('b', 'officer-cadre', { Command1: u('centurion') }, { from: ['a', slot('officer-cadre', 'Command1')] }),
    ]),
  },
  { name: 'I27 two Lord of War Detachments', violates: ['DET-MAX-LOW'], roster: roster([primary(), det('l1', 'lord-of-war', { LordOfWar1: u('small-low') }), det('l2', 'lord-of-war', { LordOfWar1: u('small-low') })]) },
  { name: 'I28 Core Mission at 2,500 points', violates: ['ARMY-MISSION-LIMIT'], roster: roster([primary()], { pointsLimit: 2500, missionId: 'core' }) },
  { name: 'I29 Inductii unit taking a Prime Advantage', violates: ['PRIME-BARRED-UNIT'], roster: roster([primary({ Troops1: { unit: u('inductii-squad'), prime: 'combat-veterans' } })]) },
  { name: 'I30 Legion with no Rite of War chosen', violates: ['ARMY-RITE-OF-WAR'], roster: roster([primary({ Troops1: u('tactical-squad', { faction: 'Iron Hands' }) })]) },
  {
    name: 'I31 Medusan Vanguard without an Iron Father or Ferrus Manus',
    violates: ['DET-REQUIREMENT'],
    roster: roster(
      [
        primary({ HighCommand1: u('praetor', { faction: 'Iron Hands' }), Troops1: u('tactical-squad', { faction: 'Iron Hands' }) }),
        det('mv', 'medusan-vanguard', { Command1: u('praevian') }, { from: ['p', slot(P, 'HighCommand1')] }),
      ],
      { ritesOfWar: { 'Iron Hands': 'Iron Hands-rite' } },
    ),
  },
  {
    name: 'I32 Maelstrom Sentry Battery unlocked by an ordinary Centurion',
    violates: ['DET-UNLOCK-SPECIFIC'],
    roster: roster([
      primary({ Command1: u('centurion'), Troops1: u('tactical-squad') }),
      det('msb', 'maelstrom-sentry-battery', { Recon1: u('tarantula-battery') }, { from: ['p', slot(P, 'Command1')] }),
    ]),
  },
  { name: 'I33 unit above maximum size', violates: ['UNIT-MODEL-COUNT'], roster: roster([primary({ Troops1: u('tactical-squad', { models: 25 }) })]) },
];

describe('golden lists', () => {
  it('has at least 10 legal and 10 illegal cases', () => {
    expect(legal.length).toBeGreaterThanOrEqual(10);
    expect(illegal.length).toBeGreaterThanOrEqual(10);
  });

  for (const c of [...legal, ...illegal]) {
    it(c.name, () => {
      const res = validate(c.roster, CATALOG);
      const got = [...new Set(res.errors.map((e) => e.ruleId))].sort();
      expect(got, res.errors.map((e) => e.message).join('\n')).toEqual([...c.violates].sort());
      expect(res.legal).toBe(c.violates.length === 0);
      for (const e of res.errors) {
        expect(RULES[e.ruleId], `unknown rule ${e.ruleId}`).toBeDefined();
        expect(e.message).toContain(`Rule: ${RULES[e.ruleId]!.title}`);
      }
    });
  }
});

describe('error messages read as plain language', () => {
  it('names the unit, the slot and the rule', () => {
    const res = validate(roster([primary({ Troops1: u('predator') })]), CATALOG);
    expect(res.errors[0]!.message).toBe(
      "Predator is an Armour unit and can't fill a Troops slot — Rule: A unit's Battlefield Role must match the slot it fills.",
    );
  });
});
