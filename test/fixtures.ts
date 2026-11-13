/**
 * FIXTURE CATALOG. Detachment layouts and Prime Advantages are the real core data;
 * every unit's points, sizes and options below are INVENTED test values. Golden tests
 * here prove the rules engine, not the points data — real points need their own
 * snapshot tests against the published Liber/points documents (see docs/TEST-PLAN.md).
 */
import type {
  Catalog,
  DetachmentInstance,
  ExtraSlot,
  OptionDef,
  Roster,
  UnitDef,
  UnitInstance,
} from '../src/model';
import {
  ASTARTES_DETACHMENTS,
  ASTARTES_PRIME_ADVANTAGES,
  CORE_DETACHMENTS,
  CORE_LIMITS,
  CORE_MISSIONS,
  CORE_PRIME_ADVANTAGES,
} from '../src/core-data';

const FX = { book: 'TEST FIXTURE', section: 'invented values' };
const LEGIONS = [
  'Dark Angels', "Emperor's Children", 'Iron Warriors', 'White Scars', 'Space Wolves', 'Imperial Fists',
  'Night Lords', 'Blood Angels', 'Iron Hands', 'World Eaters', 'Ultramarines', 'Death Guard',
  'Thousand Sons', 'Sons of Horus', 'Word Bearers', 'Salamanders', 'Raven Guard', 'Alpha Legion',
];

const decurion: OptionDef[] = [
  { id: 'decurion-defensor', name: 'Decurion Defensor', cost: { points: 20, per: 'unit' }, max: 1, group: 'decurion', groupMax: 1 },
  { id: 'decurion-locus', name: 'Decurion Locus', cost: { points: 30, per: 'unit' }, max: 1, group: 'decurion', groupMax: 1 },
];

type U = Omit<UnitDef, 'source' | 'options' | 'modelTags' | 'allegiance' | 'factionTrait' | 'armyList' | 'points'> &
  Partial<UnitDef> & { pts: number; min?: number; max?: number; per?: number };
const unit = (u: U): UnitDef => ({
  armyList: 'legiones-astartes',
  allegiance: 'Any',
  factionTrait: null,
  modelTags: ['Infantry'],
  options: [],
  source: FX,
  ...u,
  points: { base: u.pts, minModels: u.min ?? 1, maxModels: u.max ?? u.min ?? 1, perExtraModel: u.per ?? 0 },
});

export const UNITS: UnitDef[] = [
  unit({ id: 'praetor', name: 'Praetor', role: 'HighCommand', pts: 100, modelTags: ['Infantry', 'Command'] }),
  unit({ id: 'centurion', name: 'Centurion', role: 'Command', pts: 75, modelTags: ['Infantry', 'Command'],
    options: [{ id: 'artificer', name: 'Artificer armour', cost: { points: 10, per: 'unit' }, max: 1 }] }),
  unit({ id: 'master-of-signals', name: 'Master of Signals', role: 'Command', pts: 70 }),
  unit({ id: 'iron-father', name: 'Iron Father', role: 'Command', pts: 110, factionTrait: 'Iron Hands' }),
  unit({ id: 'praevian', name: 'Praevian', role: 'Command', pts: 90, factionTrait: 'Iron Hands' }),
  unit({ id: 'named-captain', name: 'Named Captain (Unique)', role: 'Command', pts: 130, factionTrait: 'Blood Angels', modelTags: ['Infantry', 'Unique', 'Command'] }),
  unit({ id: 'command-squad', name: 'Command Squad', role: 'Retinue', pts: 100, min: 5, max: 10, per: 20 }),
  unit({ id: 'tactical-squad', name: 'Tactical Squad', role: 'Troops', pts: 125, min: 10, max: 20, per: 10, modelTags: ['Infantry', 'Sergeant'],
    options: [
      { id: 'chainsword', name: 'Exchange bolter for chainsword', cost: { points: 1, per: 'model' }, max: 'models', group: 'bolter' },
      { id: 'combi', name: 'Exchange bolter for combi-bolter', cost: { points: 2, per: 'model' }, max: 'models', group: 'bolter' },
      { id: 'vexilla', name: 'Legion vexilla', cost: { points: 10, per: 'unit' }, max: 1 },
      { id: 'ba-armoury', name: 'Blood Angels armoury item', cost: { points: 5, per: 'unit' }, max: 1, factionTraits: ['Blood Angels'] },
      { id: 'traitor-icon', name: 'Traitor icon', cost: { points: 5, per: 'unit' }, max: 1, allegiance: 'Traitor' },
    ] }),
  unit({ id: 'inductii-squad', name: 'Inductii Squad', role: 'Troops', pts: 100, min: 10, max: 10, rules: ['Inductii'] }),
  unit({ id: 'despoiler-squad', name: 'Despoiler Squad (Traitor-only fixture)', role: 'Troops', pts: 120, min: 10, max: 10, allegiance: 'Traitor' }),
  unit({ id: 'rhino', name: 'Rhino', role: 'Transport', pts: 60, modelTags: ['Vehicle'], options: decurion }),
  unit({ id: 'land-raider', name: 'Land Raider', role: 'HeavyTransport', pts: 250, modelTags: ['Vehicle'] }),
  unit({ id: 'predator', name: 'Predator', role: 'Armour', pts: 120, modelTags: ['Vehicle'], options: decurion }),
  unit({ id: 'contemptor', name: 'Contemptor Dreadnought', role: 'WarEngine', pts: 165, modelTags: ['Dreadnought'] }),
  unit({ id: 'araknae-quad-accelerator-platform', name: 'Araknae Quad Accelerator Platform', role: 'Support', pts: 80 }),
  unit({ id: 'apothecary', name: 'Apothecary', role: 'Support', pts: 50 }),
  unit({ id: 'tarantula-battery', name: 'Tarantula Battery', role: 'Recon', pts: 40 }),
  unit({ id: 'recon-squad', name: 'Reconnaissance Squad', role: 'Recon', pts: 100, min: 5, max: 10, per: 15 }),
  unit({ id: 'tartaros-squad', name: 'Tartaros Terminator Squad', role: 'HeavyAssault', pts: 175, min: 5, max: 10, per: 35 }),
  unit({ id: 'cataphractii-squad', name: 'Cataphractii Terminator Squad', role: 'HeavyAssault', pts: 175, min: 5, max: 10, per: 35 }),
  unit({ id: 'tartaros-command', name: 'Tartaros Command Squad', role: 'Retinue', pts: 200, min: 5, max: 5 }),
  unit({ id: 'veterans', name: 'Veteran Tactical Squad', role: 'Elites', pts: 150, min: 5, max: 10, per: 20 }),
  unit({ id: 'sanguinius', name: 'Sanguinius', role: 'Warlord', pts: 450, allegiance: 'Loyalist', factionTrait: 'Blood Angels', modelTags: ['Paragon', 'Unique'] }),
  unit({ id: 'ferrus-manus', name: 'Ferrus Manus', role: 'Warlord', pts: 440, allegiance: 'Loyalist', factionTrait: 'Iron Hands', modelTags: ['Paragon', 'Unique'] }),
  unit({ id: 'warlord-no-paragon', name: 'Warlord-role unit without Paragon (fixture)', role: 'Warlord', pts: 300 }),
  unit({ id: 'fellblade', name: 'Fellblade', role: 'LordOfWar', pts: 450, modelTags: ['Vehicle'] }),
  unit({ id: 'small-low', name: 'Small Lord of War (fixture)', role: 'LordOfWar', pts: 300, modelTags: ['Vehicle'] }),
  // Mechanicum — for Allied tests.
  unit({ id: 'magos', name: 'Magos', role: 'Command', pts: 90, armyList: 'mechanicum' }),
  unit({ id: 'thallax', name: 'Thallax Cohort', role: 'Troops', pts: 120, min: 3, max: 6, per: 40, armyList: 'mechanicum' }),
];

