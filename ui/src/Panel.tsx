import { useMemo, useState, type ReactNode } from 'react';
import { CATALOG } from '../../src/catalog';
import { explainChange } from '../../src/explain';
import type { BattlefieldRole, DetachmentInstance, Issue, OptionDef, SlotDef, UnitDef } from '../../src/model';
import { unitPoints } from '../../src/points';
import { roleLabel } from '../../src/validate';
import type { Selection } from './App';
import { slotLabel } from './Chart';
import { EyeButton } from './datasheet';
import { ROLE_ORDER, extraRequirements, forArmyList, forPrimaryLegion, slotSummary, unitsFitting } from './fits';
import { detachmentReasons, splitMessage, unitReasons } from './reasons';
import {
  addDetachment,
  detDefs,
  duplicateTarget,
  duplicateUnit,
  planWithCommander,
  decurionFor,
  removeBenefitSlot,
  planWithSubFaction,
  unlockAllowance,
  unlockSummary,
  childrenOf,
  extraSlotRoles,
  factionForDetachment,
  fillOf,
  placeUnit,
  primeDefs,
  removeUnit,
  setExtraSlotRole,
  setOptionCount,
  setPrime,
  setSubFaction,
  slotsOf,
  unitDefs,
  updateUnit,
  type BuilderState,
} from './state';
import { RoleIcon } from './RoleIcon';

interface Props {
  state: BuilderState;
  sel: Selection;
  setSel: (s: Selection) => void;
  commit: (s: BuilderState, msg?: string) => void;
  issuesAt: (detId: string, slotId?: string) => Issue[];
}

/** "Heavy Assault ×2: E.g. Cataphractii Terminator Squad, Destroyer Assault Squad, ..." */
function roleTooltip(label: string, units: UnitDef[]): string {
  if (!units.length) return `${label}: no matching units in this data set`;
  const shown = units.slice(0, 4).map((u) => u.name).join(', ');
  return `${label}: E.g. ${shown}${units.length > 4 ? ', ...' : ''}`;
}

const Why = ({ issues, id }: { issues: Issue[]; id: string }) =>
  issues.length ? (
    <span id={id} className="why">
      {splitMessage(issues[0]!.message).what}
      {issues.length > 1 && <span className="more"> (+{issues.length - 1} more)</span>}
    </span>
  ) : null;

