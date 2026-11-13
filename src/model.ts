/**
 * Horus Heresy 3rd edition — army-building rules model.
 *
 * Two halves:
 *   1. Catalog types (`Catalog`, `DetachmentDef`, `UnitDef`, ...) — the *data*. Rules,
 *      points, slot layouts and restrictions all live here, so errata are data edits.
 *   2. Roster types (`Roster`, `DetachmentInstance`, ...) — what the player built.
 *
 * Every catalog entry carries a `source` so the UI and validator can cite where a
 * rule comes from. Anything that is a *new kind* of rule (not a new value) needs a
 * new variant in one of the closed unions below plus a validator branch — that is
 * the honest boundary of "errata are data-only".
 */

// ───────────────────────────── shared vocabulary ─────────────────────────────

/** Age of Darkness Rulebook › Battlefield Roles. 15 roles. */
export const BATTLEFIELD_ROLES = [
  'Warlord',
  'HighCommand',
  'Command',
  'Retinue',
  'Elites',
  'WarEngine',
  'Troops',
  'Support',
  'LordOfWar',
  'Transport',
  'HeavyAssault',
  'HeavyTransport',
  'Armour',
  'Recon',
  'FastAttack',
] as const;
export type BattlefieldRole = (typeof BATTLEFIELD_ROLES)[number];

export type Allegiance = 'Loyalist' | 'Traitor';

/**
 * Detachment kinds named in the Crusade Force Organisation Chart, plus the
 * kind used by faction detachments that *replace* a core one (e.g. Brotherhood of
 * the Phoenix replaces the Warlord Detachment) — those reuse an existing kind and
 * set `exclusiveGroup`.
 */
export type DetachmentKind = 'Primary' | 'Auxiliary' | 'Apex' | 'Allied' | 'LordOfWar' | 'Warlord';

/** Where a rule or datum comes from. `section` is a heading path, not copied text. */
export interface SourceRef {
  book: string; // e.g. "Age of Darkness Rulebook"
  version?: string; // e.g. "1.2"
  section: string; // e.g. "Detachment Types › Allied Detachments"
  faq?: boolean; // true when the source is an official FAQ answer
}

// ─────────────────────────────── catalog: units ──────────────────────────────

/** Model Types and Sub-Types that army building cares about. Open-ended on purpose. */
export type ModelTag =
  | 'Paragon' // Warlord Detachment must contain one
  | 'Unique' // limits Prime Advantages to Special Assignment / Logistical Benefit
  | 'Vehicle'
  | 'Infantry'
  | 'Cavalry'
  | 'Sergeant'
  | 'Command'
  | (string & {});

export interface UnitDef {
  id: string;
  name: string;
  armyList: string; // ArmyListDef.id
  role: BattlefieldRole;
  /** Fixed allegiance, or 'Any' for profiles carrying the "[Allegiance]" placeholder. */
  allegiance: Allegiance | 'Any';
  /** Fixed Faction trait (e.g. "Blood Angels"), or null for a placeholder such as "[Legiones Astartes]". */
  factionTrait: string | null;
  /** Tags present on the unit's models (Unique, Paragon, Vehicle…). */
  modelTags: ModelTag[];
  /** Special rules that matter at list-building time (e.g. "Inductii"). */
  rules?: string[];
  points: {
    base: number; // cost for `minModels`
    minModels: number;
    maxModels: number;
    perExtraModel: number; // cost of each model above minModels
  };
  options: OptionDef[];
  /**
   * HOOK, UNCONFIRMED IN HH3: a unit that is added without using a Force Org slot.
   * The Age of Darkness Rulebook text I read says every selected unit fills a slot;
   * keep false/undefined unless a Liber explicitly says otherwise. See RULES.md › U-1.
   */
  takesNoSlot?: { attachTo: 'detachment'; source: SourceRef };
  source: SourceRef;
}

