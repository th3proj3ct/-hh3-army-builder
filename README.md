# HH3 army builder: rules core (pre-UI)

A pure TypeScript rules model and validator for Horus Heresy 3rd edition army building. It comes with golden tests, property tests and an errata drill. No UI yet.

```
npm install
npm test         # 67 tests: golden lists, fast-check points properties, errata drill
npm run typecheck
```

| File | What |
|---|---|
| [src/model.ts](src/model.ts) | Type model: catalog (detachments, slots, units, wargear, Prime Advantages, army lists) and roster |
| [src/rules.ts](src/rules.ts) | Every enforced rule: ID, title, source section, status (confirmed / ambiguous / unconfirmed) |
| [src/core-data.ts](src/core-data.ts) | Core FOC slot layouts, Prime Advantages, caps, plus sample Legion detachments |
| [src/validate.ts](src/validate.ts) | `validate(roster, catalog) → { legal, errors, warnings, totals }` |
| [src/explain.ts](src/explain.ts) | `explainChange()`: the reason for every locked slot/unit, taken from the validator |
| [src/errata.ts](src/errata.ts) | Errata as JSON patches |
| [docs/RULES.md](docs/RULES.md) | Rule list with sources, ambiguities, unconfirmed items |
| [docs/UI-SPEC.md](docs/UI-SPEC.md) | UI spec built around explanation |
| [docs/TEST-PLAN.md](docs/TEST-PLAN.md) | Outside checks, think-aloud study, errata drill |

## UI (first cut)

```
npm run dev      # http://localhost:5178
```

It opens on the legal 3,000 pt Death Guard sample. "New list" starts empty, and "Death Guard sample" reloads the sample.

- Click a slot to fill it. Units you can't take stay in the list, each with the reason. Other Legions' units are tucked under a fold.
- Filled Command and High Command slots show "+ Unlock a detachment". The picker lists every Apex and Auxiliary detachment, with a reason on each locked one.
- Unlocked detachments are drawn nested under the slot that unlocked them.
- The points bar is sticky. It shows total, Allied and Warlord + Lord of War meters, plus a problems list with "Show me" links.
- Prime Advantage picker. Each option has a one-line summary, and a "What do the Prime Advantages do?" list. Logistical Benefit adds an extra slot whose role you choose.
- The unlock picker shows example units for each slot role, inline and on hover. "What fits these slots?" lists every eligible unit, with its datasheet.
- **Datasheets** (eye icon) on filled slots, picker rows, "what fits" lists and the reference view. They show model stats, default wargear, weapon profiles, special rules with one-line summaries, options taken, and every detachment the unit fits. They're imported from BSData into `data/bsdata/datasheets.json` and loaded on first use.
- **Unit reference** tab. Every unit is grouped by role (High Command, Command, Troops, …) in collapsible sections, with a search box and a Legion filter. Each row lists the detachments it can go in, including Special Assignment and "Death Guard only" style limits.
- Model count stepper and a basic wargear editor using the imported options.
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z) and Export JSON. The list is remembered in localStorage.
- On phones the details panel is a bottom sheet.

- **Role icons:** the app draws its own icon for each Battlefield Role. To use your own images instead, put them in `ui/role-icons/` (see the README there for file names).

Every lock reason comes from `explainChange()`, so the UI has no rules logic of its own. Code is in `ui/src/`.

## Real data (BSData import)