// ───────────────────────────── unit picker ──────────────────────────────
function UnitPicker({ props, det, slot }: { props: Props; det: DetachmentInstance; slot: SlotDef }) {
  const { state, commit, setSel } = props;
  const [q, setQ] = useState('');
  const fill = fillOf(det, slot.id);
  const special = fill?.primeAdvantage === 'special-assignment';
  const faction = factionForDetachment(state, det.id);

  const rows = useMemo(() => {
    const roles: BattlefieldRole[] = special ? [slot.role, 'HighCommand'] : [slot.role];
    return CATALOG.units
      // Armoured Spearhead: Decurion tanks may also fill High Command / Command slots.
      .filter((u) => roles.includes(u.role) || !!decurionFor(det, slot, u.id))
      .map((u) => ({ u, reasons: unitReasons(state, det.id, slot.id, u.id) }))
      .sort((a, b) => Number(a.reasons.length > 0) - Number(b.reasons.length > 0) || a.u.name.localeCompare(b.u.name));
  }, [state, det.id, slot.id, slot.role, special]);

  // Only this detachment's army list (a slot may name another, e.g. Daemonic Manifestation).
  const list = slot.restriction?.armyList ?? det.armyList;
  const astartes = list === 'legiones-astartes';
  const match = (u: UnitDef) => u.armyList === list && (!q || u.name.toLowerCase().includes(q.toLowerCase()));
  const ours = rows.filter((r) => match(r.u) && (r.u.factionTrait === null || r.u.factionTrait === faction));
  const others = rows.filter((r) => match(r.u) && r.u.factionTrait !== null && r.u.factionTrait !== faction);

  const pick = (u: UnitDef) => {
    commit(placeUnit(state, det.id, slot.id, u.id), `${u.name} added to ${slotLabel(det, slot)}`);
    setSel({ kind: 'slot', detId: det.id, slotId: slot.id });
  };

  const Row = ({ u, reasons }: { u: UnitDef; reasons: Issue[] }) => {
    const locked = reasons.length > 0;
    const id = `why-${u.id}`;
    return (
      <li role="option" aria-selected={false}>
        <div className="pick-row">
          <button className={`pick ${locked ? 'locked' : ''}`} aria-disabled={locked} aria-describedby={locked ? id : undefined} onClick={() => !locked && pick(u)}>
            <span className="pick-name">
              {locked ? '✗ ' : '✓ '}
              <RoleIcon role={u.role} size={30} title />
              {u.name}
              {u.factionTrait && <span className="tag">{u.factionTrait}</span>}
              {u.allegiance !== 'Any' && <span className="tag">{u.allegiance}</span>}
            </span>
            <span className="pick-pts">{u.points.base}{u.points.maxModels > u.points.minModels ? '+' : ''} pts</span>
          </button>
          <EyeButton unitId={u.id} faction={u.factionTrait ?? faction} allegiance={state.roster.allegiance} />
        </div>
        <Why issues={reasons} id={id} />
      </li>
    );
  };

  return (
    <div>
      <h3>{fill?.unit ? 'Replace with' : 'Choose a unit for'} {slotLabel(det, slot)}</h3>
      {det.benefitSlots?.some((x) => x.id === slot.id) && !fill?.unit && (
        <button className="link danger" onClick={() => { commit(removeBenefitSlot(state, det.id, slot.id), 'Removed the extra ' + roleLabel(slot.role) + ' slot'); setSel(null); }}>
          Remove this extra slot
        </button>
      )}
      <p className="hint">
        {special ? 'Special Assignment: High Command units may fill this Command slot. ' : ''}
        Locked units say why.{' '}
        {astartes ? <>New "[Legiones Astartes]" units join as <strong>{faction}</strong>.</> : <>Showing <strong>{faction}</strong> units.</>}
      </p>
      <input className="search" type="search" placeholder="Filter units…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter units" />
      <ul className="picklist" role="listbox" aria-label={`Units for ${slotLabel(det, slot)}`}>
        {ours.map((r) => (
          <Row key={r.u.id} {...r} />
        ))}
        {!ours.length && <li className="hint">No {roleLabel(slot.role)} units match.</li>}
      </ul>
      {others.length > 0 && (
        <details>
          <summary>Other Legions' {roleLabel(slot.role)} units ({others.length})</summary>
          <ul className="picklist" role="listbox">
            {others.map((r) => (
              <Row key={r.u.id} {...r} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** A collapsible wargear category: starts open; collapse it to just the heading (which lists what is taken). */
function OptGroup({ title, total, taken, children }: { title: string; total: number; taken: string[]; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <details className="opt-group" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <span className="opt-group-title">{title}</span> <span className="opt-group-count">({total} options{taken.length ? ` · ${taken.join(', ')}` : ''})</span>
      </summary>
      {children}
    </details>
  );
}

// ───────────────────────────── unit editor ──────────────────────────────
function UnitEditor({ props, det, slot }: { props: Props; det: DetachmentInstance; slot: SlotDef }) {
  const { state, commit } = props;
  const fill = fillOf(det, slot.id)!;
  const unit = fill.unit!;
  const def = unitDefs.get(unit.unitId)!;
  const errs = props.issuesAt(det.id, slot.id);
  const [replacing, setReplacing] = useState(false);
  const extra = det.extraSlots.find((x) => x.grantedBy.slotId === slot.id);
  const count = (id: string) => unit.options.find((o) => o.optionId === id)?.count ?? 0;
  const dupTarget = duplicateTarget(state, det.id, slot.id);
  const dupReasons = useMemo(
    () => (dupTarget ? explainChange(state.roster, CATALOG, (draft) => duplicateUnit({ ...state, roster: draft }, det.id, slot.id)?.state.roster ?? draft) : []),
    [state, det.id, slot.id, dupTarget],
  );

  const primes = useMemo(
    () =>
      slot.prime
        ? CATALOG.primeAdvantages.map((p) => ({
            p,
            reasons: fill.primeAdvantage === p.id ? [] : explainChange(state.roster, CATALOG, (draft) => setPrime({ ...state, roster: draft }, det.id, slot.id, p.id).roster),
          }))
        : [],
    [state, det.id, slot.id, slot.prime, fill.primeAdvantage],
  );

  // Show the generic options plus this unit's own Legion armoury; other Legions' items stay hidden
  // (an already-taken one stays visible so its error can be fixed).
  const unitFaction = unit.factionTrait ?? def.factionTrait ?? undefined;
  const shown = def.options.filter((o) => !o.factionTraits || (unitFaction && o.factionTraits.includes(unitFaction)) || count(o.id) > 0);
  const groups = new Map<string, OptionDef[]>();
  for (const o of shown) {
    const g = o.group ?? '(other upgrades)';
    groups.set(g, [...(groups.get(g) ?? []), o]);
  }

  const chosenPrime = fill.primeAdvantage ? primeDefs.get(fill.primeAdvantage) : undefined;
  // Each sub-faction with what choosing it would break (another sub-faction in the detachment, a lost Apex…).
  const subChoices = useMemo(
    () =>
      (def.subFactions ?? []).map((sub) => ({
        sub,
        reasons: sub === unit.subFaction ? [] : explainChange(state.roster, CATALOG, (draft) => setSubFaction({ ...state, roster: draft }, det.id, slot.id, sub).roster),
      })),
    [state, det.id, slot.id, def.subFactions, unit.subFaction],
  );
  return (
    <div>
      <h3 className="with-eye">
        {def.name} <EyeButton unitId={def.id} inst={unit} allegiance={state.roster.allegiance} label="Datasheet" />
      </h3>
      <p className="unit-sub">
        <RoleIcon role={def.role} size={28} /> {roleLabel(def.role)} · {unit.factionTrait ?? def.factionTrait ?? ''}
        {(unit.subFaction ?? def.subFaction) ? ` (${unit.subFaction ?? def.subFaction})` : ''} · {unitPoints(unit, def)} pts
        {def.modelTags.length ? ` · ${def.modelTags.join(', ')}` : ''}
      </p>
      {errs.map((e, i) => (
        <p key={i} className="det-err">
          {splitMessage(e.message).what} <small>Rule: {splitMessage(e.message).rule}</small>
        </p>
      ))}

      {def.subFactions && (
        <div className="field">
          <label htmlFor="subfaction">Sub-faction (one per detachment)</label>
          <select id="subfaction" value={unit.subFaction ?? ''} onChange={(e) => commit(setSubFaction(state, det.id, slot.id, e.target.value), `${def.name} set to ${e.target.value}`)}>
            {!unit.subFaction && <option value="">— choose —</option>}
            {subChoices.map(({ sub, reasons }) => (
              <option key={sub} value={sub}>
                {reasons.length ? '✗ ' : ''}
                {sub}
                {reasons.length ? ` — ${splitMessage(reasons[0]!.message).what}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {def.subFaction && !def.subFactions && <p className="hint">Sub-faction: <strong>{def.subFaction}</strong> (fixed by the profile; one per detachment).</p>}

      {def.points.maxModels > def.points.minModels && (
        <div className="field">
          <label htmlFor="models">Models ({def.points.minModels}–{def.points.maxModels}, +{def.points.perExtraModel} pts each extra)</label>
          <div className="stepper">
            <button aria-label="One fewer model" disabled={unit.models <= def.points.minModels} onClick={() => commit(updateUnit(state, det.id, slot.id, (u) => ({ ...u, models: u.models - 1 })))}>−</button>
            <input
              id="models"
              type="number"
              min={def.points.minModels}
              max={def.points.maxModels}
              value={unit.models}
              onChange={(e) => commit(updateUnit(state, det.id, slot.id, (u) => ({ ...u, models: Number(e.target.value) || def.points.minModels })))}
            />
            <button aria-label="One more model" disabled={unit.models >= def.points.maxModels} onClick={() => commit(updateUnit(state, det.id, slot.id, (u) => ({ ...u, models: u.models + 1 })))}>+</button>
          </div>
        </div>
      )}

      {slot.prime && (
        <div className="field">
          {/* A list of choices rather than a <select>: options can't mix bold names with plain descriptions.
              Starts open; collapse it to just the heading (which names the current choice). Re-opens per slot. */}
          <details className="prime-details" open key={`prime|${det.id}|${slot.id}`}>
          <summary>
            Prime Advantage (★ Prime slot): <strong>{fill.primeAdvantage ? primeDefs.get(fill.primeAdvantage)?.name ?? fill.primeAdvantage : 'None'}</strong>
          </summary>
          <fieldset className="prime-choices" aria-label="Prime Advantage">
            {(() => {
              const pick = (id: string | undefined) => commit(setPrime(state, det.id, slot.id, id));
              const choice = (id: string | undefined, name: string, summary?: string, why?: string) => (
                <label key={id ?? 'none'} className={`prime-choice ${why ? 'locked' : ''} ${(fill.primeAdvantage ?? undefined) === id ? 'chosen' : ''}`}>
                  <input type="radio" name={`prime-${det.id}-${slot.id}`} checked={(fill.primeAdvantage ?? undefined) === id} disabled={!!why} onChange={() => pick(id)} />
                  <span>
                    <strong>{name}</strong>
                    {summary && <span className="prime-desc">{summary}</span>}
                    {why && <span className="why">{why}</span>}
                  </span>
                </label>
              );
              const open = primes.filter((x) => !x.reasons.length);
              const locked = primes.filter((x) => x.reasons.length);
              return (
                <>
                  {choice(undefined, 'None')}
                  {open.map(({ p }) => choice(p.id, p.name, p.summary))}
                  {locked.length > 0 && (
                    <details className="prime-locked">
                      <summary>Not available here ({locked.length})</summary>
                      {locked.map(({ p, reasons }) => choice(p.id, p.name, p.summary, splitMessage(reasons[0]!.message).what))}
                    </details>
                  )}
                </>
              );
            })()}
          </fieldset>
          </details>
          {extra && (
            <div className="field">
              <label htmlFor="xrole">{primeDefs.get(extra.grantedBy.primeAdvantageId)?.name} adds one slot to this detachment. Its role:</label>
              <select id="xrole" value={extra.role} onChange={(e) => commit(setExtraSlotRole(state, det.id, extra.id, e.target.value as BattlefieldRole))}>
                {(() => {
                  const eff = primeDefs.get(extra.grantedBy.primeAdvantageId)?.effect;
                  return (eff?.kind === 'addSlot' ? extraSlotRoles(eff) : []).map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ));
                })()}
              </select>
            </div>
          )}
        </div>
      )}

      {def.options.length > 0 && (
        // Open by default; the key re-opens it whenever another slot is selected.
        <details className="wargear" open key={`${det.id}|${slot.id}`}>
          <summary>Wargear options ({shown.length})</summary>
          <p className="hint">
            Imported from BSData. Free default wargear isn't listed. Legion armoury items appear for that Legion only
            {unitFaction ? ` (showing ${unitFaction})` : ''}.
          </p>
          {[...groups.entries()].map(([g, opts]) => {
            const title = g.includes('/') ? g.split('/').slice(1).join(' › ').replace(/-/g, ' ') : g;
            const rows = opts.map((o) => (
                <label key={o.id} className="opt">
                  <input
                    type="number"
                    min={0}
                    max={o.max === 'models' ? unit.models : o.max}
                    value={count(o.id)}
                    onChange={(e) => commit(setOptionCount(state, det.id, slot.id, o.id, Math.max(0, Number(e.target.value) || 0)))}
                    aria-label={`${o.name} count`}
                  />
                  <span>
                    {o.name}
                    {o.factionTraits && <span className="tag armoury">{o.factionTraits.join('/')} armoury</span>}
                  </span>
                  <span className="opt-pts">+{o.cost.points}{o.cost.per === 'model' ? '/model' : ''}</span>
                </label>
              ));
            // Long lists (e.g. a Sergeant's "exchange bolt pistol/chainsword for…") collapse; the
            // summary says what is taken. They start open; selecting another slot opens them again.
            if (opts.length > 6) {
              const taken = opts.filter((o) => count(o.id) > 0).map((o) => `${count(o.id) > 1 ? `${count(o.id)}× ` : ''}${o.display?.item ?? o.name}`);
              return <OptGroup key={`${slot.id}|${g}`} title={title} total={opts.length} taken={taken}>{rows}</OptGroup>;
            }
            return (
              <fieldset key={g}>
                <legend>{title}</legend>
                {rows}
              </fieldset>
            );
          })}
        </details>
      )}

      <div className="row">
        <button
          aria-disabled={!dupTarget || dupReasons.length > 0}
          aria-describedby={!dupTarget || dupReasons.length ? 'dup-why' : undefined}
          className={!dupTarget || dupReasons.length ? 'locked' : ''}
          title={dupTarget ? `Copy into ${slotLabel(det, dupTarget)} (same size and wargear; Prime Advantage not copied)` : undefined}
          onClick={() => {
            const r = !dupReasons.length && duplicateUnit(state, det.id, slot.id);
            if (!r) return;
            commit(r.state, `Duplicated ${def.name} into ${dupTarget ? slotLabel(det, dupTarget) : 'a new slot'}`);
            props.setSel({ kind: 'slot', detId: det.id, slotId: r.slotId });
          }}
        >
          {!dupTarget || dupReasons.length ? '🔒 ' : '⧉ '}Duplicate
        </button>
        <button onClick={() => setReplacing((r) => !r)}>{replacing ? 'Cancel replace' : 'Replace unit'}</button>
        <button className="danger" onClick={() => { commit(removeUnit(state, det.id, slot.id), `Removed ${def.name}`); props.setSel({ kind: 'slot', detId: det.id, slotId: slot.id }); }}>
          Remove unit
        </button>
      </div>
      {!dupTarget ? (
        <p id="dup-why" className="why">
          Can't duplicate: no empty {roleLabel(def.role)} slot left in {detDefs.get(det.defId)?.name}.
        </p>
      ) : dupReasons.length > 0 ? (
        <p id="dup-why" className="why">Can't duplicate: {splitMessage(dupReasons[0]!.message).what}</p>
      ) : (
        <p className="hint">Duplicate copies this unit into {slotLabel(det, dupTarget)}.</p>
      )}
      {replacing && <UnitPicker props={props} det={det} slot={slot} />}
    </div>
  );
}

// ─────────────────────────── detachment picker ─────────────────────────
/** A one-click fix for a detachment locked to a specific commander: add that unit, or switch its sub-faction. */
type Plan = NonNullable<ReturnType<typeof planWithCommander>> & { subFaction?: string };

function DetachmentPicker({ props, det, slot }: { props: Props; det: DetachmentInstance; slot: SlotDef }) {
  const { state, commit, setSel } = props;
  const link = { detachmentId: det.id, slotId: slot.id };
  const rows = useMemo(
    () =>
      CATALOG.detachments
        .filter((d) => (d.kind === 'Apex' || d.kind === 'Auxiliary') && forPrimaryLegion(d, state.primaryLegion) && forArmyList(d, det.armyList))
        .map((d) => {
          const reasons = detachmentReasons(state, d.id, link);
          // Locked only because a specific commander is missing (Storm Battery ← Siege Breaker)?
          // Offer to add that commander in a free slot and unlock the detachment from it.
          let withCommander: { plan: Plan; blockers: Issue[] } | null = null;
          if (reasons.length && reasons.every((r) => r.ruleId === 'DET-UNLOCK-SPECIFIC')) {
            // The right unit is already in this slot, just with another sub-faction? Switch it.
            // Otherwise add the commander the detachment needs in a free slot.
            const retag = planWithSubFaction(state, d.id, link);
            const plan: Plan | null = retag
              ? { state: retag.state, unitId: retag.unitId, parentDetId: det.id, slotId: slot.id, newDetId: retag.newDetId, subFaction: retag.subFaction }
              : planWithCommander(state, d.id, det.id);
            if (plan) {
              const blockers = explainChange(state.roster, CATALOG, () => plan.state.roster).filter(
                (e) => e.ruleId !== 'ARMY-DETACHMENT-NOT-EMPTY' && e.ruleId !== 'WARLORD-PARAGON',
              );
              withCommander = { plan, blockers };
            }
          }
          return { d, reasons, withCommander };
        })
        .sort((a, b) => Number(a.reasons.length > 0) - Number(b.reasons.length > 0) || a.d.kind.localeCompare(b.d.kind) || a.d.name.localeCompare(b.d.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, det.id, slot.id],
  );
  const unitName = unitDefs.get(fillOf(det, slot.id)?.unit?.unitId ?? '')?.name;
  const faction = factionForDetachment(state, det.id);
  const fitOpts = { faction, allegiance: state.roster.allegiance };
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  // Search names, kinds, slot roles and the units that fit (e.g. "Terminator" finds Shock Assault).
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter(({ d }) => {
        const roles = slotSummary(d).map((s) => roleLabel(s.role));
        const hay = [d.name, d.kind, ...roles, ...slotSummary(d).flatMap((s) => unitsFitting(d, s.role, fitOpts).map((u) => u.name))];
        return hay.some((h) => h.toLowerCase().includes(needle));
      })
    : rows;
  const add = (defId: string, name: string) => {
    const r = addDetachment(state, defId, link);
    commit(r.state, `${name} unlocked`);
    setSel(null);
    setTimeout(() => document.getElementById(`det-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };
  return (
    <div>
      <h3>Unlock a detachment</h3>
      <p className="hint">
        {unitName} in {slotLabel(det, slot)} ({roleLabel(slot.role)}) {unlockSummary(det, slot, childrenOf(state.roster, det.id, slot.id).length).replace(/.$/, '')}. Use ▸ for details and + to add.
      </p>
      <input
        className="search"
        type="search"
        placeholder="Search detachments, roles or units (e.g. Terminator)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search detachments"
      />
      <ul className="det-list">
        {shown.map(({ d, reasons, withCommander }) => {
          const locked = reasons.length > 0;
          const summary = slotSummary(d);
          const isOpen = open.has(d.id);
          const detailId = `det-detail-${d.id}`;
          const fullReason = locked ? splitMessage(reasons[0]!.message).what : '';
          // Short form for the one-line row: drop the repeated detachment name and lead-in
          // ("Army Vanguard is an Apex detachment; it needs a High Command slot…" → "Needs a High Command slot…").
          const short = fullReason.includes('; ') ? fullReason.split('; ').slice(1).join('; ') : fullReason.replace(new RegExp(`^${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`), '');
          const firstReason = short.replace(/^(it|is) /i, '').replace(/^./, (c) => c.toUpperCase());
          return (
            <li key={d.id} className={`det-row ${locked ? 'locked' : ''} ${isOpen ? 'open' : ''}`}>
              <div className="det-line">
                <button className="expander" aria-expanded={isOpen} aria-controls={detailId} aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${d.name}`} onClick={() => toggle(d.id)}>
                  {isOpen ? '▾' : '▸'}
                </button>
                <button className="det-line-name link-plain" onClick={() => toggle(d.id)} aria-hidden tabIndex={-1} title={d.name}>
                  {d.name}
                </button>
                {!withCommander && <span className="tag">{d.kind}</span>}
                <span className="det-line-roles" title={summary.map((s) => roleTooltip(s.label, unitsFitting(d, s.role, fitOpts))).join('\n')}>
                  {summary.map((s) => (
                    <span key={s.role} className="mini-role">
                      <RoleIcon role={s.role} size={22} frame={s.prime ? 'prime' : 'circle'} title />
                      {s.count > 1 && <small>×{s.count}</small>}
                    </span>
                  ))}
                </span>
                {locked && (
                  <span className={`det-line-why ${withCommander ? 'sr-only' : ''}`} id={`why-${d.id}`} title={fullReason}>
                    {firstReason}
                  </span>
                )}
                {withCommander && (() => {
                  const { plan, blockers } = withCommander;
                  const cmdName = unitDefs.get(plan.unitId)?.name ?? plan.unitId;
                  const parent = plan.state.roster.detachments.find((x) => x.id === plan.parentDetId)!;
                  const where = `${slotLabel(parent, slotsOf(parent).find((sl) => sl.id === plan.slotId)!)}${parent.id !== det.id ? ` of ${detDefs.get(parent.defId)?.name}` : ''}`;
                  const an = /^[AEIOU]/i.test(cmdName) ? 'an' : 'a';
                  const blocked = blockers.length > 0;
                  const blockText = blocked ? splitMessage(blockers[0]!.message).what : '';
                  const sub = plan.subFaction;
                  const doing = sub ? `Sets ${cmdName} (and its detachment) to ${sub}` : `Adds ${an} ${cmdName} in ${where}`;
                  return (
                    <button
                      className={`add-with-cmd ${blocked ? 'locked' : ''}`}
                      aria-disabled={blocked}
                      title={blocked ? `Can't do this for ${d.name}: ${blockText}` : `${doing} and unlocks ${d.name} from it`}
                      aria-label={blocked ? `Can't do this for ${d.name}: ${blockText}` : `${doing} and unlock ${d.name}`}
                      onClick={() => {
                        if (blocked) return;
                        commit(plan.state, sub ? `Set ${cmdName} to ${sub} and unlocked ${d.name}` : `Added ${cmdName} in ${where} and unlocked ${d.name}`);
                        setSel(null);
                        setTimeout(() => document.getElementById(`det-${plan.newDetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                      }}
                    >
                      {sub ? `→ ${sub}` : `+ ${cmdName}`}
                    </button>
                  );
                })()}
                <button
                  className={`add-det ${locked ? 'locked' : ''}`}
                  aria-label={locked ? `${d.name} is locked: ${firstReason}` : `Add ${d.name}`}
                  aria-disabled={locked}
                  title={locked ? firstReason : `Add ${d.name}`}
                  onClick={() => !locked && add(d.id, d.name)}
                >
                  {locked ? '🔒' : '+'}
                </button>
              </div>
              {isOpen && (
                <div className="det-detail" id={detailId}>
                  {locked && <Why issues={reasons} id={`why-full-${d.id}`} />}
              <p className="role-chips" aria-label="Slots in this detachment">
                {summary.map((s) => {
                  const ex = unitsFitting(d, s.role, fitOpts);
                  return (
                    <span key={s.role} className="role-chip" title={roleTooltip(s.label, ex)}>
                      <RoleIcon role={s.role} size={26} />
                      {roleTooltip(s.label, ex)}
                    </span>
                  );
                })}
              </p>
              {extraRequirements(d).length > 0 && <p className="hint">Also: {extraRequirements(d).join(' · ')}</p>}
                </div>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="hint">No detachments match "{q}".</li>}
      </ul>
    </div>
  );
}

// ──────────────────────────────── panel ─────────────────────────────────
export function Panel(props: Props) {
  const { sel, state } = props;
  const det = sel && state.roster.detachments.find((d) => d.id === sel.detId);
  const slot = det && slotsOf(det).find((s) => s.id === sel!.slotId);
  let body;
  if (!sel || !det || !slot) {
    body = (
      <div className="help">
        <h3>How this works</h3>
        <ol>
          <li><strong>Click any slot</strong> in the chart to fill it. Units you can't take stay in the list and say why.</li>
          <li><strong>Command and High Command slots unlock detachments.</strong> Once filled, a "+ Unlock a detachment" button appears under them.</li>
          <li><strong>★ Prime slots</strong> give a Prime Advantage when filled. Logistical Benefit adds a slot <em>inside</em> the detachment; it doesn't unlock a new one.</li>
          <li>Keep an eye on the points bar. "Show me" jumps to each problem.</li>
        </ol>
        <p className="hint">Keyboard: Tab to a slot, Enter to open it, Esc to close, Ctrl+Z / Ctrl+Shift+Z to undo/redo.</p>
        <h3>Battlefield Role icons</h3>
        <ul className="legend">
          {ROLE_ORDER.map((r) => (
            <li key={r}>
              <RoleIcon role={r} size={36} /> {roleLabel(r)}
            </li>
          ))}
          <li className="legend-prime">
            <RoleIcon role="Troops" size={36} frame="prime" /> Prime slot (pointed ring, any role)
          </li>
        </ul>
        <p className="hint">Detachments: {[...detDefs.values()].length} available in this data set.</p>
      </div>
    );
  } else if (sel.kind === 'unlock') {
    body = <DetachmentPicker props={props} det={det} slot={slot} />;
  } else if (fillOf(det, slot.id)?.unit) {
    body = <UnitEditor key={`${det.id}/${slot.id}`} props={props} det={det} slot={slot} />;
  } else {
    body = <UnitPicker key={`${det.id}/${slot.id}`} props={props} det={det} slot={slot} />;
  }
  return (
    <aside className={`panel ${sel ? '' : 'idle'}`} aria-label="Details">
      {sel && (
        <button className="link close" onClick={() => props.setSel(null)} aria-label="Close panel">
          ✕ Close
        </button>
      )}
      {body}
    </aside>
  );
}
