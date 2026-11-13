# Test plan

## 1. Automated (in repo, `npm test`)

| Suite | What it proves | Today |
|---|---|---|
| `golden.test.ts` | 16 legal + 33 illegal lists. Each asserts the **exact set** of rule IDs, so a list can't pass by tripping the wrong rule. Every message contains its rule title. | ✅ 51 tests |
| `points.property.test.ts` | fast-check: total = Σ unit costs; order-independent; adding a unit/model adds exactly its cost; validator total = calculator total; ARMY-POINTS fires iff over; Allied/LoW caps flip exactly at ceil(share × limit) | ✅ 8 tests |
| `errata.test.ts` | Errata drill (§4) | ✅ 8 tests |

The golden tests use **fixture points** (invented), so they test the engine. Real points need §2.

## 2. Outside checks: lists and points

**a. Real-data snapshot tests.** Once real profiles are entered, add `test/data/*.test.ts`. Each unit gets base cost and 2–3 option combos checked against the published points document, recording the page/date. These fail on purpose when the data changes, which forces a deliberate review.

**b. Tournament lists (correctness of the verdict).**
- Collect 30+ lists from **TO-checked** events: lists the organiser checked before play, ideally with the TO's notes. A list that was merely *played* at an event isn't proof it was legal.
- For each list, record: event, date, catalog version in force, the TO's verdict, and any corrections the TO made.
- Run them through `validate`. Every disagreement goes into one of three buckets: **our bug**, **their miss** (cite the rule and section), or **ambiguous** (add to RULES.md, ask the community/TO, and add a golden test either way).
- Target: zero unexplained disagreements. Not "matches 100%", because TOs make mistakes too.

**c. Points against another builder.**
- Pick one or two other builders (e.g. a NewRecruit/BattleScribe data set if one exists for HH3). Use their **export** for the same list and compare **per unit**, not just totals, so offsetting errors can't hide.
- Use the same 30 lists plus 50 generated ones (fast-check, seeded so they can be re-run).
- A difference ≠ a bug. Resolve each one against the published points, and record the decision in a `points-discrepancies.md` log with the source page.
- Re-run whenever either side's data version changes.

## 3. Think-aloud study (5 new players)

**Who:** 5 people who have played ≤3 HH3 games and have never built an HH3 list (a 40k background is fine; record it). Five is enough to find most usability problems. It is **not** enough to measure timing reliably, so treat time as a signal, not a statistic.

**Setup:** 60 min, moderated, remote or in person, screen + audio recorded, the participant's own browser. Same build, same seeded catalog version for everyone. Script the facilitator's lines; no hints except a scripted "what would you try next?" after 90 s stuck.

**Tasks** (the order is fixed and builds up):
1. *Warm-up:* "Make a 3,000 point Blood Angels army with any one unit in it." (The Primary concept.)
2. "Add a squad of Terminators." These need a Heavy Assault slot, which needs an unlocked Auxiliary or Apex. **This is the key task.**
3. "Add a Predator tank, then a second one." (Armoured Support from a Command slot; re-use of the same Auxiliary.)
4. "Add Sanguinius." (Warlord Detachment; then: "Now change the game to 2,000 points. What happened?")
5. "Your list is 40 points over. Make it legal."
6. *Explain-back:* point at an Auxiliary and ask "Why are you allowed this?" Correct = names the slot/unit that unlocked it.

**Measures:**
- **Primary:** time from task 1 start to the **first legal list that meets tasks 1–4**, measured from the recording, with the validator's `legal` flag as the stop condition. Report each participant plus the median; don't compute a mean of 5.
- Task success (unaided / with scripted prompt / failed).
- Wrong turns: clicks on a locked item *without reading the reason*. Also count reasons read aloud.
- Explain-back correctness (task 6). This is the real measure of understanding, and time-to-legal can't capture it.
- SEQ (1–7) after each task. SUS at the end.

**Success bar for v1:** at least 4 of 5 finish tasks 1–4 unaided or with one prompt, median time-to-legal under 10 min, and at least 4 of 5 explain-backs correct. Run another round of 5 after fixes and compare. Don't pool the rounds.

**Analysis:** a findings sheet tagged by severity (blocker / major / minor) and by which rule or UI element was involved. Feed recurring confusions back into the message wording in `validate.ts`.

## 4. Errata drill: proving rule changes are data-only

**Claim tested:** points, slot layouts, roles, caps, restrictions, once-per limits, and new detachments built from existing requirement kinds all ship as a JSON patch (`ErrataPatch`). No code changes.

**Automated drill** (`errata.test.ts`), one test per change class:
1. Unit points change → an at-limit list becomes ARMY-POINTS.
2. A slot is removed from a detachment → SLOT-EXISTS.
3. A unit's role changes → SLOT-ROLE-MATCH.
4. A Prime Advantage's frequency changes → PRIME-ONCE.
5. A percentage cap changes → LOW-CAP.
6. A new detachment is published as data → locked with a reason at 3,000, legal at 3,500.
7. Catalog version bump → DATA-VERSION warning on old lists.
8. **Boundary:** a new *kind* of requirement (`maxPerArmy`) is **refused loudly** (DATA-UNKNOWN), not ignored.

**Live drill (each real FAQ/errata release):** a teammate who hasn't touched the validator turns the published errata into a patch file. They change only `data/` and `errata/`. Pass = the PR has no `src/` changes, CI is green, and every errata item maps to a new or updated golden test. If an item *needs* code, that's fine, but the drill records it as a **new rule kind**, and the PR adds the union variant, the validator branch, and a test together.

## 5. Not covered yet

- Real unit data, other factions' army lists, Legion-specific detachments beyond the sample.
- Performance of `explainChange` across a full picker (budget: <16 ms per interaction).
- Accessibility audit (axe + screen-reader pass with NVDA/VoiceOver) once the UI exists.
