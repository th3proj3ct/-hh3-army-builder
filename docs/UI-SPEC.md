# UI spec: an army builder that explains itself

**Goal:** a new player builds a legal list and can say *why* each detachment exists.
**One rule for the whole UI:** every disabled control shows a reason, and that reason comes from `explainChange()`, which calls the validator. There is no second rules engine in the UI.

## Layout (desktop ≥1024px)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ POINTS BAR (sticky)  2,640 / 3,000  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░   Allied 0/1,500   │
│                       WL+LoW 450/750   ● 2 problems  ▸                    │
├──────────────────────────────┬────────────────────────────────────────────┤
│ FORCE ORG CHART (canvas)     │ UNIT PICKER (context-sensitive)            │
│                              │  Filter: [Troops ▾] slot: Primary/Troops 2 │
│  [Primary ★]──HC──▶[Apex]    │  ✓ Tactical Squad          125+           │
│      │                       │  ✗ Despoiler Squad — "Traitor-only; this  │
│      ├─Cmd1──▶[Armoured Sup] │     army is Loyalist"                      │
│      ├─Cmd2──▶ (+ unlock)    │                                            │
│      └─Cmd3  (empty)         │                                            │
│  [Allied]  [Warlord 🔒]      │ UNIT DETAIL / WARGEAR (read-only in v1)    │
│  [Lord of War]               │                                            │
└──────────────────────────────┴────────────────────────────────────────────┘
```

Mobile (<768px): the chart is a vertical tree, the picker is a bottom sheet, and the points bar is pinned to the top of the viewport.

## Force Organisation chart

- **The chart is a graph you can see.** The Primary sits at the root. Each filled Command/HC slot shows an outgoing connector. The connector ends either at the detachment it unlocked or at a dashed **"+ Unlock a detachment"** ghost card. This *is* the slot-unlocking lesson, drawn.
- **Redraws live** when the roster changes (add/remove unit, detachment, prime). Animate only position changes (≤150 ms; none if `prefers-reduced-motion`).
- **Slot chips** show the role icon and role name (never icon-only). Prime slots get a ★ and a "Prime" label.
- **Slot states**:
  | State | Look | Text always shown |
  |---|---|---|
  | empty, available | outline | "Troops — empty" |
  | filled | solid + unit name + pts | — |
  | locked | hatched + 🔒 | the reason, e.g. "Needs a 3,000+ point game" |
  | error | red ring | the validator message |
- **Locked detachments are always visible**, never hidden. Warlord at 2,000 pts shows: 🔒 *"Warlord Detachment: needs a points limit of 3,000+ (this list: 2,000)."* Hiding them is exactly how new players miss that the option exists.
- **Unlock connector tooltip:** "Your Centurion in Command slot 2 lets you add one Auxiliary detachment." Hovering a detachment highlights the slot that unlocked it.
- **Special Assignment** shows on the slot as "Command slot (High Command unit) — unlocks nothing". The connector stub is greyed out with that reason.

## Primary interaction: click-to-assign

1. Click an empty slot. The picker filters to that slot's role and detachment restrictions.
2. Click a unit. It's assigned, the chart redraws, and focus returns to the chart on the next empty slot of the same detachment.
3. Or start from the unit: click a unit in the picker → compatible slots pulse in the chart → click one. If exactly one slot is compatible, auto-place it and show an undo toast.
4. Clicking an unlock ghost card opens a **detachment picker**. Every detachment type is listed. Unavailable ones show their reason. The reason for a Command slot looking at Combat Retinue: "Apex detachments need a High Command slot, not a Command slot."
5. **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z) on every roster change. New players experiment, so make experimenting cheap.

**Drag-and-drop (optional, v1.1):** drag a unit card onto a slot. Drop targets are computed with the same `explainChange`. An invalid drop shows the reason at the pointer and does nothing. DnD is never the only way to do anything.

**Keyboard:**
- The chart is a `role="tree"`. Arrow keys move between detachments and slots, Enter opens the picker, Delete removes the unit, `P` opens Prime Advantage choices on a Prime slot.
- The picker is a `role="listbox"`. Disabled units are focusable (`aria-disabled="true"`), and their reason is in `aria-describedby`.
- An `aria-live="polite"` region announces "Tactical Squad added to Primary, Troops 2. 2,765 of 3,000 points."
- A keyboard "move mode" stands in for drag: Space picks up a unit, arrows choose a slot, Space drops it.

## Points bar (always visible)

- Shows total / limit plus two sub-meters that appear only when relevant: **Allied** (vs ceil 50%) and **Warlord + Lord of War** (vs ceil 25%). Each sub-meter has a tooltip naming its rule.
- Over the limit: the bar turns red, shows "+120 over", and lists the 3 most expensive units as quick links.
- The problems counter opens a list of every error. Each entry: plain message, rule name, source section, and a "Show me" button that focuses the slot/unit.
- Warnings (band, data version) are amber and never block "Export".

## "Why can't I choose this?"

Every unit row the picker shows as unavailable carries the first reason inline, plus "+N more" to expand. Reasons come from `explainChange(roster, catalog, addUnitToSlot)`, filtered to errors the change *introduces*. Performance budget: under 16 ms per interaction for a full picker. Not measured yet. If it's too slow, cache by (roster hash, slot) and compute visible rows first.

**Ambiguous rules** (status `ambiguous` in `RULES`) show a small "ⓘ interpretation" link to the chosen reading, so a player can argue with a TO using the book open.

## Wargear

Wargear is in the model now (`OptionDef`) and validated now (OPT-* rules). v1 UI: a read-only list of selected options, plus a JSON/import path so tested lists can carry wargear. The v2 editor uses the same `explainChange` for disabled options (e.g. "Blood Angels armoury only").

## Onboarding (first run)

A three-step coach mark, which can be dismissed: (1) "Pick a Primary unit" → (2) "Command and High Command slots unlock new detachments, watch the line appear" → (3) "Stay under the bar". No modal walls.

## Out of scope for v1

Accounts, cloud sync, the full wargear editor, Mission Reserves declaration, printing beyond a plain roster export.
