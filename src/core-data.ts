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

/** An Auxiliary that only a specific unit in a Command slot can unlock. */
function specificAux(
  id: string,
  name: string,
  spec: string[],
  unlockedBy: string[],
  restrict?: Partial<Record<BattlefieldRole, SlotDef['restriction']>>,
  allegiance?: 'Traitor' | 'Loyalist',
): DetachmentDef {
  return {
    id,
    name,
    kind: 'Auxiliary',
    slots: slots(id, spec, restrict),
    armyListRule: 'linked',
    requirements: [{ kind: 'unlockedByUnit', unitIds: unlockedBy, ...(allegiance ? { allegiance } : {}), source: lib(name) }],
    grantsUnlocks: false,
    source: lib(`Legiones Astartes Auxiliary Detachments › ${name}`),
  };
}

/** Legiones Astartes detachments, plus Legion-specific samples exercising every requirement kind. */
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
  // ── Legiones Astartes Auxiliary Detachments (Wahapedia, re-read 13 Nov 2026) ──
  // Specific-unit unlocks: the named unit in a Command slot may add this detachment
  // "instead of the options available in the Crusade Force Organisation Chart".
  specificAux('daemonic-manifestation', 'Daemonic Manifestation', ['HeavyAssault', 'HeavyAssault', 'HeavyAssault'], ['esoterist'], {
    // From the Daemons of the Ruinstorm list, which isn't imported yet, so these slots can't be filled here.
    HeavyAssault: { unitIds: ['ruinstorm-daemon-brutes'], armyList: 'daemons-of-the-ruinstorm', source: lib('Daemonic Manifestation') },
  }, 'Traitor'),
  specificAux('veteran-cadre', 'Veteran Cadre', ['Retinue', 'Elites', 'HeavyTransport'], ['legion-champion']),
  specificAux('recon-demi-company', 'Recon Demi-company', ['Recon*', 'Recon', 'Recon', 'FastAttack'], ['vigilator'], {
    Recon: { unitIds: ['reconnaissance-squad'], source: lib('Recon Demi-company') },
  }),
  specificAux('storm-battery', 'Storm Battery', ['Support', 'Support', 'Armour', 'Armour'], ['siege-breaker'], {
    Support: { unitIds: ['rapier-battery'], source: lib('Storm Battery') },
    Armour: { unitIds: ['arquitor-bombard', 'vindicator-siege-tank'], source: lib('Storm Battery') },
  }),
  // Tip of the Spear (Master of Descent): "An Army whose Primary Detachment includes a Model with
  // this Special Rule may select the Planetfall Speartip Auxiliary Detachment once per Army,
  // following all the normal Rules for selecting Auxiliary Detachments." (BSData Special Rules)
  {
    id: 'planetfall-speartip',
    name: 'Planetfall Speartip',
    kind: 'Auxiliary',
    slots: slots('planetfall-speartip', ['Retinue', 'Elites*', 'Elites*'], {
      Retinue: { unitIds: ['praetorian-command-squad-with-jump-packs'], source: lib('Special Rules › Tip of the Spear') },
      Elites: { unitIds: ['veteran-assault-squad'], source: lib('Special Rules › Tip of the Spear') },
    }),
    armyListRule: 'linked',
    requirements: [{ kind: 'primaryIncludesUnit', unitIds: ['master-of-descent'], source: lib('Special Rules › Tip of the Spear') }],
    exclusiveGroup: { id: 'planetfall-speartip', max: 1 },
    grantsUnlocks: false,
    source: { book: 'BSData horus-heresy-3rd-edition', section: 'Special Rules › Tip of the Spear; Auxiliary - Planetfall Speartip' },
  },
  specificAux('dreadnought-talon', 'Dreadnought Talon', ['WarEngine', 'WarEngine', 'WarEngine'], ['mortificator', 'mortificator-in-terminator-armour'], {
    WarEngine: { unitIds: ['contemptor-dreadnought'], source: lib('Dreadnought Talon') },
  }),
  {
    id: 'techmarine-covenant',
    name: 'Techmarine Covenant',
    kind: 'Auxiliary',
    slots: slots('techmarine-covenant', ['Support*', 'Support', 'Support', 'Support', 'Support', 'Support'], {
      Support: { unitIds: ['techmarine'], source: lib('Techmarine Covenant') },
    }),
    armyListRule: 'linked',
    requirements: [],
    grantsUnlocks: false,
    source: lib('Legiones Astartes Auxiliary Detachments › Techmarine Covenant'),
  },
  {
    // No specific-unit unlock: Wahapedia gives none and BSData only requires a Legion
    // Primary, so it's taken with any Command/High Command unlock (project decision).
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

/** Death Guard (Liber Hereticus, as shown on Wahapedia). Layout from the chart markup. */
export const DEATH_GUARD_DETACHMENTS: DetachmentDef[] = [
  {
    id: 'reaping-host',
    name: 'Reaping Host',
    kind: 'Auxiliary',
    slots: slots('reaping-host', ['Troops*', 'Troops', 'Support', 'HeavyAssault'], {
      Troops: { excludeUnitIds: ['assault-squad'], source: lib('Death Guard › Reaping Host') },
    }),
    armyListRule: 'linked',
    requirements: [{ kind: 'primaryFaction', factions: ['Death Guard'], source: lib('Death Guard › Additional Detachment') }],
    grantsUnlocks: false,
    source: lib('Death Guard › Additional Detachment › Reaping Host'),
  },
];

/**
 * Mechanicum Apex detachments. Slot layouts and unlocks are read from BSData's force
 * entries (the "Detachment Composition" profiles and the "Archmagos is <sub-faction>"
 * conditions), not from the Liber Mechanicum text, which wasn't available to check.
 * Each is unlocked by an Archmagos of one sub-faction in a High Command slot.
 */
const mech = (section: string): SourceRef => ({ book: 'Liber Mechanicum (via BSData horus-heresy-3rd-edition)', section });
const ARCHMAGI = ['archmagos', 'archmagos-on-abeyant'];
function mechApex(
  id: string,
  name: string,
  spec: string[],
  subFaction: string,
  restrict: Partial<Record<BattlefieldRole, Omit<NonNullable<SlotDef['restriction']>, 'source'>>>,
  grantsUnlocks = true,
): DetachmentDef {
  const source = mech(`Apex Detachments › ${name}`);
  const withSource = Object.fromEntries(Object.entries(restrict).map(([role, r]) => [role, { ...r, source }]));
  return {
    id,
    name,
    kind: 'Apex',
    slots: slots(id, spec, withSource),
    armyListRule: 'linked',
    armyLists: ['mechanicum'],
    requirements: [{ kind: 'unlockedByUnit', unitIds: ARCHMAGI, subFaction, source }],
    grantsUnlocks,
    source,
  };
}
export const MECHANICUM_DETACHMENTS: DetachmentDef[] = [
  mechApex('command-maniple', 'Command Maniple', ['Elites*', 'Support*', 'WarEngine*'], 'Cybernetica', {
    Elites: { modelTag: 'Automata' }, Support: { modelTag: 'Automata' }, WarEngine: { modelTag: 'Automata' },
  }),
  mechApex('panoply-of-cruelty', 'The Panoply of Cruelty', ['HeavyAssault*', 'HeavyAssault*', 'HeavyAssault*'], 'Lacrymaerta', {
    HeavyAssault: { unitIds: ['ursarax-cohort'] },
  }),
  mechApex('host-of-destruction', 'The Host of Destruction', ['Elites*', 'Elites', 'Elites', 'Elites'], 'Myrmidax', {
    Elites: { subFaction: 'Myrmidax' },
  }),
  // "these do not grant additional Auxiliary Detachments and must form a single Unit":
  // the first half is grantsUnlocks: false; the single-unit part isn't checked (see RULES.md).
  mechApex('crux-of-judgement', 'Crux of Judgement', ['Command', 'Command', 'Command'], 'Malagra', {
    Command: { unitIds: ['arcuitor-magisterium'] },
  }, false),
  // "must include a Praetorian": unit composition isn't modelled, so it isn't checked.
  mechApex('thallax-command-cohort', 'Thallax Command Cohort', ['Support*', 'Support*', 'Support*'], 'Reductor', {
    Support: { unitIds: ['thallax-cohort'] },
  }),
];

/**
 * Legion Additional Detachments: "An Army that has a Primary Detachment with the <Legion>
 * Faction may select the following … Detachments using the standard Rules". Layouts and
 * restrictions read from each Legion's Wahapedia page (chart markup), 14 Nov 2026, and
 * checked against BSData's force entries. Where the two differ, Wahapedia is used and
 * the difference is listed in docs/RULES.md.
 */
type Restrict = Partial<Record<BattlefieldRole, Omit<NonNullable<SlotDef['restriction']>, 'source'>>>;
function legionDet(
  legion: string,
  id: string,
  name: string,
  spec: string[],
  restrict: Restrict = {},
  extra: { kind?: 'Auxiliary' | 'Apex'; requirements?: DetachmentDef['requirements']; allowedPrimeAdvantages?: string[] } = {},
): DetachmentDef {
  const source = lib(`${legion} › Additional Detachments › ${name}`);
  const kind = extra.kind ?? 'Auxiliary';
  return {
    id,
    name,
    kind,
    slots: slots(id, spec, Object.fromEntries(Object.entries(restrict).map(([r, x]) => [r, { ...x, source }]))),
    armyListRule: 'linked',
    requirements: [{ kind: 'primaryFaction', factions: [legion], source }, ...(extra.requirements ?? [])],
    ...(extra.allowedPrimeAdvantages ? { allowedPrimeAdvantages: extra.allowedPrimeAdvantages } : {}),
    grantsUnlocks: kind === 'Apex',
    source,
  };
}
const only = (...unitIds: string[]) => ({ unitIds });

export const LEGION_DETACHMENTS: DetachmentDef[] = [
  // I – Dark Angels
  legionDet('Dark Angels', 'ironwing-gauntlet', 'Ironwing Gauntlet', ['HeavyTransport', 'HeavyTransport', 'Armour', 'Armour']),
  legionDet('Dark Angels', 'dreadwing-cadre', 'Dreadwing Cadre', ['Support*', 'Support', 'Support'], { Support: only('dreadwing-interemptor-squad', 'rapier-battery') }),
  legionDet('Dark Angels', 'stormwing-muster', 'Stormwing Muster', ['Troops*', 'Troops*', 'Transport', 'Transport']),
  legionDet('Dark Angels', 'deathwing-conclave', 'Deathwing Conclave', ['Retinue*', 'Elites', 'HeavyAssault']),
  legionDet('Dark Angels', 'ravenwing-lance', 'Ravenwing Lance', ['FastAttack*', 'FastAttack', 'Recon', 'Recon'], { Recon: only('outrider-squadron') }),
  legionDet('Dark Angels', 'firewing-echelon', 'Firewing Echelon', ['Recon*', 'Recon', 'Elites', 'Elites'], { Elites: only('seeker-squad') }),
  // III – Emperor's Children (Brotherhood of the Phoenix is in ASTARTES_DETACHMENTS)
  legionDet("Emperor's Children", 'primacy-wing', 'Primacy Wing', ['Retinue', 'Elites', 'FastAttack', 'FastAttack']),
  // IV – Iron Warriors
  legionDet('Iron Warriors', 'ironfire-cohort', 'The Ironfire Cohort', ['Armour*', 'Armour', 'Support', 'Support'], { Armour: only('arquitor-bombard') }),
  legionDet('Iron Warriors', 'hammer-of-olympia', 'The Hammer of Olympia', ['HeavyAssault*', 'HeavyAssault', 'HeavyTransport', 'Troops*', 'Troops'], {}, {
    kind: 'Apex',
    requirements: [{ kind: 'armyIncludesUnit', unitIds: ['warsmith', 'perturabo'], source: lib('Iron Warriors › The Hammer of Olympia') }],
  }),
  // V – White Scars
  legionDet('White Scars', 'chogorian-warband', 'Chogorian Warband', ['FastAttack*', 'FastAttack', 'Recon', 'Recon'], {
    FastAttack: only('scimitar-jetbike-squadron'),
    Recon: only('outrider-squadron'),
  }),
  // VI – Space Wolves
  legionDet('Space Wolves', 'bloodied-claw', 'Bloodied Claw', ['Troops*', 'Troops', 'HeavyAssault', 'HeavyAssault'], { Troops: only('grey-slayer-pack') }),
  // VII – Imperial Fists
  legionDet('Imperial Fists', 'siege-gauntlet', 'Siege Gauntlet', ['Troops*', 'Troops', 'HeavyAssault', 'Support'], { Troops: only('breacher-squad') }),
  // VIII – Night Lords
  legionDet('Night Lords', 'terror-assault', 'Terror Assault', ['Troops*', 'Troops', 'FastAttack', 'FastAttack'], { Troops: only('terror-squad') }),
  legionDet('Night Lords', 'atramentar-hunt', 'Atramentar Hunt', ['Retinue*', 'HeavyAssault*', 'HeavyAssault*'], {
    Retinue: only('cataphractii-terminator-command-squad', 'tartaros-terminator-command-squad'),
    HeavyAssault: only('cataphractii-terminator-squad', 'tartaros-terminator-squad'),
  }, { kind: 'Apex', allowedPrimeAdvantages: ['atramentar'] }),
  // IX – Blood Angels
  legionDet('Blood Angels', 'revelation-host', 'Revelation Host', ['Troops*', 'Troops', 'Elites', 'Elites'], {
    Troops: only('assault-squad'),
    Elites: only('dawnbreaker-cohort', 'veteran-assault-squad'),
  }),
  // X – Iron Hands (Medusan Vanguard is in ASTARTES_DETACHMENTS)
  legionDet('Iron Hands', 'spearhead-phalanx', 'Spearhead Phalanx', ['HeavyTransport', 'Armour', 'HeavyAssault'], { HeavyTransport: only('land-raider-carrier', 'spartan-assault-tank') }),
  // XII – World Eaters
  legionDet('World Eaters', 'berserker-cadre', 'Berserker Cadre', ['Troops*', 'HeavyAssault', 'HeavyAssault', 'Elites'], { HeavyAssault: only('rampager-squad') }),
  legionDet('World Eaters', 'sons-of-bodt', 'Sons of Bodt', ['Support*', 'Support*', 'Troops', 'Troops', 'Troops'], { Support: only('apothecary') }),
  // XIII – Ultramarines. Wahapedia: Apex; BSData: Auxiliary (see RULES.md).
  legionDet('Ultramarines', 'primus-demi-company', 'Primus Demi-company', ['Command*', 'Troops', 'Troops', 'Support', 'FastAttack'], { Command: only('optae') }, { kind: 'Apex' }),
  // XV – Thousand Sons
  legionDet('Thousand Sons', 'prosperine-convocation', 'Prosperine Convocation', ['Troops*', 'FastAttack', 'Elites', 'HeavyTransport']),
  // XVI – Sons of Horus
  legionDet('Sons of Horus', 'supremacy-cadre', 'Supremacy Cadre', ['Troops*', 'Troops*', 'HeavyAssault', 'Elites']),
  // XVIII – Salamanders
  legionDet('Salamanders', 'immolation-covenant', 'Immolation Covenant', ['Support*', 'Support', 'Armour', 'Armour'], { Armour: only('predator', 'vindicator-siege-tank') }),
  // XIX – Raven Guard
  legionDet('Raven Guard', 'decapitation-cadre', 'Decapitation Cadre', ['Recon', 'Recon', 'Elites', 'Elites'], {
    Recon: only('reconnaissance-squad'),
    Elites: only('veteran-assault-squad', 'dark-fury-squad'),
  }),
  // XX – Alpha Legion
  legionDet('Alpha Legion', 'headhunter-leviathal', 'Headhunter Leviathal', ['Recon*', 'Recon*', 'Elites', 'Elites'], { Elites: only('seeker-squad', 'headhunter-kill-team') }),
];

export const LEGION_PRIME_ADVANTAGES: PrimeAdvantageDef[] = [
  {
    id: 'atramentar',
    name: 'Atramentar',
    summary: 'Night Lords Terminators: the unit gains Deep Strike and Impact (I). The only Prime Advantage in an Atramentar Hunt.',
    effect: { kind: 'modelBuff' },
    allowedForUnique: false,
    unitRequirement: {
      unitIds: ['centurion-in-terminator-armour', 'cataphractii-terminator-command-squad', 'tartaros-terminator-command-squad', 'cataphractii-terminator-squad', 'tartaros-terminator-squad'],
      factionTraits: ['Night Lords'],
    },
    source: lib('Night Lords › Atramentar'),
  },
];

/** Mechanicum Auxiliaries (BSData force entries: "Mechanicum only", no unit restrictions). */
const mechAux = (id: string, name: string, spec: string[]): DetachmentDef => ({
  ...aux(id, name, spec),
  armyLists: ['mechanicum'],
  source: mech(`Auxiliary Detachments › ${name}`),
});
MECHANICUM_DETACHMENTS.push(
  mechAux('taghmata-cohort', 'Taghmata Cohort', ['Support', 'Support', 'Support', 'Support']),
  mechAux('apprentice-cadre', 'Apprentice Cadre', ['Troops*', 'Troops', 'Troops', 'Troops']),
  // "All Troops must have the Combat Veterans Prime Advantage": not enforced (see RULES.md).
  mechApex('heart-of-power', 'The Heart of Power', ['Retinue*', 'Retinue', 'Retinue', 'Troops*', 'Troops*', 'Troops*'], 'Archimandrite', {}),
  // "All must take the Prime Conveyor Prime Advantage": that advantage isn't in the data yet.
  mechApex('iron-phalanx', 'Iron Phalanx', ['Armour*', 'Armour*', 'Armour*', 'HeavyTransport*', 'HeavyTransport*', 'HeavyTransport*'], 'Macrotek', {}),
);

export const DEATH_GUARD_PRIME_ADVANTAGES: PrimeAdvantageDef[] = [
  {
    id: 'unnatural-resilience',
    name: 'Unnatural Resilience', summary: 'Death Guard Centurion only: +1 Wounds and Eternal Warrior (2). Once per army.',
    effect: { kind: 'modelBuff' },
    oncePer: 'army',
    allowedForUnique: false,
    // "a Centurion Model … or a Cataphractii Centurion Model with the Death Guard Trait".
    // Cataphractii Centurion is mapped to "Centurion in Terminator Armour" — confirm.
    unitRequirement: { unitIds: ['centurion', 'centurion-in-terminator-armour'], factionTraits: ['Death Guard'] },
    source: lib('Death Guard › Unnatural Resilience'),
  },
];

export const CORE_PRIME_ADVANTAGES: PrimeAdvantageDef[] = [
  { id: 'master-sergeant', name: 'Master Sergeant', summary: 'One Sergeant gets +1 A, WS and LD and becomes a Champion. Once per detachment.', effect: { kind: 'modelBuff' }, oncePer: 'detachment', allowedForUnique: false, source: src('Prime Slots › Core Prime Traits') },
  { id: 'combat-veterans', name: 'Combat Veterans', summary: 'Every model in the unit gets +1 LD, CL, IN and WP (max 10).', effect: { kind: 'modelBuff' }, allowedForUnique: false, source: src('Prime Slots › Core Prime Traits') },
  { id: 'paragon-of-battle', name: 'Paragon of Battle', summary: 'One Command model in the unit gets +1 A, WS and BS.', effect: { kind: 'modelBuff' }, allowedForUnique: false, source: src('Prime Slots › Core Prime Traits') },
  { id: 'special-assignment', name: 'Special Assignment', summary: 'Command slots only: a High Command unit may fill this slot, but it then unlocks no detachments.', effect: { kind: 'specialAssignment' }, slotRoles: ['Command'], allowedForUnique: true, source: src('Prime Slots › Core Prime Traits') },
  {
    id: 'logistical-benefit',
    name: 'Logistical Benefit', summary: 'Adds one slot to this detachment (not High Command, Command, Warlord or Lord of War). Once per detachment.',
    effect: { kind: 'addSlot', excludedRoles: ['HighCommand', 'Command', 'Warlord', 'LordOfWar'] },
    oncePer: 'detachment',
    allowedForUnique: true,
    source: src('Prime Slots › Core Prime Traits'),
  },
];

/**
 * Legiones Astartes Primary Detachments: "If the Legiones Astartes Army List is selected for an
 * Army's Primary Detachment, one of [these] may be used in place of the Crusade Primary
 * Detachment." Warhammer Community PDF, Nov 2026. Layouts read from its slot charts; the
 * restrictions are paraphrased into PrimaryRules. In-game rules (Victory Points for destroyed
 * units, Squadron Tactics, Orbital Drop Protocols…) aren't list-building and are in RULES.md.
 */
const wc = (section: string): SourceRef => ({ book: 'Legiones Astartes Primary Detachments (Warhammer Community)', version: 'Nov 2026', section });
const altPrimary = (id: string, name: string, spec: string[], primaryRules: DetachmentDef['primaryRules']): DetachmentDef => ({
  id,
  name,
  kind: 'Primary',
  slots: slots(id, spec),
  armyListRule: 'primary',
  armyLists: ['legiones-astartes'],
  requirements: [],
  grantsUnlocks: true,
  primaryRules,
  source: wc(name),
});
const NO_SLOT_PRIMES = { noSlotAddingPrimes: {} };
export const ASTARTES_PRIMARY_DETACHMENTS: DetachmentDef[] = [
  altPrimary('pride-of-the-legion', 'Pride of the Legion', [
    'HighCommand',
    'Command*', 'Command', 'Retinue', 'Retinue', 'Retinue',
    'HeavyAssault*', 'HeavyAssault', 'HeavyAssault', 'HeavyAssault', 'HeavyAssault',
    'Elites*', 'Elites', 'Elites', 'Elites', 'Elites',
  ], {
    ...NO_SLOT_PRIMES,
    armyNeedsRule: 'Master of the Legion',
    allowedDetachments: ['officer-cadre', 'shock-assault', 'heavy-support', 'warlord', 'lord-of-war'],
    lordOfWarModelTag: 'Transport',
    extraSlots: { roles: ['HeavyTransport'], perFilledRoles: ['Retinue', 'HeavyAssault', 'Elites'] },
  }),
  altPrimary('fury-of-the-ancients', 'Fury of the Ancients', [
    'HighCommand', 'Retinue',
    'Command*', 'Command',
    'WarEngine*', 'WarEngine', 'WarEngine', 'WarEngine', 'WarEngine',
    'WarEngine*', 'WarEngine', 'WarEngine', 'WarEngine', 'WarEngine',
  ], {
    noSlotAddingPrimes: { exceptRoles: ['WarEngine'] },
    unitsNeedRule: { ifTags: ['Command', 'Specialist'], rule: 'Battlesmith' },
    allowedDetachments: ['techmarine-covenant', 'heavy-support', 'lord-of-war'],
    lordOfWarModelTag: 'Transport',
  }),
  altPrimary('sky-hunter-phalanx', 'Sky-Hunter Phalanx', [
    'HighCommand',
    'Command*', 'Command', 'Retinue', 'Retinue',
    'FastAttack*', 'FastAttack', 'FastAttack', 'FastAttack', 'FastAttack',
    'FastAttack*', 'FastAttack', 'FastAttack', 'FastAttack', 'FastAttack',
  ], {
    ...NO_SLOT_PRIMES,
    allowedDetachments: ['first-strike', 'combat-pioneer', 'lord-of-war'],
    warnUnlessTags: ['Antigrav', 'Flyer'],
    slotExchanges: [
      { faction: 'White Scars', from: 'Retinue', to: 'Elites', unitIds: ['golden-keshig'] },
      { faction: 'White Scars', from: 'FastAttack', to: 'Support', unitIds: ['kyzagan-assault-speeder'] },
    ],
  }),
  altPrimary('armoured-spearhead', 'Armoured Spearhead', [
    'HighCommand',
    'Command', 'Command', 'Command', 'Transport',
    'Armour', 'Armour', 'Armour', 'Armour', 'Armour',
    'Armour', 'Armour', 'Armour', 'Armour', 'Armour',
  ], {
    ...NO_SLOT_PRIMES,
    allowedDetachments: ['armoured-support', 'combat-pioneer', 'first-strike', 'techmarine-covenant', 'armoured-fist', 'lord-of-war'],
    unitsNeedRule: { ifNotTags: ['Vehicle'], rule: 'Battlesmith' },
    noImmobile: true,
    decurionCommand: true,
  }),
  altPrimary('orbital-drop-assault', 'Orbital Drop Assault', [
    'HighCommand',
    'Command*', 'Command', 'Retinue',
    'HeavyAssault*', 'HeavyAssault', 'Troops*', 'Troops',
    'Elites*', 'Elites', 'Transport', 'Transport',
  ], {
    ...NO_SLOT_PRIMES,
    allowedDetachments: ['tactical-support', 'first-strike', 'shock-assault', 'heavy-support', 'warlord', 'lord-of-war'],
    maxOf: { 'first-strike': 1 },
    extraSlots: { roles: ['Transport', 'HeavyTransport'], perNonVehicleUnit: true },
  }),
];
export const ASTARTES_PRIMARY_PRIME_ADVANTAGES: PrimeAdvantageDef[] = [
  {
    id: 'ancient-of-war',
    name: 'Ancient of War',
    summary: 'Fury of the Ancients only. A Walker unit (not Malefic) gains Eternal Warrior (1).',
    effect: { kind: 'modelBuff' },
    allowedForUnique: false,
    onlyInDetachments: ['fury-of-the-ancients'],
    // "a Model with the Walker Type that does not have the Malefic Sub-Type".
    unitRequirement: { modelTags: ['Walker'], excludeModelTags: ['Malefic'] },
    source: wc('Fury of the Ancients › Ancient of War'),
  },
  {
    id: 'skilled-riders',
    name: 'Skilled Riders',
    summary: 'Sky-Hunter Phalanx only. Cavalry models in the unit gain Shrouded (6+) and Move Through Cover.',
    effect: { kind: 'modelBuff' },
    allowedForUnique: false,
    onlyInDetachments: ['sky-hunter-phalanx'],
    source: wc('Sky-Hunter Phalanx › Skilled Riders'),
  },
];

export const ASTARTES_PRIME_ADVANTAGES: PrimeAdvantageDef[] = [
  {
    id: 'true-believers',
    name: 'True Believers', summary: 'Traitor, non-Vehicle Legion units only: every model gains the Malefic Sub-Type.',
    effect: { kind: 'modelBuff' },
    allegiance: 'Traitor',
    allowedForUnique: false,
    unitRequirement: { armyLists: ['legiones-astartes'], excludeModelTags: ['Vehicle'] },
    source: lib('Additional Prime Advantage › Corrupted Legions'),
  },
  {
    id: 'iron-hands-war-engine',
    name: 'Iron Hands Command Prime (extra War-engine slot)', summary: 'Adds one War-engine slot to this detachment; the unit in it becomes a Champion. Once per army.',
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
