import type { BattlefieldRole, DetachmentDef, MissionDef, PrimeAdvantageDef, SlotDef, SourceRef } from './model';

/**
 * Core rules DATA (not points). Slot layouts were read from the Crusade Force
 * Organisation Chart on Wahapedia (Age of Darkness Rulebook v1.2). Unit profiles and
 * points are deliberately NOT here: they need a licensed/hand-entered data source.
 */

const src = (section: string): SourceRef => ({ book: 'Age of Darkness Rulebook', version: '1.2', section });
const lib = (section: string): SourceRef => ({ book: 'Liber Astartes / Liber Hereticus', version: '1.1', section });

/** Build slots from a compact spec: ['Command*', 'Command', 'Troops*'] — '*' = Prime. */
export function slots(prefix: string, spec: string[], restrict?: Partial<Record<BattlefieldRole, SlotDef['restriction']>>): SlotDef[] {
  const counters = new Map<string, number>();
  return spec.map((s) => {
    const prime = s.endsWith('*');
    const role = (prime ? s.slice(0, -1) : s) as BattlefieldRole;
    const n = (counters.get(role) ?? 0) + 1;
    counters.set(role, n);
    const restriction = restrict?.[role];
    return { id: `${prefix}.${role}${n}`, role, ...(prime ? { prime } : {}), ...(restriction ? { restriction } : {}) };
  });
}

const aux = (id: string, name: string, spec: string[]): DetachmentDef => ({
  id,
  name,
  kind: 'Auxiliary',
  slots: slots(id, spec),
  armyListRule: 'linked',
  requirements: [],
  grantsUnlocks: false,
  source: src('Crusade Force Organisation Chart › Auxiliary Detachments'),
});
const apex = (id: string, name: string, spec: string[]): DetachmentDef => ({
  id,
  name,
  kind: 'Apex',
  slots: slots(id, spec),
  armyListRule: 'linked',
  requirements: [],
  grantsUnlocks: true,
  source: src('Crusade Force Organisation Chart › Apex Detachments'),
});

export const CORE_DETACHMENTS: DetachmentDef[] = [
  {
    id: 'crusade-primary',
    name: 'Crusade Primary Detachment',
    kind: 'Primary',
    slots: slots('crusade-primary', [
      'HighCommand',
      'Command*', 'Command', 'Command',
      'Troops*', 'Troops', 'Troops', 'Troops',
      'Transport', 'Transport', 'Transport', 'Transport',
    ]),
    armyListRule: 'primary',
    requirements: [],
    grantsUnlocks: true,
    source: src('Selecting Units for Detachments (Crusade Primary Detachment)'),
  },
  {
    id: 'allied',
    name: 'Allied Detachment',
    kind: 'Allied',
    slots: slots('allied', ['Command*', 'Command', 'Troops', 'Troops', 'Troops', 'Troops']),
    armyListRule: 'differentFaction',
    requirements: [],
    grantsUnlocks: true,
    source: src('Detachment Types › Allied Detachments'),
  },
  {
    id: 'lord-of-war',
    name: 'Lord of War Detachment',
    kind: 'LordOfWar',
    slots: slots('lord-of-war', ['LordOfWar', 'LordOfWar']),
    armyListRule: 'anySingle',
    requirements: [],
    exclusiveGroup: { id: 'lord-of-war', max: 1 },
    grantsUnlocks: false,
    source: src('Detachment Types › Lord of War Detachments'),
  },
  {
    id: 'warlord',
    name: 'Warlord Detachment',
    kind: 'Warlord',
    slots: slots('warlord', ['Warlord', 'Retinue', 'HeavyTransport']),
    armyListRule: 'primary',
    requirements: [
      { kind: 'minPointsLimit', value: 3000, source: src('Detachment Types › Warlord Detachments') },
      { kind: 'detachmentIncludesModelTag', tag: 'Paragon', source: src('Detachment Types › Warlord Detachments') },
    ],
    exclusiveGroup: { id: 'warlord', max: 1 },
    grantsUnlocks: false, // no Command/High Command slots; ambiguity moot
    source: src('Detachment Types › Warlord Detachments'),
  },
  aux('armoured-fist', 'Armoured Fist', ['Transport', 'Transport', 'Transport', 'Transport', 'HeavyTransport', 'HeavyTransport', 'HeavyTransport', 'HeavyTransport']),
  aux('heavy-support', 'Heavy Support', ['WarEngine']),
  aux('combat-pioneer', 'Combat Pioneer', ['Recon', 'Recon']),
  aux('tactical-support', 'Tactical Support', ['Troops', 'Troops', 'Support', 'Support']),
  aux('shock-assault', 'Shock Assault', ['HeavyAssault', 'HeavyAssault']),
  aux('armoured-support', 'Armoured Support', ['Armour', 'Armour', 'Armour', 'Armour']),
  aux('first-strike', 'First Strike', ['FastAttack', 'FastAttack']),
  apex('combat-retinue', 'Combat Retinue', ['Retinue*', 'Retinue', 'Retinue']),
  apex('officer-cadre', 'Officer Cadre', ['Command*', 'Command']),
  apex('army-vanguard', 'Army Vanguard', ['Elites*', 'Elites', 'Elites']),
];

