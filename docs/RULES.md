# Encoded rules

Source of truth for IDs is [`src/rules.ts`](../src/rules.ts); this page explains them.

**What I read (13 Nov 2026):** the Wahapedia page *Battles in the Age of Darkness* (says it's the Age of Darkness Rulebook v1.2, Oct 2026), the Wahapedia HH3 FAQ page, and only the army-building sections of the Wahapedia Legiones Astartes page (Liber Astartes / Hereticus v1.1). I took the detachment slot layouts from the page's HTML chart. Every slot has a "X Slot" / "X Prime Slot" tooltip. I did **not** read the printed books, any Warhammer Community PDF, other factions' army lists, or any unit datasheets.

Status key: ✅ confirmed as written · ⚠️ ambiguous (reading chosen, flagged) · ❓ not found (hook only)

## Army-wide

| ID | Rule | Source section | Status |
|---|---|---|---|
| ARMY-POINTS | Total ≤ points limit | Crusade Army Selection › 1 & 6 | ✅ |
| ARMY-POINTS-BAND | <2,000 or >4,000 is "outside intended scope". This is a **warning**, not an error | Crusade Army Selection › 1 | ✅ |
| ARMY-MISSION-LIMIT | Core Missions use 3,000 pts | Core Mission Pack › 2. Select Armies | ✅ |
| ARMY-ONE-PRIMARY | Exactly one Primary Detachment | Detachment Types › Primary | ✅ |
| ARMY-DETACHMENT-NOT-EMPTY | Every detachment has ≥1 unit | Crusade Army Selection › 6 | ✅ |
| ARMY-ALLEGIANCE | Units match army Allegiance; `[Allegiance]` units take it | Crusade Army Selection › 3 | ✅ |
| ARMY-RITE-OF-WAR | Each Legion Faction trait used picks a Rite of War | Liber Astartes › Building a Space Marine Army | ✅ |
| ARMY-RITE-SCOPE | Additional Detachments only from the selected Rite | FAQ (Rites of War) | ⚠️ |

## Slots & units

| ID | Rule | Source | Status |
|---|---|---|---|
| SLOT-ROLE-MATCH | Unit role = slot role | Selecting Units for Detachments | ✅ |
| SLOT-ONE-UNIT / SLOT-EXISTS | One unit per slot; only existing slots | Selecting Units for Detachments | ✅ |
| SLOT-RESTRICTION | Detachment-specific "only X units" slots, Linebreaker word choice | Liber Astartes detachments | ✅ |
| SLOT-RESTRICTION-EXTRA | Restrictions also bind slots added by Logistical Benefit | FAQ | ✅ |
| UNIT-ARMY-LIST | Unit's list = detachment's list (or slot override, e.g. Daemonic Manifestation) | Crusade Army Selection › 3 | ✅ |
| UNIT-MODEL-COUNT | Size within profile min/max | Selecting Units | ✅ |
| UNIT-FACTION-TRAIT | `[Legiones Astartes]` → choose one Legion; fixed traits can't change | Liber Astartes | ✅ |
| DET-SINGLE-FACTION | One Faction trait per detachment unless a rule says otherwise | Liber Astartes | ✅ |
| UNIT-SUB-FACTION | Mechanicum units that offer a sub-faction (Archimandrite, Cybernetica, Lacrymaerta, Macrotek, Malagra, Myrmidax, Reductor) must take one; fixed ones (Castellax: Cybernetica) can't change | BSData "Mechanicum - Sub-faction" (min 1, max 1) | ✅ |
| DET-SINGLE-SUBFACTION | One Mechanicum sub-faction per detachment | BSData "Multiple Mechanicum Traits in Detachment" | ⚠️ |

## Detachments and unlocking

| ID | Rule | Source | Status |
|---|---|---|---|
| DET-UNLOCK-REQUIRED | Apex/Aux need a *filled* Command/HC slot | Adding Detachments to an Army | ✅ |
| DET-UNLOCK-HC | HC slot → one Apex **or** one Aux | Apex Detachments | ✅ |
| DET-UNLOCK-CMD | Command slot → one Aux, never Apex | Primary Detachments | ✅ |
| DET-UNLOCK-ONE | One detachment per slot, except **Officer of the Line (X)**: a unit with it in a Command slot unlocks X Auxiliaries (Centurions: 2) | Primary Detachments; Special Rules › Officer of the Line (X) | ✅ |
| DET-UNLOCK-SOURCE | Only Primary, Apex, Allied slots unlock | Primary/Apex/Allied | ⚠️ |
| DET-UNLOCK-ALLIED | Allied unlocks Aux only, linked to the Allied | Allied Detachments | ✅ |
| DET-UNLOCK-CYCLE | Unlock chain must reach Primary/Allied | Apex Detachments (implied) | ⚠️ |
| DET-UNLOCK-SPECIFIC | "When an X fills a Command slot… add Y *instead of* the FOC options" | Liber Astartes Aux Detachments | ✅ |
| DET-LINKED-LIST | Apex/Aux use the linked detachment's army list | Primary Detachments | ✅ |
| DET-ARMY-LIST | A list's own detachments only for that list: Legiones Astartes Auxiliaries (Techmarine Covenant…) aren't for Mechanicum, Mechanicum Apexes aren't for Legions | Liber Astartes; BSData force entries ("Mechanicum only") | ✅ |
| DET-MAX-LOW | ≤1 Lord of War Detachment | Lord of War Detachments | ✅ |
| DET-MAX-WARLORD | ≤1 Warlord Detachment or replacement (Brotherhood of the Phoenix) | Warlord Detachments; EC Additional Detachment | ✅ |
| DET-REQUIREMENT | Data-driven prereqs: min points, allegiance, Primary Faction, "army includes X", "detachment includes X" | Per-Legion Additional Detachments | ✅ |
| DET-LOW-SINGLE-LIST | LoW Detachment units from one list | Lord of War Detachments | ⚠️ |

## Allied, Warlord, Lord of War

| ID | Rule | Source | Status |
|---|---|---|---|
| ALLIED-FACTION | Allied ≠ Primary Faction | Allied Detachments | ✅ |
| ALLIED-FACTION-TRAITS | Allied shares *no* Faction trait with Primary (Mechanicum variants) | FAQ | ✅ |
| ALLIED-CAP | Allied + their linked detachments ≤ ceil(50%) | Allied Detachments + FAQ | ✅ |
| WARLORD-MIN-LIMIT | Warlord Detachment / Warlord units need ≥3,000 | Warlord Detachments; Warlords and Lords of War | ✅ |
| WARLORD-SAME-LIST | Warlord Detachment = Primary list & Faction | Warlord Detachments | ✅ |
| WARLORD-PARAGON | Warlord Detachment includes a Paragon | Warlord Detachments | ✅ |
| LOW-CAP | Shared 25% allowance, rounded up | Warlords and Lords of War | ⚠️ |

## Prime slots

| ID | Rule | Source | Status |
|---|---|---|---|
| PRIME-ONLY-ON-PRIME | Advantages only on filled Prime slots, one each | Prime Slots | ✅ |
| PRIME-UNIQUE | Unique → only Special Assignment / Logistical Benefit | Prime Slots | ✅ |
| PRIME-ONCE | Master Sergeant & Logistical Benefit once per detachment; some Legion ones once per army | Core Prime Traits; Legion Primes | ✅ |
| PRIME-SLOT-ROLE | Special Assignment on Command slots only | Core Prime Traits | ✅ |
| PRIME-SPECIAL-ASSIGNMENT | HC unit may fill that Command slot; slot unlocks nothing | Core Prime Traits | ✅ |
| PRIME-EXTRA-SLOT | Added slot can't be HC/Command/Warlord/LoW (or Legion-specific roles) | Logistical Benefit; Legion Primes | ✅ |
| PRIME-ELIGIBILITY | Legion Prime requirements (role, Faction, list, no Vehicles…) | Liber Astartes | ✅ |
| PRIME-DET-ALLOWED | Detachment limits Advantages (Atramentar Hunt, Exalted Conclave) | Liber Astartes | ✅ |
| PRIME-BARRED-UNIT | Inductii never take Prime Advantages | Legacies: Inductii | ✅ |

## Wargear (validated now; editor later)

| ID | Rule | Status |
|---|---|---|
| OPT-EXISTS, OPT-MAX, OPT-GROUP, OPT-REQUIRES | Options belong to the profile; per-unit/per-model caps; exchanges share a pool | ✅ general shape. Datasheet wording varies, so check each profile as it's entered |
| OPT-GATED | Allegiance- or Legion-armoury-only options | ✅ |
| OPT-DECURION-ONE | ≤1 Legiones Decurion per unit | ✅ |

## Project decisions (13 Nov 2026)

- **LOW-CAP:** every unit with the Warlord or Lord of War *role* counts, total ≤ ceil(25%). This matches BSData's "Warlord or Lord of War" category, except BSData rounds down.
- **Apothecarion Delegation / Techmarine Covenant:** chosen with any open Command/High Command unlock (BSData agrees: it only requires a Legion Primary). Other specific-unit Auxiliaries (Recon Demi-Company → Vigilator, Dreadnought Talon → Mortificator, …) keep their unit requirement. BSData confirms both of those.
- **Retinues don't need a commander.** Neither source has such a rule.
- **Legions may ally other Legions** of the same Allegiance.
- **Death Guard:** Reaping Host (Troops Prime, Troops, Support, Heavy Assault; no Assault Squads in Troops; Death Guard Primary only). Unnatural Resilience is once per army, for a Death Guard Centurion or "Cataphractii Centurion" (mapped to Centurion in Terminator Armour, **confirm**).

## Legiones Astartes Primary Detachments (23 Nov 2026)

From the Warhammer Community PDF "Legiones Astartes Primary Detachments" (Nov 2026): a Legiones Astartes army may use one of these instead of the Crusade Primary Detachment. Slot layouts were read from its charts (role icons matched against the role icon set); restrictions are paraphrased into `PrimaryRules` in `src/core-data.ts`, and `test/astartes-primary.test.ts` covers each.

| Primary Detachment | Slots (★ Prime) | Enforced |
|---|---|---|
| Pride of the Legion | HC; ★Command, Command, Retinue ×3; ★Heavy Assault + 4; ★Elites + 4 | Army needs a Master of the Legion; other detachments only Officer Cadre, Shock Assault, Heavy Support, Warlord, Lord of War (Transport units only); no slot-adding Primes; +1 Heavy Transport slot per filled Retinue/Heavy Assault/Elites slot |
| Fury of the Ancients | HC, Retinue; ★Command, Command; ★War-engine + 4; ★War-engine + 4 | Command/Specialist units need Battlesmith; slot-adding Primes only for War-engine slots; other detachments only Techmarine Covenant, Heavy Support, Lord of War (Transport units only); Ancient of War Prime (Walkers) |
| Sky-Hunter Phalanx | HC; ★Command, Command, Retinue ×2; ★Fast Attack + 4; ★Fast Attack + 4 | Other detachments only First Strike, Combat Pioneer, Lord of War; no slot-adding Primes; Skilled Riders Prime; non-Antigrav/Flyer units get a **warning** (they're removed unless carried by a Flyer) |
| Armoured Spearhead | HC; Command ×3, Transport; Armour ×10 (no Prime slots) | Non-Vehicles need Battlesmith; no Move 0/"-" units; Decurion Magna tanks may fill HC, other Decurion tanks Command (the builder adds the upgrade when you place one); other detachments only Armoured Support, Combat Pioneer, First Strike, Techmarine Covenant, Armoured Fist, Lord of War; no slot-adding Primes |
| Orbital Drop Assault | HC; ★Command, Command, Retinue; ★Heavy Assault, Heavy Assault, ★Troops, Troops; ★Elites, Elites, Transport ×2 | Other detachments only Tactical Support, First Strike (max 1), Shock Assault, Heavy Support, Warlord, Lord of War; no slot-adding Primes; +1 Transport or Heavy Transport slot per non-Vehicle unit in the army |

**Sky-Hunter Phalanx, White Scars:** any Retinue slot can be exchanged for an Elites slot (Golden Keshig only) and any Fast Attack slot for a Support slot (Kyzagan Assault Speeder only), from the unit picker. An exchanged slot is treated as plain, not Prime, since the text doesn't say it keeps Prime status. ⚠️

**Ambiguous:** "Prime Advantages which add additional Battlefield Role Slots to a Detachment may not be selected" is applied to every detachment in the army (it's listed with the army-wide restrictions). ⚠️

**Not enforced (in-game, not list-building):** Victory Points for destroyed Elites/Heavy Assault (Pride) or War-engine (Fury) units; Pride's Vanguard (X) → Line (1) swap; Squadron Tactics (Armoured Spearhead); Orbital Drop Protocols and the Orbital Drop Table. **Not done:** Ancient of War's "not Malefic" condition (Malefic isn't imported as a model type).

## Legion Additional Detachments (14 Nov 2026)

Every Legion now has its Additional Detachments: "An Army that has a Primary Detachment with the <Legion> Faction may select the following … Detachments using the standard Rules". Layouts and slot restrictions were read from each Legion's Wahapedia page (the chart markup) and compared with BSData's force entries; `test/legion-detachments.test.ts` checks all 28 layouts and builds each detachment for its own Legion (legal) and another (refused).

| Legion | Detachments |
|---|---|
| Dark Angels | Ironwing Gauntlet, Dreadwing Cadre, Stormwing Muster, Deathwing Conclave, Ravenwing Lance, Firewing Echelon |
| Emperor's Children | Primacy Wing, Brotherhood of the Phoenix |
| Iron Warriors | The Ironfire Cohort, The Hammer of Olympia (Apex; army must include a Warsmith or Perturabo) |
| White Scars | Chogorian Warband |
| Space Wolves | Bloodied Claw |
| Imperial Fists | Siege Gauntlet |
| Night Lords | Terror Assault, Atramentar Hunt (Apex; only the Atramentar Prime Advantage, now added) |
| Blood Angels | Revelation Host |
| Iron Hands | Spearhead Phalanx, Medusan Vanguard |
| World Eaters | Berserker Cadre, Sons of Bodt |
| Ultramarines | Primus Demi-company |
| Death Guard | Reaping Host |
| Thousand Sons | Prosperine Convocation |
| Sons of Horus | Supremacy Cadre |
| Word Bearers | Exalted Conclave |
| Salamanders | Immolation Covenant |
| Raven Guard | Decapitation Cadre |
| Alpha Legion | Headhunter Leviathal |

**Where the sources differ (Wahapedia used):**
- **Primus Demi-company:** Wahapedia says Apex, BSData says Auxiliary. Encoded as Apex, so it needs a High Command slot. ⚠️ Check the printed Liber.
- **Primacy Wing** and **Atramentar Hunt:** BSData's composition text says "Recon", but its own slot list and Wahapedia both say Retinue. Encoded as Retinue.

**Other Legion Prime Advantages** besides Atramentar, True Believers, Unnatural Resilience and the Iron Hands one aren't entered yet.

### Rules that change unlocking (BSData Special Rules, 14 Nov 2026)

A sweep of every BSData force entry and every special rule that mentions selecting detachments found these:

| Rule | Units | Effect | Status |
|---|---|---|---|
| Tip of the Spear | Master of Descent | Primary includes one → **Planetfall Speartip** once per army (Retinue: Praetorian Command Squad with Jump Packs; ★Elites ×2: Veteran Assault Squads) | ✅ added |
| Consul-Delegatus | Delegatus, Mounted Delegatus, Autilon Skorr | In a Command slot, may unlock one Apex instead of the Auxiliary; one per army | ✅ added |
| Tank Commander (X) | Spartan Prometheus Command Tank (2) | In a (High) Command slot, unlocks X Auxiliaries that have only Armour slots (e.g. Armoured Support) | ✅ added. BSData's separate "Tank Commander Armoured Support" (4 Armour) is the same layout as Armoured Support, so it isn't a separate entry. |
| Harbinger of Chaos | Erebus | Primary includes him → Daemonic Manifestation without an Esoterist | Not added: Daemonic Manifestation's slots need the Daemons list, which isn't imported |

**Seen but out of scope:** Leviathan Armoured Fist / Bastion of Fire and Armoured Command Squadron (only in Leviathan / Armoured Spearhead missions); Ætheric Incursion (Traitor Thousand Sons, Daemons of Tzeentch list); Zone Mortalis Primaries and Cohorts Vagus (other game modes); Solar Auxilia, Imperialis Militia and Legio Custodes detachments (army lists not imported); Blackshields Oaths of Moment.

**Mechanicum, added the same day:** Taghmata Cohort (4 Support) and Apprentice Cadre (★Troops, Troops ×3) Auxiliaries; The Heart of Power (Archimandrite Archmagos: ★Retinue, Retinue ×2, ★Troops ×3) and Iron Phalanx (Macrotek Archmagos: ★Armour ×3, ★Heavy Transport ×3) Apexes. From BSData only. Their "all Troops must take Combat Veterans" / "all must take Prime Conveyor" conditions aren't enforced; Prime Conveyor isn't in the data.

## Mechanicum (14 Nov 2026)

Read from BSData `Mechanicum.json` and the game system's force entries. Wahapedia's Mechanicum page returned 404, so **none of this is checked against the Liber Mechanicum text**, and the 39 units' points aren't cross-checked either.

- **Army list:** its own list (`mechanicum`), Faction "Mechanicum", no Rite of War. Usable as the Primary or as an Allied detachment of a Legion army (and the reverse).
- **Sub-factions** are chosen per unit, but a detachment has one, so the builder sets every unit in the detachment that can take it when you change one.
- **Apex detachments**, each unlocked by an Archmagos (or Archmagos on Abeyant) of one sub-faction in a High Command slot:

  | Apex | Sub-faction | Slots | Restriction |
  |---|---|---|---|
  | Command Maniple | Cybernetica | ★Elites, ★Support, ★War-engine | Automata only |
  | The Panoply of Cruelty | Lacrymaerta | ★Heavy Assault ×3 | Ursarax Cohort only |
  | The Host of Destruction | Myrmidax | ★Elites, Elites ×3 | Myrmidax units only |
  | Crux of Judgement | Malagra | Command ×3 | Arcuitor Magisterium only; its Command slots unlock nothing |
  | Thallax Command Cohort | Reductor | ★Support ×3 | Thallax Cohort only |

- **Not checked:** Crux of Judgement's Arcuitors "must form a single Unit"; Thallax Command Cohort "must include a Praetorian" (unit make-up isn't modelled); "Mechanicum Logistical Benefit" and any other Mechanicum Prime Advantages; Cybertheurgic Rites / Arcana limits beyond BSData's group caps; Carnage and Pandemonium (an Army Configuration, skipped by the importer); Cults Abominatio and Divisio Assassinorum entries linked from the catalogue.
- **Unlock reading:** BSData's condition is "the roster has an Archmagos with Cybernetica"; I require that Archmagos to be the High Command unit unlocking the Apex, which is the core Apex rule. ⚠️

## Ambiguities: the reading I chose

1. **LOW-CAP: what counts, and ≤ or <.** The Lord of War Detachment section counts the *whole LoW Detachment* plus Warlord-role units. The Warlord Detachment section counts *Warlord-role units* plus LoW-role units elsewhere. The summary box says all Warlord or LoW **role** units. One sentence about armies under 3,000 points says "less than 25%"; everywhere else it's "no more than". **Encoded:** LoW Detachment units + Warlord/LoW-role units anywhere, ≤ ceil(25%). Retinue and Heavy Transport units in a Warlord Detachment are **not** counted.
2. **LoW Detachment "same Army List or Faction".** Encoded as one army list.
3. **Which detachments' slots unlock others.** The FOC summary says Command/HC slots filled "in any Detachment" count. The per-type rules only give unlocks to Primary, Apex and Allied. No core Auxiliary has Command slots, so this only matters for future detachments.
4. **Apothecarion Delegation / Techmarine Covenant unlock condition.** Wahapedia shows each one's slot restriction but no "When an X Unit is selected…" sentence, unlike the other Legion Auxiliaries. Encoded as a normal Auxiliary. **Check the printed Liber.**
5. **Rites of War vs Additional Detachments.** Wahapedia shows Legion Additional Detachments gated by *Primary Faction*. The FAQ says Additional Detachments can't be used "from Rites of War other than the ones selected". The data model supports both gates (`primaryFaction`, `riteOfWar`). The sample data uses only `primaryFaction`.
6. **Allied Faction for Legions.** Encoded as: Faction = Legion trait, so a Blood Angels Primary may ally Dark Angels. That follows from "Faction is determined by the Army List… and Legion Rules", but I haven't seen it confirmed in an FAQ.
7. **Unlock loops** aren't addressed in the text. I reject them because Apex/Aux must be "linked to the Primary Detachment".
8. ~~Slot layouts inferred from HTML order.~~ **Resolved 13 Nov 2026:** each Legiones Astartes detachment's name appears inside its own chart box on Wahapedia, and all nine layouts are checked in `test/astartes-detachments.test.ts`.
9. **Master Sergeant / Paragon of Battle** need a Sergeant / Command sub-type model to *do* anything. I don't make picking one illegal on a unit without such a model. Unclear.

## Not found (hooks only, unconfirmed)

- **U-1 Units that don't take a slot.** HH3 says "each Unit selected as part of a Detachment will fill a Force Organisation Slot". The designer's note says Dedicated Transports and Retinues-as-part-of-the-commander's-choice are gone. I found **no** HH3 slot-free unit. `UnitDef.takesNoSlot` exists but the validator doesn't honour it yet (on purpose).
- **U-2 Options that change a unit's role.** Not found in what I read. The closest things are Prime Advantages that *add slots* (Iron Hands, Ultramarines, Alpha Legion, Shattered Legions) and Special Assignment (a role exception on a *slot*, not a unit). `OptionEffect.setRole` exists and is honoured.
- **U-3 Retinue units needing a commander.** No list-building rule found that ties a Retinue to an HC/Command unit (it may be a deployment/joining rule in the Libers). Not enforced.
- ~~**U-4** Apothecarion Delegation / Techmarine Covenant unlocks.~~ Resolved: Wahapedia gives no specific unit and BSData only requires a Legion Primary, so both are taken with any Command/High Command unlock.
- Legion-specific exceptions I didn't model in sample data: Shattered Legions mixed Factions (`mixedFactions` flag exists), Blackshields, Knights-Errant, Legiones Inductii details beyond "no Primes", Corrupted Legions beyond True Believers, Daemonic Manifestation's cross-list slot (supported by `SlotRestriction.armyList`).
