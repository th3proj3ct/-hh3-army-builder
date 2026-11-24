import type { ArmyListDef, Catalog, DetachmentDef, UnitDef } from './model';
import imported from '../data/bsdata/units.json';
import {
  ASTARTES_DETACHMENTS,
  ASTARTES_PRIMARY_DETACHMENTS,
  ASTARTES_PRIMARY_PRIME_ADVANTAGES,
  ASTARTES_PRIME_ADVANTAGES,
  CORE_DETACHMENTS,
  CORE_LIMITS,
  CORE_MISSIONS,
  CORE_PRIME_ADVANTAGES,
  DEATH_GUARD_DETACHMENTS,
  DEATH_GUARD_PRIME_ADVANTAGES,
  LEGION_DETACHMENTS,
  LEGION_PRIME_ADVANTAGES,
  MECHANICUM_DETACHMENTS,
} from './core-data';

/**
 * The real catalog: hand-entered rules data (detachments, Prime Advantages, caps)
 * plus unit profiles and points imported from BSData by scripts/import-bsdata.ts.
 * Re-run the importer to update points; the version string changes with the commit.
 */
export const LEGIONS = [
  'Dark Angels', "Emperor's Children", 'Iron Warriors', 'White Scars', 'Space Wolves', 'Imperial Fists',
  'Night Lords', 'Blood Angels', 'Iron Hands', 'World Eaters', 'Ultramarines', 'Death Guard',
  'Thousand Sons', 'Sons of Horus', 'Word Bearers', 'Salamanders', 'Raven Guard', 'Alpha Legion',
];
/** Factions with an army list of their own (not a Legion of the Legiones Astartes list). */
export const OTHER_FACTIONS = ['Mechanicum'];
/** Every Faction a detachment can be built from: the Legions, then the other army lists. */
export const FACTIONS = [...LEGIONS, ...OTHER_FACTIONS];
/** Army list a Faction's units come from. */
export const armyListOf = (faction: string): string => (faction === 'Mechanicum' ? 'mechanicum' : 'legiones-astartes');

const lib = (section: string) => ({ book: 'Liber Astartes / Liber Hereticus', version: '1.1', section });
const slug = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const LEGIONES_ASTARTES: ArmyListDef = {
  id: 'legiones-astartes',
  name: 'Legiones Astartes',
  factionChoices: LEGIONS,
  requiresRiteOfWarPerFaction: true,
  // Every Legion has its "Legiones Astartes" Rite; EC and WE also have a "Legiones Hereticus" one.
  rites: [
    ...LEGIONS.map((l) => ({ id: `${slug(l)}-legiones-astartes`, name: `Rite of War: Legiones Astartes ${l}`, factionTrait: l, source: lib(`${l} › Rite of War`) })),
    ...["Emperor's Children", 'World Eaters'].map((l) => ({ id: `${slug(l)}-legiones-hereticus`, name: `Rite of War: Legiones Hereticus ${l}`, factionTrait: l, source: lib(`${l} › Rite of War (Hereticus)`) })),
  ],
  source: lib('The Legiones Astartes Army List'),
};

const MECHANICUM: ArmyListDef = {
  id: 'mechanicum',
  name: 'Mechanicum',
  // Every Mechanicum profile carries the fixed "Mechanicum" Faction; variety is in sub-factions.
  factionChoices: ['Mechanicum'],
  requiresRiteOfWarPerFaction: false,
  rites: [],
  source: { book: 'Liber Mechanicum (via BSData horus-heresy-3rd-edition)', section: 'The Mechanicum Army List' },
};

/** Legiones Astartes detachments may only be built from that list. */
const astartesOnly = (d: DetachmentDef): DetachmentDef => ({ ...d, armyLists: ['legiones-astartes'] });

export const CATALOG: Catalog = {
  version: `bsdata-${imported.commit}`,
  armyLists: [LEGIONES_ASTARTES, MECHANICUM],
  units: imported.units as UnitDef[],
  detachments: [...CORE_DETACHMENTS, ...ASTARTES_PRIMARY_DETACHMENTS, ...ASTARTES_DETACHMENTS.map(astartesOnly), ...DEATH_GUARD_DETACHMENTS.map(astartesOnly), ...LEGION_DETACHMENTS.map(astartesOnly), ...MECHANICUM_DETACHMENTS],
  primeAdvantages: [...CORE_PRIME_ADVANTAGES, ...ASTARTES_PRIME_ADVANTAGES, ...DEATH_GUARD_PRIME_ADVANTAGES, ...LEGION_PRIME_ADVANTAGES, ...ASTARTES_PRIMARY_PRIME_ADVANTAGES],
  missions: CORE_MISSIONS,
  limits: CORE_LIMITS,
};