export const CATALOG: Catalog = {
  version: 'fixture-1',
  armyLists: [
    {
      id: 'legiones-astartes',
      name: 'Legiones Astartes',
      factionChoices: LEGIONS,
      requiresRiteOfWarPerFaction: true,
      rites: LEGIONS.map((l) => ({ id: `${l}-rite`, name: `Rite of War: ${l}`, factionTrait: l, source: FX })),
      source: FX,
    },
    { id: 'mechanicum', name: 'Mechanicum', factionChoices: ['Reductor', 'Cybernetica', 'Myrmidax'], requiresRiteOfWarPerFaction: false, rites: [], source: FX },
  ],
  units: UNITS,
  detachments: [...CORE_DETACHMENTS, ...ASTARTES_DETACHMENTS],
  primeAdvantages: [...CORE_PRIME_ADVANTAGES, ...ASTARTES_PRIME_ADVANTAGES],
  missions: CORE_MISSIONS,
  limits: CORE_LIMITS,
};

// ───────────────────────────── roster builders ─────────────────────────────

let seq = 0;
const byId = new Map(UNITS.map((u) => [u.id, u]));

/** A unit instance at minimum size; placeholder Faction defaults to `faction`. */
export function u(unitId: string, opts: { models?: number; faction?: string; options?: [string, number][] } = {}): UnitInstance {
  const def = byId.get(unitId);
  const placeholder = def?.factionTrait === null;
  return {
    id: `u${++seq}`,
    unitId,
    models: opts.models ?? def?.points.minModels ?? 1,
    options: (opts.options ?? []).map(([optionId, count]) => ({ optionId, count })),
    ...(placeholder ? { factionTrait: opts.faction ?? (def?.armyList === 'mechanicum' ? 'Reductor' : 'Blood Angels') } : {}),
  };
}

type FillSpec = UnitInstance | { unit?: UnitInstance; prime?: string };

/** Detachment builder; fill keys are slot suffixes like "Troops1" or extra slot ids. */
export function det(
  id: string,
  defId: string,
  fills: Record<string, FillSpec>,
  more: { list?: string; from?: [string, string]; choice?: string; extra?: ExtraSlot[] } = {},
): DetachmentInstance {
  return {
    id,
    defId,
    armyList: more.list ?? 'legiones-astartes',
    ...(more.from ? { unlockedBy: { detachmentId: more.from[0], slotId: more.from[1] } } : {}),
    ...(more.choice ? { choice: more.choice } : {}),
    extraSlots: more.extra ?? [],
    fills: Object.entries(fills).map(([k, f]) => {
      const slotId = k.includes('.') || k.startsWith('x-') ? k : `${defId}.${k}`;
      return 'unitId' in f ? { slotId, unit: f } : { slotId, ...(f.unit ? { unit: f.unit } : {}), ...(f.prime ? { primeAdvantage: f.prime } : {}) };
    }),
  };
}

/** Slot id helper for unlock links. */
export const slot = (defId: string, suffix: string) => `${defId}.${suffix}`;

export function roster(dets: DetachmentInstance[], more: Partial<Roster> = {}): Roster {
  return {
    name: 'test',
    catalogVersion: CATALOG.version,
    pointsLimit: 3000,
    allegiance: 'Loyalist',
    ritesOfWar: { 'Blood Angels': 'Blood Angels-rite' },
    detachments: dets,
    ...more,
  };
}