/** A representative sample of Legion detachments, to exercise every requirement kind. */
export const ASTARTES_DETACHMENTS: DetachmentDef[] = [
  {
    id: 'maelstrom-sentry-battery',
    name: 'Maelstrom Sentry Battery',
    kind: 'Auxiliary',
    slots: slots('maelstrom-sentry-battery', ['Support', 'Support', 'Recon', 'Recon', 'Recon'], {
      Support: { unitIds: ['araknae-quad-accelerator-platform'], source: lib('Maelstrom Sentry Battery') },
      Recon: { unitIds: ['tarantula-battery'], source: lib('Maelstrom Sentry Battery') },
    }),
    armyListRule: 'linked',
    requirements: [{ kind: 'unlockedByUnit', unitIds: ['master-of-signals'], source: lib('Maelstrom Sentry Battery') }],
    grantsUnlocks: false,
    source: lib('Legiones Astartes Detachment › Maelstrom Sentry Battery'),
  },
  {
    // UNLOCK CONDITION UNCONFIRMED: Wahapedia shows the slot restriction but no
    // "When an X Unit is selected…" sentence. Encoded as a normal Auxiliary until checked
    // against the printed Liber. See docs/RULES.md › U-4.
    id: 'apothecarion-delegation',
    name: 'Apothecarion Delegation',
    kind: 'Auxiliary',
    slots: slots('apothecarion-delegation', ['Support*', 'Support', 'Support', 'Support', 'Support', 'Support'], {
      Support: { unitIds: ['apothecary'], source: lib('Apothecarion Delegation') },
    }),
    armyListRule: 'linked',
    requirements: [],
    grantsUnlocks: false,
    source: lib('Legiones Astartes Auxiliary Detachments › Apothecarion Delegation'),
  },
  {
    id: 'linebreaker-echelon',
    name: 'Linebreaker Echelon',
    kind: 'Apex',
    slots: slots('linebreaker-echelon', ['HeavyAssault', 'HeavyAssault', 'Retinue', 'WarEngine'], {
      HeavyAssault: { nameContainsDetachmentChoice: true, source: lib('Linebreaker Echelon') },
      Retinue: { nameContainsDetachmentChoice: true, source: lib('Linebreaker Echelon') },
    }),
    armyListRule: 'linked',
    requirements: [],
    choice: { label: 'Armour pattern', options: ['Saturnine', 'Cataphractii', 'Tartaros'] },
    grantsUnlocks: true,
    source: lib('Legiones Astartes Detachment › Linebreaker Echelon'),
  },
  {
    id: 'medusan-vanguard',
    name: 'Medusan Vanguard',
    kind: 'Apex',
    slots: slots('medusan-vanguard', ['Command*', 'HeavyAssault', 'HeavyAssault', 'Support', 'WarEngine'], {
      Command: { unitIds: ['praevian'], source: lib('Iron Hands › Medusan Vanguard') },
    }),
    armyListRule: 'linked',
    requirements: [
      { kind: 'primaryFaction', factions: ['Iron Hands'], source: lib('Iron Hands › Additional Detachments') },
      { kind: 'armyIncludesUnit', unitIds: ['iron-father', 'ferrus-manus'], source: lib('Iron Hands › Medusan Vanguard') },
    ],
    grantsUnlocks: true,
    source: lib('Iron Hands › Additional Detachments'),
  },
  {
    id: 'brotherhood-of-the-phoenix',
    name: 'Brotherhood of the Phoenix',
    kind: 'Warlord',
    slots: slots('brotherhood-of-the-phoenix', ['Warlord', 'HighCommand*', 'HighCommand', 'HighCommand', 'Command']),
    armyListRule: 'primary',
    requirements: [
      { kind: 'primaryFaction', factions: ["Emperor's Children"], source: lib("Emperor's Children › Additional Detachment") },
      { kind: 'minPointsLimit', value: 3000, source: lib('Brotherhood of the Phoenix') },
      { kind: 'detachmentIncludesUnit', unitIds: ['fulgrim-transfigured'], source: lib('Brotherhood of the Phoenix') },
    ],
    exclusiveGroup: { id: 'warlord', max: 1 }, // "instead of a Warlord Detachment"
    grantsUnlocks: false, // "do not grant access to any additional Auxiliary or Apex Detachments"
    source: lib("Emperor's Children › Brotherhood of the Phoenix"),
  },
  {
    id: 'exalted-conclave',
    name: 'Exalted Conclave',
    kind: 'Apex',
    slots: slots('exalted-conclave', ['Troops*', 'Troops*', 'Elites', 'Elites']),
    armyListRule: 'linked',
    requirements: [
      { kind: 'primaryFaction', factions: ['Word Bearers'], source: lib('Word Bearers › Additional Detachment') },
      { kind: 'allegiance', value: 'Traitor', source: lib('Exalted Conclave') },
    ],
    allowedPrimeAdvantages: ['true-believers'],
    grantsUnlocks: true,
    source: lib('Word Bearers › Exalted Conclave'),
  },
];