Unit profiles and points come from the [BSData Horus Heresy 3rd edition repo](https://github.com/BSData/horus-heresy-3rd-edition) (NewRecruit JSON). Rules stay hand-entered in `src/core-data.ts`; only units are imported.

```
npm run import:bsdata -- "C:/Users/jesse/Documents/repos/horus-heresy-3rd-edition"
```

- Output: `data/bsdata/units.json` (stamped with the BSData commit, which becomes `CATALOG.version`), plus [`data/bsdata/IMPORT-REPORT.md`](data/bsdata/IMPORT-REPORT.md) listing every approximation.
- Imported now (372 units): the generic Legiones Astartes units, all 18 Legions' own units and armouries, and the Mechanicum list (39 units, its own army list with sub-factions and five Apex detachments; see [docs/RULES.md](docs/RULES.md#mechanicum-14-nov-2026)). Pass catalogue file names to import a subset.
- Units that several catalogues define separately get the Faction in their id (every Legion's `inductii-squad-<legion>`); saved lists using an old id are migrated on load.
- `test/points-crosscheck.test.ts` checks 26 units against Wahapedia (14 on 13 Nov 2026, plus 12 Legion-specific units on 14 Nov; all matched), so BSData isn't checking itself.
- `test/death-guard.test.ts`: 2 legal and 11 illegal Death Guard lists on real points.

**Legion armoury:** BSData hides armoury items by default and reveals them with conditions like "force is the XIV - Death Guard catalogue". The importer evaluates those conditions once per Legion. Each item is imported with `factionTraits` set to the Legions that see it, and the validator enforces that (`OPT-GATED`). Conditions it can't evaluate count as "not met" (Blackshields, Shattered Legions, upgrade-dependent ones), so nothing leaks through. Only Legions whose catalogue is being imported get their armoury, so today that's Death Guard: power scythes, alchem casters, alchem flamers and alchem combi-flamers.

**Known gaps in the import:**
- Blackshields and Shattered Legions access to armouries isn't modelled.
- "Rewards of Treachery" (other Legions' units a Traitor Legion may take) and Rite of War army configurations are skipped; see the import report.
- Legion detachments are hand-entered: every Legion's Additional Detachments are in (see [docs/RULES.md](docs/RULES.md#legion-additional-detachments-14-nov-2026)), but most Legion-specific Prime Advantages aren't yet.
- Option caps on units with several model types (e.g. sergeant vs legionaries) use total unit size, not per-type counts.
- Conditional costs use the base cost.
- Mortus Poisoner Squad isn't on Wahapedia, so its points are unchecked.
- Units only linked under special slot categories (Castellax/Thallax maniples, "Logisticae" variants) aren't imported.

## Critique of the original plan

1. **Prime slots are missing from the plan, and they are core to HH3 list building.** Primary, Allied and several Apex/Legion detachments have Prime slots. Prime Advantages can add slots (Logistical Benefit, plus Iron Hands, Ultramarines, Alpha Legion and Shattered Legions variants). One of them, Special Assignment, lets a High Command unit sit in a Command slot that then *unlocks nothing*. That last one is precisely the kind of thing that confuses new players about unlocking. These are modelled and tested here.
2. **"Primary, Auxiliary, Apex, and any others" undersells the structure.** There are six core kinds (Primary, Auxiliary, Apex, Allied, Lord of War, Warlord). On top of those, Legion detachments are gated four different ways: by Primary Faction, by "army includes X", by a *specific unit in the Command slot* ("instead of" the normal choice), or by *replacing* a core detachment (Brotherhood of the Phoenix replaces the Warlord Detachment). Unlocking is a **graph**: slots unlock detachments, Apex slots unlock more, Allied slots unlock their own Auxiliaries. So rosters store **explicit links** (`unlockedBy`). That lets the validator say "Command slot 1 is already unlocking Armoured Support", and lets the UI draw the line. Without links you'd need a matching solver *and* you'd lose the explanation.
3. **"Units that don't take a slot" and "options that change a unit's role" look like 2nd-edition ideas.** HH3 says every selected unit fills a slot, and its designer's note says Dedicated Transports and commander-attached Retinues are gone. I found no example of either in what I read. Both are typed as hooks but neither is built into the UI. Don't build UI for them until someone finds a source.
4. **`validate(list)` can't be pure without its data.** The signature is `validate(roster, catalog)`. Errors and **warnings** are separate (the 2,000–4,000 band and data-version drift are advisory). The result includes totals so the points bar and the verdict can't disagree.
5. **"Names the rule in plain language" isn't enough on its own.** Each error also carries a stable `ruleId` and the source section. Tests assert IDs, not prose, so wording can improve without breaking them, and players can open the book at the right page in a dispute. Locked-slot reasons in the UI come from the same validator (`explainChange`), so the UI isn't a second rules engine.
6. **Golden tests shouldn't depend on real points.** They'd break at every points update, and real points may not be yours to redistribute. Engine tests here use fixture points. Real data gets separate snapshot tests (TEST-PLAN §2a).
7. **Tournament-checked lists and another builder's totals aren't ground truth.** TOs miss things and other builders have stale data. Plan to sort each disagreement into *our bug / their miss / ambiguous*, comparing per unit, not just totals (TEST-PLAN §2).
8. **5 think-aloud users is right for finding problems, wrong for timing statistics.** Time-to-legal also rewards guessing. Report per-person and median times, and add an **explain-back** task ("why are you allowed this Auxiliary?"), because understanding unlocking is the actual goal (TEST-PLAN §3).
9. **"Rule changes are data-only" can't be completely true.** Points, slots, roles, caps, restrictions and new detachments built from existing requirement kinds *are* data (the drill proves it). A new *kind* of rule needs code. The honest version: those kinds live in a closed union, and an unknown kind **fails loudly** (`DATA-UNKNOWN`) instead of being silently skipped (tested).
10. **Unaddressed risk: where real unit and points data come from.** Wahapedia is a lookup aid. Copying its text and points into a product raises licensing questions. Store section references, not rules text, and decide the data source (hand entry from owned books, or a community data set with a clear licence) before building the UI. Pin a catalog version on every saved list (`catalogVersion`).

## Rules I couldn't confirm from the source

See [docs/RULES.md](docs/RULES.md) for the full list. Short version:

- **Units that take no slot:** none found. Hook only.
- **Options that change Battlefield Role:** none found. Hook only (`setRole`).
- **Retinue units needing a commander:** no list-building rule found. Not enforced.
- **Apothecarion Delegation / Techmarine Covenant unlock condition:** missing on Wahapedia. Encoded as normal Auxiliaries.
- **25% Warlord/Lord of War cap:** sources disagree on what counts, and on ≤ vs <. My reading is flagged.
- **Lord of War Detachment "same Army List *or* Faction":** read as one army list.
- **Whether Auxiliary-detachment Command slots unlock further detachments:** read as no (moot for core).
- **Rite of War vs Primary Faction gating for Legion Additional Detachments:** both supported. Sample data uses Primary Faction.
- **Legion vs Legion allies (e.g. Blood Angels Primary + Dark Angels Allied):** treated as different Factions, so legal. Not confirmed in an FAQ.
- **Slot layouts for untitled Legion detachments:** inferred from HTML order.
- **Everything outside what I read:** printed books, Warhammer Community errata PDFs, other factions' lists, unit datasheets and real points. **None of it was checked.**
