import type { SourceRef } from './model';

/**
 * Every rule the validator enforces. `status`:
 *   confirmed   – read in the cited source and encoded as written
 *   ambiguous   – source read, but wording allows more than one reading; the chosen
 *                 reading is in `encodedAs`, and the rule is flagged in the UI/docs
 *   unconfirmed – not found in the sources read; encoded only as an optional hook
 *
 * Sources read for this version: Age of Darkness Rulebook v1.2 ("Battles in the Age of
 * Darkness" chapter, as shown on Wahapedia, Oct 2026), the Wahapedia HH3 core FAQ page,
 * and the army-building sections of the Liber Astartes / Liber Hereticus page.
 * Wahapedia is a lookup aid; the printed books and Warhammer Community FAQ/errata win.
 */

export const AOD: SourceRef = { book: 'Age of Darkness Rulebook', version: '1.2', section: '' };
const aod = (section: string): SourceRef => ({ ...AOD, section });
const faq = (section: string): SourceRef => ({ book: 'Age of Darkness Rulebook FAQ', section, faq: true });
const astartes = (section: string): SourceRef => ({ book: 'Liber Astartes / Liber Hereticus', version: '1.1', section });
const lapd = (section: string): SourceRef => ({ book: 'Legiones Astartes Primary Detachments (Warhammer Community)', version: 'Nov 2026', section });
const mech = (section: string): SourceRef => ({ book: 'Liber Mechanicum (via BSData horus-heresy-3rd-edition)', section });

export type RuleStatus = 'confirmed' | 'ambiguous' | 'unconfirmed';

export interface RuleDef {
  id: string;
  title: string;
  source: SourceRef;
  status: RuleStatus;
  /** For ambiguous rules: the reading the validator uses. */
  encodedAs?: string;
}

const r = (id: string, title: string, source: SourceRef, status: RuleStatus = 'confirmed', encodedAs?: string): RuleDef => ({
  id,
  title,
  source,
  status,
  ...(encodedAs ? { encodedAs } : {}),
});