export const CORE_PRIME_ADVANTAGES: PrimeAdvantageDef[] = [
  { id: 'master-sergeant', name: 'Master Sergeant', effect: { kind: 'modelBuff' }, oncePer: 'detachment', allowedForUnique: false, source: src('Prime Slots › Core Prime Traits') },
  { id: 'combat-veterans', name: 'Combat Veterans', effect: { kind: 'modelBuff' }, allowedForUnique: false, source: src('Prime Slots › Core Prime Traits') },
  { id: 'paragon-of-battle', name: 'Paragon of Battle', effect: { kind: 'modelBuff' }, allowedForUnique: false, source: src('Prime Slots › Core Prime Traits') },
  { id: 'special-assignment', name: 'Special Assignment', effect: { kind: 'specialAssignment' }, slotRoles: ['Command'], allowedForUnique: true, source: src('Prime Slots › Core Prime Traits') },
  {
    id: 'logistical-benefit',
    name: 'Logistical Benefit',
    effect: { kind: 'addSlot', excludedRoles: ['HighCommand', 'Command', 'Warlord', 'LordOfWar'] },
    oncePer: 'detachment',
    allowedForUnique: true,
    source: src('Prime Slots › Core Prime Traits'),
  },
];

export const ASTARTES_PRIME_ADVANTAGES: PrimeAdvantageDef[] = [
  {
    id: 'true-believers',
    name: 'True Believers',
    effect: { kind: 'modelBuff' },
    allegiance: 'Traitor',
    allowedForUnique: false,
    unitRequirement: { armyLists: ['legiones-astartes'], excludeModelTags: ['Vehicle'] },
    source: lib('Additional Prime Advantage › Corrupted Legions'),
  },
  {
    id: 'iron-hands-war-engine',
    name: 'Iron Hands Command Prime (extra War-engine slot)',
    effect: { kind: 'addSlot', allowedRoles: ['WarEngine'] },
    oncePer: 'army',
    allowedForUnique: false,
    unitRequirement: { roles: ['Command'], factionTraits: ['Iron Hands'] },
    source: lib('Iron Hands › Prime Advantage'),
  },
];

export const CORE_MISSIONS: MissionDef[] = [
  { id: 'core', name: 'Core Mission Pack', requiredPointsLimit: 3000, source: src('Core Mission Pack › 2. Select Armies') },
];

export const CORE_LIMITS = {
  alliedShare: 0.5,
  warlordLordOfWarShare: 0.25,
  warlordMinPointsLimit: 3000,
  advisedMin: 2000,
  advisedMax: 4000,
};