/** A purchasable wargear/upgrade option. The editor can ship later; validation exists now. */
export interface OptionDef {
  id: string;
  name: string;
  cost: { points: number; per: 'unit' | 'model' };
  /**
   * Upper bound on `count`. 'models' = at most one per model in the unit.
   * A number is an absolute cap per unit.
   */
  max: number | 'models';
  /**
   * Options sharing a group draw from one pool, e.g. "exchange bolter for one of…".
   * The group's combined count may not exceed `groupMax` (default 'models').
   */
  group?: string;
  groupMax?: number | 'models';
  requiresOptions?: string[];
  /** Gate by army allegiance (e.g. Traitor-only upgrades). */
  allegiance?: Allegiance;
  /** Gate by the unit's resolved Faction trait (Legion armouries). */
  factionTraits?: string[];
  /** List-building effects. `setRole` is a HOOK — see RULES.md › U-2. */
  effects?: OptionEffect[];
}

export type OptionEffect =
  | { kind: 'setRole'; role: BattlefieldRole } // HOOK: no confirmed HH3 example found
  | { kind: 'addModelTag'; tag: ModelTag }; // e.g. Word Bearers High Command gaining Psyker

// ───────────────────────────── catalog: detachments ──────────────────────────

/** Narrow which units may fill a slot. All present fields must pass. */
export interface SlotRestriction {
  unitIds?: string[];
  /** Deny-list, e.g. Reaping Host: "Troops Slots … may not be used to select Assault Squad Units". */
  excludeUnitIds?: string[];
  /** Linebreaker Echelon: unit name must contain the word chosen for the detachment. */
  nameContainsDetachmentChoice?: boolean;
  /** Overrides the detachment's army list for this slot (e.g. Daemonic Manifestation). */
  armyList?: string;
  source: SourceRef;
}

export interface SlotDef {
  id: string;
  role: BattlefieldRole;
  prime?: boolean;
  restriction?: SlotRestriction;
}

/**
 * Closed vocabulary of detachment prerequisites. New *kinds* need code; new
 * *instances* (another detachment with a min points limit) are data.
 */
export type DetachmentRequirement =
  | { kind: 'minPointsLimit'; value: number; source: SourceRef }
  | { kind: 'allegiance'; value: Allegiance; source: SourceRef }
  | { kind: 'primaryFaction'; factions: string[]; source: SourceRef }
  | { kind: 'riteOfWar'; rites: string[]; source: SourceRef }
  | { kind: 'armyIncludesUnit'; unitIds: string[]; source: SourceRef }
  | { kind: 'detachmentIncludesUnit'; unitIds: string[]; source: SourceRef }
  | { kind: 'detachmentIncludesModelTag'; tag: ModelTag; source: SourceRef }
  /** "When an X Unit is selected to fill a Command slot, … add one Y instead of the Crusade FOC options." */
  | {
      kind: 'unlockedByUnit';
      unitIds: string[];
      allegiance?: Allegiance;
      source: SourceRef;
    };

/** How a detachment's units' army list is determined. */
export type ArmyListRule =
  | 'primary' // must use the Primary Detachment's army list (Warlord)
  | 'linked' // same army list as the Primary/Allied detachment it is linked to (Apex, Auxiliary)
  | 'differentFaction' // any list, but Faction ≠ Primary (Allied)
  | 'anySingle'; // any list, one list for the whole detachment (Lord of War)

export interface DetachmentDef {
  id: string;
  name: string;
  kind: DetachmentKind;
  slots: SlotDef[];
  armyListRule: ArmyListRule;
  requirements: DetachmentRequirement[];
  /** Detachments sharing a group are mutually exclusive and limited to `max` total. */
  exclusiveGroup?: { id: string; max: number };
  /** Command/High Command slots here can unlock further detachments (false for e.g. Brotherhood of the Phoenix). */
  grantsUnlocks: boolean;
  /** If set, only these Prime Advantages may be chosen in this detachment. */
  allowedPrimeAdvantages?: string[];
  /** A word the player must choose when adding it (Linebreaker Echelon). */
  choice?: { label: string; options: string[] };
  /** Units in this detachment may carry different Faction traits (e.g. Shattered Legions). */
  mixedFactions?: boolean;
  source: SourceRef;
}

// ─────────────────────────── catalog: prime advantages ───────────────────────

export type PrimeEffect =
  /** Logistical Benefit & friends: one extra slot in the detachment. */
  | { kind: 'addSlot'; allowedRoles?: BattlefieldRole[]; excludedRoles?: BattlefieldRole[] }
  /** Special Assignment: a High Command unit may fill this Command slot; slot unlocks nothing. */
  | { kind: 'specialAssignment' }
  /** Pure in-game buff; nothing for the validator to do beyond eligibility. */
  | { kind: 'modelBuff' };