export const RULES = Object.fromEntries(
  [
    // ── Army-wide ───────────────────────────────────────────────────────────
    r('DATA-UNKNOWN', 'The list refers to something that is not in the loaded rules data', { book: 'App', section: 'Catalog integrity' }),
    r('DATA-VERSION', 'The list was built against an older rules/points data version (advisory)', { book: 'App', section: 'Catalog versioning' }),
    r('ARMY-POINTS', 'Total points may not exceed the points limit', aod('Crusade Army Selection › 1. Set Points Limit; 6. Complete Army Roster')),
    r('ARMY-POINTS-BAND', 'Points limits under 2,000 or over 4,000 are outside the intended scope (advisory)', aod('Crusade Army Selection › 1. Set Points Limit')),
    r('ARMY-MISSION-LIMIT', 'Core Missions require a 3,000 point limit', aod('Core Mission Pack › 2. Select Armies')),
    r('ARMY-ONE-PRIMARY', 'An army must include exactly one Primary Detachment', aod('Detachment Types › Primary Detachments')),
    r('ARMY-DETACHMENT-NOT-EMPTY', 'Every detachment must include at least one unit', aod('Crusade Army Selection › 6. Complete Army Roster')),
    r('ARMY-ALLEGIANCE', "Every unit must share the army's Allegiance; '[Allegiance]' units take the army's", aod('Crusade Army Selection › 3. Allegiance')),
    r('ARMY-RITE-OF-WAR', 'Each Legion Faction trait used must have a Rite of War selected', astartes('Building a Space Marine Army › Legions')),
    r('ARMY-RITE-SCOPE', 'Rite-of-War content (incl. Additional Detachments) only from the Rite selected', faq('Rites of War other than the ones selected'), 'ambiguous',
      'A detachment whose requirements name a Rite of War is legal only if that Rite is selected for the Primary Faction. Wahapedia lists Legion Additional Detachments next to, not inside, each Rite; confirm against the printed Liber.'),
    // ── Slots and units ─────────────────────────────────────────────────────
    r('SLOT-ROLE-MATCH', "A unit's Battlefield Role must match the slot it fills", aod('Selecting Units for Detachments')),
    r('SLOT-ONE-UNIT', 'Each slot holds at most one unit', aod('Selecting Units for Detachments')),
    r('SLOT-EXISTS', 'Units can only be placed in slots the detachment actually has', aod('Selecting Units for Detachments')),
    r('SLOT-RESTRICTION', "Some detachments limit which units may fill a slot", astartes('Legiones Astartes Detachment / Auxiliary Detachments')),
    r('SLOT-RESTRICTION-EXTRA', 'Slot restrictions also apply to slots added by Prime Advantages', faq('Logistical Benefit and restricted slots')),
    r('UNIT-ARMY-LIST', "A unit must come from its detachment's army list", aod('Crusade Army Selection › 3. Army List')),
    r('UNIT-MODEL-COUNT', 'Unit size must be within the profile\'s minimum and maximum', aod('Selecting Units for Detachments')),
    r('UNIT-FACTION-TRAIT', "A '[Legiones Astartes]' unit must be given one Legion Faction trait", astartes('Building a Space Marine Army')),
    r('DET-SINGLE-FACTION', 'All units in a detachment must share one Faction trait unless a rule says otherwise', astartes('Building a Space Marine Army')),
    r('UNIT-SUB-FACTION', 'A Mechanicum unit that offers a sub-faction (Cybernetica, Myrmidax…) must take exactly one; fixed ones can\'t change', mech('Mechanicum - Sub-faction')),
    r('DET-SINGLE-SUBFACTION', 'All units in a detachment must share one Mechanicum sub-faction', mech('Mechanicum Traits'), 'ambiguous',
      'Read from BSData\'s "Multiple Mechanicum Traits in Detachment" check, not from the Liber Mechanicum text (not available to check). Units without a sub-faction (none in BSData today) never clash.'),
    r('DET-ARMY-LIST', 'Army-list detachments (e.g. Legiones Astartes Auxiliaries, Mechanicum Apexes) only for their own list', { book: 'Liber Astartes / Liber Mechanicum', section: 'Detachments' }),
    // ── Detachment counts and links ─────────────────────────────────────────
    r('DET-UNLOCK-REQUIRED', 'Apex and Auxiliary detachments must be unlocked by a filled Command or High Command slot', aod('Detachment Types › Adding Detachments to an Army')),
    r('DET-UNLOCK-HC', 'A High Command slot unlocks one Apex OR one Auxiliary detachment, not both', aod('Detachment Types › Apex Detachments')),
    r('DET-UNLOCK-CMD', 'A Command slot unlocks one Auxiliary detachment, not an Apex (unless its unit has Consul-Delegatus)', aod('Detachment Types › Primary Detachments; Special Rules › Consul-Delegatus')),
    r('DET-UNLOCK-ONE', 'Each Command/High Command slot unlocks one detachment (Officer of the Line (X) in a Command slot: X Auxiliaries; Tank Commander (X): X Armour-only Auxiliaries)', aod('Detachment Types › Primary Detachments; Special Rules › Officer of the Line (X), Tank Commander (X)')),
    r('ARMY-CONSUL-ONE', 'An army may include only one model with Consul-Delegatus (which lets a Command slot unlock an Apex)', aod('Special Rules › Consul-Delegatus')),
    r('DET-MAX-ONCE', 'This detachment may be taken only once per army', aod('Special Rules › Tip of the Spear')),
    // ── Legiones Astartes Primary Detachments (Warhammer Community, Nov 2026) ──
    r('PRIMARY-ALLOWED-DETACHMENTS', 'An alternative Primary Detachment allows only certain other detachments', lapd('Restrictions')),
    r('PRIMARY-NO-SLOT-PRIMES', 'With most alternative Primary Detachments, Prime Advantages that add slots may not be taken', lapd('Restrictions'), 'ambiguous',
      'Applied to every detachment in the army, since the restriction is listed with the army-wide ones; it could be read as the Primary Detachment only.'),
    r('PRIMARY-UNIT-LIMITS', 'An alternative Primary Detachment limits which units the army may include', lapd('Restrictions')),
    r('PRIMARY-EXTRA-SLOTS', 'Extra slots from a Primary Detachment benefit are limited by what the army includes', lapd('Benefits')),
    r('PRIMARY-SLOT-EXCHANGE', 'Slot exchanges (Sky-Hunter Phalanx: White Scars) only as the detachment offers, and only for its Faction', lapd('Sky-Hunter Phalanx › Benefits'), 'ambiguous',
      'An exchanged slot is treated as a plain (non-Prime) slot: the text says the slot is exchanged "for one Elites Slot" without mentioning Prime.'),
    r('PRIMARY-DEPLOYMENT', 'Some units in this army can\'t deploy with its Primary Detachment (advisory)', lapd('Sky-Hunter Phalanx')),
    r('DET-UNLOCK-SOURCE', 'Only Primary, Apex and Allied detachments can unlock further detachments', aod('Detachment Types › Primary / Apex / Allied Detachments'), 'ambiguous',
      'The FOC summary says slots filled "in any Detachment" count, but the per-type text only grants unlocks to Primary, Apex and Allied. No core Auxiliary has Command slots, so this only matters for future detachments.'),
    r('DET-UNLOCK-ALLIED', 'An Allied detachment can only unlock Auxiliary detachments, linked to that Allied detachment', aod('Detachment Types › Allied Detachments')),
    r('DET-UNLOCK-CYCLE', 'Unlock chains must lead back to the Primary or an Allied detachment (no loops)', aod('Detachment Types › Apex Detachments'), 'ambiguous',
      'Implied by "linked to the Primary Detachment"; not stated as a rule.'),
    r('DET-UNLOCK-SPECIFIC', 'Some detachments are unlocked only by a specific unit in the Command slot, replacing the normal choice', astartes('Legiones Astartes Auxiliary Detachments')),
    r('DET-LINKED-LIST', 'Apex/Auxiliary detachments use the army list of the detachment they are linked to', aod('Detachment Types › Primary Detachments')),
    r('DET-MAX-LOW', 'At most one Lord of War Detachment', aod('Detachment Types › Lord of War Detachments')),
    r('DET-MAX-WARLORD', 'At most one Warlord Detachment (or a detachment that replaces it)', aod('Detachment Types › Warlord Detachments')),
    r('DET-REQUIREMENT', 'This detachment has a prerequisite that is not met', astartes('Additional Detachments (per Legion)')),
    r('DET-LOW-SINGLE-LIST', 'All units in a Lord of War Detachment come from one army list', aod('Detachment Types › Lord of War Detachments'), 'ambiguous',
      'Text says "same Army List or Faction". Encoded as same army list; a same-Faction-different-list case is flagged rather than guessed.'),
    // ── Allied ──────────────────────────────────────────────────────────────
    r('ALLIED-FACTION', 'Allied units must be a different Faction from the Primary Detachment', aod('Detachment Types › Allied Detachments')),
    r('ALLIED-FACTION-TRAITS', "Allied units may not share any Faction trait present in the Primary Detachment", faq('Mechanicum Faction trait variants in Allied Detachments')),
    r('ALLIED-CAP', 'Allied detachments (and their linked detachments) may total at most 50% of the limit, rounded up', aod('Detachment Types › Allied Detachments')),
    // ── Warlord / Lord of War ───────────────────────────────────────────────
    r('WARLORD-MIN-LIMIT', 'Warlord Detachments and Warlord units need a points limit of 3,000 or more', aod('Warlords and Lords of War')),
    r('WARLORD-SAME-LIST', 'A Warlord Detachment uses the Primary Detachment\'s army list and Faction', aod('Detachment Types › Warlord Detachments')),
    r('WARLORD-PARAGON', 'A Warlord Detachment must include at least one Paragon model', aod('Detachment Types › Warlord Detachments')),
    r('LOW-CAP', 'Warlord and Lord of War units share one 25% allowance, rounded up', aod('Warlords and Lords of War'), 'ambiguous',
      'Sources differ on what counts and on ≤ vs <. Project decision (matches BSData): every unit with the Warlord or Lord of War Battlefield Role counts, and the total must be ≤ ceil(25% × limit). Retinue/Heavy Transport units in a Warlord Detachment do not count. BSData rounds the cap down; the rulebook says round up, so we round up.'),
    // ── Prime slots ─────────────────────────────────────────────────────────
    r('PRIME-ONLY-ON-PRIME', 'Prime Advantages can only be chosen for filled Prime slots', aod('Prime Slots')),
    r('PRIME-UNIQUE', 'A unit with a Unique model in a Prime slot may only take Special Assignment or Logistical Benefit', aod('Prime Slots')),
    r('PRIME-ONCE', 'This Prime Advantage is limited to once per detachment or army', aod('Prime Slots › Core Prime Traits')),
    r('PRIME-SLOT-ROLE', 'This Prime Advantage can only be chosen for certain slot roles', aod('Prime Slots › Special Assignment')),
    r('PRIME-ELIGIBILITY', 'The unit in this Prime slot does not meet the Prime Advantage\'s requirements', astartes('Additional Prime Advantages')),
    r('PRIME-DET-ALLOWED', 'This detachment only allows specific Prime Advantages', astartes('Additional Detachments (Atramentar Hunt, Exalted Conclave)')),
    r('PRIME-BARRED-UNIT', 'Units with the Inductii rule may never take a Prime Advantage', astartes('Legacies: The Legiones Inductii')),
    r('PRIME-EXTRA-SLOT', 'Extra slots must come from a Prime Advantage that grants them, with an allowed role', aod('Prime Slots › Logistical Benefit')),
    r('PRIME-SPECIAL-ASSIGNMENT', 'Special Assignment: a High Command unit may fill this Command slot, but the slot unlocks no detachments', aod('Prime Slots › Special Assignment')),
    // ── Wargear ─────────────────────────────────────────────────────────────
    r('OPT-EXISTS', 'Options must be ones this unit profile offers', aod('Selecting Units for Detachments')),
    r('OPT-MAX', 'Option taken more times than allowed', aod('Selecting Units for Detachments')),
    r('OPT-GROUP', 'Exchange options drawing on the same item exceed the models available', aod('Selecting Units for Detachments')),
    r('OPT-REQUIRES', 'Option requires another option', aod('Selecting Units for Detachments')),
    r('OPT-GATED', 'Option restricted by Allegiance or Faction (e.g. a Legion armoury)', astartes('Armoury of the <Legion>')),
    r('OPT-DECURION-ONE', 'No unit may have more than one Legiones Decurion upgrade', astartes('Legiones Decurion')),
    // ── Hooks (not found in sources read) ───────────────────────────────────
    r('HOOK-NO-SLOT', 'Unit added without using a slot', aod('(not found)'), 'unconfirmed'),
    r('HOOK-ROLE-CHANGE', 'Option changes a unit\'s Battlefield Role', aod('(not found)'), 'unconfirmed'),
  ].map((x) => [x.id, x]),
) as Record<string, RuleDef>;

export function rule(id: string): RuleDef {
  const def = RULES[id];
  if (!def) throw new Error(`Unknown rule id ${id}`);
  return def;
}