export interface PrimeAdvantageDef {
  id: string;
  name: string;
  /** One-line plain-language summary shown next to the name (paraphrased, not rules text). */
  summary?: string;
  effect: PrimeEffect;
  /** Only selectable for prime slots of these roles. */
  slotRoles?: BattlefieldRole[];
  oncePer?: 'detachment' | 'army';
  /** May a unit containing a Unique model take it? (Core: only Special Assignment & Logistical Benefit.) */
  allowedForUnique: boolean;
  /** Unit eligibility. All present fields must pass. */
  unitRequirement?: {
    unitIds?: string[];
    roles?: BattlefieldRole[];
    factionTraits?: string[];
    armyLists?: string[];
    excludeModelTags?: ModelTag[];
  };
  allegiance?: Allegiance;
  source: SourceRef;
}

// ───────────────────────────── catalog: army lists ───────────────────────────

export interface RiteOfWarDef {
  id: string;
  name: string;
  factionTrait: string;
  source: SourceRef;
}

export interface ArmyListDef {
  id: string;
  name: string;
  /** Faction traits a placeholder ("[Legiones Astartes]") may resolve to. */
  factionChoices: string[];
  /** Liber Astartes: each Faction trait used must pick a Rite of War. */
  requiresRiteOfWarPerFaction: boolean;
  rites: RiteOfWarDef[];
  source: SourceRef;
}

export interface MissionDef {
  id: string;
  name: string;
  requiredPointsLimit?: number;
  source: SourceRef;
}

export interface Catalog {
  /** Bump on every errata import; rosters record which version they were built against. */
  version: string;
  armyLists: ArmyListDef[];
  units: UnitDef[];
  detachments: DetachmentDef[];
  primeAdvantages: PrimeAdvantageDef[];
  missions: MissionDef[];
  limits: {
    /** Fraction of the points limit, rounded up. */
    alliedShare: number; // 0.5
    warlordLordOfWarShare: number; // 0.25
    warlordMinPointsLimit: number; // 3000
    advisedMin: number; // 2000
    advisedMax: number; // 4000
  };
}

// ─────────────────────────────────── roster ──────────────────────────────────

export interface OptionSelection {
  optionId: string;
  count: number;
}

export interface UnitInstance {
  id: string;
  unitId: string;
  models: number;
  options: OptionSelection[];
  /** Required when the profile's factionTrait is a placeholder. */
  factionTrait?: string;
}

export interface SlotFill {
  slotId: string; // SlotDef.id or ExtraSlot.id
  unit?: UnitInstance;
  primeAdvantage?: string; // PrimeAdvantageDef.id
}

/** A slot added by a Prime Advantage (Logistical Benefit etc.). */
export interface ExtraSlot {
  id: string;
  role: BattlefieldRole;
  grantedBy: { slotId: string; primeAdvantageId: string };
}

export interface DetachmentInstance {
  id: string;
  defId: string;
  armyList: string;
  /**
   * Which filled Command/High Command slot made this detachment available.
   * Required for Apex and Auxiliary; absent for Primary, Allied, Lord of War, Warlord.
   * Explicit links let the validator and UI say *why* a detachment exists.
   */
  unlockedBy?: { detachmentId: string; slotId: string };
  /** Value for DetachmentDef.choice (e.g. 'Tartaros'). */
  choice?: string;
  extraSlots: ExtraSlot[];
  fills: SlotFill[];
}

export interface Roster {
  name: string;
  catalogVersion: string;
  pointsLimit: number;
  missionId?: string;
  allegiance: Allegiance;
  /** Rite of War per Faction trait used, keyed by trait. */
  ritesOfWar: Record<string, string>;
  detachments: DetachmentInstance[];
}

// ───────────────────────────────── validation ────────────────────────────────

export interface Issue {
  ruleId: string; // RULES[ruleId]
  message: string; // plain language, names the rule
  at?: { detachmentId?: string; slotId?: string; unitInstanceId?: string };
}

export interface ValidationResult {
  legal: boolean;
  errors: Issue[];
  /** Advisory only (e.g. points limit outside the 2,000–4,000 band). Never affects `legal`. */
  warnings: Issue[];
  /** Totals the UI shows in the points bar. */
  totals: { points: number; allied: number; warlordAndLordOfWar: number };
}
