import { useMemo, useState } from 'react';
import { CATALOG } from '../../src/catalog';
import { explainChange } from '../../src/explain';
import type { BattlefieldRole, DetachmentInstance, Issue, OptionDef, SlotDef, UnitDef } from '../../src/model';
import { unitPoints } from '../../src/points';
import { roleLabel } from '../../src/validate';
import type { Selection } from './App';
import { slotLabel } from './Chart';
import { EyeButton } from './datasheet';
import { howAvailable, slotSummary, unitsFitting } from './fits';
import { detachmentReasons, splitMessage, unitReasons } from './reasons';
import {
  addDetachment,
  detDefs,
  extraSlotRoles,
  factionForDetachment,
  fillOf,
  placeUnit,
  primeDefs,
  removeUnit,
  setExtraSlotRole,
  setOptionCount,
  setPrime,
  slotsOf,
  unitDefs,
  updateUnit,
  type BuilderState,
} from './state';

interface Props {
  state: BuilderState;
  sel: Selection;
  setSel: (s: Selection) => void;
  commit: (s: BuilderState, msg?: string) => void;
  issuesAt: (detId: string, slotId?: string) => Issue[];
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
      .filter((u) => roles.includes(u.role))
      .map((u) => ({ u, reasons: unitReasons(state, det.id, slot.id, u.id) }))
      .sort((a, b) => Number(a.reasons.length > 0) - Number(b.reasons.length > 0) || a.u.name.localeCompare(b.u.name));
  }, [state, det.id, slot.id, slot.role, special]);

  const match = (u: UnitDef) => !q || u.name.toLowerCase().includes(q.toLowerCase());
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
      <p className="hint">
        {special ? 'Special Assignment: High Command units may fill this Command slot. ' : ''}
        Locked units say why. New "[Legiones Astartes]" units join as <strong>{faction}</strong>.
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

// ───────────────────────────── unit editor ──────────────────────────────
function UnitEditor({ props, det, slot }: { props: Props; det: DetachmentInstance; slot: SlotDef }) {
  const { state, commit } = props;
  const fill = fillOf(det, slot.id)!;
  const unit = fill.unit!;
  const def = unitDefs.get(unit.unitId)!;
  const errs = props.issuesAt(det.id, slot.id);
  const [replacing, setReplacing] = useState(false);
  const extra = det.extraSlots.find((x) => x.grantedBy.slotId === slot.id);

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

  const groups = new Map<string, OptionDef[]>();
  for (const o of def.options) {
    const g = o.group ?? '(other upgrades)';
    groups.set(g, [...(groups.get(g) ?? []), o]);
  }
  const count = (id: string) => unit.options.find((o) => o.optionId === id)?.count ?? 0;

  const chosenPrime = fill.primeAdvantage ? primeDefs.get(fill.primeAdvantage) : undefined;
  return (
    <div>
      <h3 className="with-eye">
        {def.name} <EyeButton unitId={def.id} inst={unit} allegiance={state.roster.allegiance} label="Datasheet" />
      </h3>
      <p className="unit-sub">
        {roleLabel(def.role)} · {unit.factionTrait ?? def.factionTrait ?? ''} · {unitPoints(unit, def)} pts
        {def.modelTags.length ? ` · ${def.modelTags.join(', ')}` : ''}
      </p>
      {errs.map((e, i) => (
        <p key={i} className="det-err">
          {splitMessage(e.message).what} <small>Rule: {splitMessage(e.message).rule}</small>
        </p>
      ))}

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
          <label htmlFor="prime">Prime Advantage (★ Prime slot)</label>
          <select id="prime" value={fill.primeAdvantage ?? ''} onChange={(e) => commit(setPrime(state, det.id, slot.id, e.target.value || undefined))}>
            <option value="">— none —</option>
            {primes.map(({ p, reasons }) => (
              <option key={p.id} value={p.id} disabled={reasons.length > 0}>
                {reasons.length ? '✗ ' : ''}
                {p.name}
                {p.summary ? ` — ${p.summary}` : ''}
                {reasons.length ? ` [Not available: ${splitMessage(reasons[0]!.message).what}]` : ''}
              </option>
            ))}
          </select>
          {chosenPrime?.summary && <p className="hint prime-summary">★ {chosenPrime.name}: {chosenPrime.summary}</p>}
          <details className="prime-help">
            <summary>What do the Prime Advantages do?</summary>
            <dl className="rules">
              {primes.map(({ p, reasons }) => (
                <div key={p.id}>
                  <dt>{p.name}{reasons.length ? <span className="why"> — not available here</span> : null}</dt>
                  <dd>{p.summary ?? ''}{reasons.length ? <><br /><span className="why">{splitMessage(reasons[0]!.message).what}</span></> : null}</dd>
                </div>
              ))}
            </dl>
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
        <details className="wargear">
          <summary>Wargear options ({def.options.length})</summary>
          <p className="hint">Imported from BSData. Free default wargear isn't listed. Some Legion-only items aren't imported yet.</p>
          {[...groups.entries()].map(([g, opts]) => (
            <fieldset key={g}>
              <legend>{g.includes('/') ? g.split('/').slice(1).join(' › ').replace(/-/g, ' ') : g}</legend>
              {opts.map((o) => (
                <label key={o.id} className="opt">
                  <input
                    type="number"
                    min={0}
                    max={o.max === 'models' ? unit.models : o.max}
                    value={count(o.id)}
                    onChange={(e) => commit(setOptionCount(state, det.id, slot.id, o.id, Math.max(0, Number(e.target.value) || 0)))}
                    aria-label={`${o.name} count`}
                  />
                  <span>{o.name}</span>
                  <span className="opt-pts">+{o.cost.points}{o.cost.per === 'model' ? '/model' : ''}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </details>
      )}

      <div className="row">
        <button onClick={() => setReplacing((r) => !r)}>{replacing ? 'Cancel replace' : 'Replace unit'}</button>
        <button className="danger" onClick={() => { commit(removeUnit(state, det.id, slot.id), `Removed ${def.name}`); props.setSel({ kind: 'slot', detId: det.id, slotId: slot.id }); }}>
          Remove unit
        </button>
      </div>
      {replacing && <UnitPicker props={props} det={det} slot={slot} />}
    </div>
  );
}

// ─────────────────────────── detachment picker ─────────────────────────
function DetachmentPicker({ props, det, slot }: { props: Props; det: DetachmentInstance; slot: SlotDef }) {
  const { state, commit, setSel } = props;
  const link = { detachmentId: det.id, slotId: slot.id };
  const rows = useMemo(
    () =>
      CATALOG.detachments
        .filter((d) => d.kind === 'Apex' || d.kind === 'Auxiliary')
        .map((d) => ({ d, reasons: detachmentReasons(state, d.id, link) }))
        .sort((a, b) => Number(a.reasons.length > 0) - Number(b.reasons.length > 0) || a.d.kind.localeCompare(b.d.kind) || a.d.name.localeCompare(b.d.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, det.id, slot.id],
  );
  const unitName = unitDefs.get(fillOf(det, slot.id)?.unit?.unitId ?? '')?.name;
  const faction = factionForDetachment(state, det.id);
  return (
    <div>
      <h3>Unlock a detachment</h3>
      <p className="hint">
        {unitName} in {slotLabel(det, slot)} ({roleLabel(slot.role)}) can unlock{' '}
        {slot.role === 'HighCommand' ? 'one Apex or one Auxiliary detachment' : 'one Auxiliary detachment'}.
      </p>
      <ul className="picklist" role="listbox">
        {rows.map(({ d, reasons }) => {
          const locked = reasons.length > 0;
          const summary = slotSummary(d);
          const slotsSummary = summary.map((s) => s.label).join(', ');
          const fitOpts = { faction, allegiance: state.roster.allegiance };
          return (
            <li key={d.id} role="option" aria-selected={false} className="det-option">
              <button
                className={`pick ${locked ? 'locked' : ''}`}
                aria-disabled={locked}
                aria-describedby={locked ? `why-${d.id}` : undefined}
                onClick={() => {
                  if (locked) return;
                  const r = addDetachment(state, d.id, link);
                  commit(r.state, `${d.name} unlocked`);
                  setSel(null);
                  setTimeout(() => document.getElementById(`det-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                }}
              >
                <span className="pick-name">
                  {locked ? '✗ ' : '✓ '}
                  {d.name} <span className="tag">{d.kind}</span>
                </span>
                <span className="pick-pts small">{slotsSummary}</span>
              </button>
              <Why issues={reasons} id={`why-${d.id}`} />
              <p className="role-chips" aria-label="Slots in this detachment">
                {summary.map((s) => {
                  const ex = unitsFitting(d, s.role, fitOpts);
                  return (
                    <span key={s.role} className="role-chip" title={ex.length ? `e.g. ${ex.slice(0, 6).map((u) => u.name).join(', ')}${ex.length > 6 ? '…' : ''}` : 'No matching units in this data set'}>
                      {s.label}: {ex.length ? `${ex.slice(0, 2).map((u) => u.name).join(', ')}${ex.length > 2 ? ` +${ex.length - 2}` : ''}` : 'none available'}
                    </span>
                  );
                })}
              </p>
              <details className="fits-detail">
                <summary>What fits these slots?</summary>
                {summary.map((s) => {
                  const ex = unitsFitting(d, s.role, fitOpts);
                  const restricted = d.slots.find((x) => x.role === s.role)?.restriction;
                  return (
                    <div key={s.role} className="fits-role">
                      <h4>
                        {roleLabel(s.role)} <span className="count">{ex.length}</span>
                        {restricted && <span className="tag">restricted in this detachment</span>}
                      </h4>
                      <ul className="plain">
                        {ex.map((u) => (
                          <li key={u.id} className="fit-unit">
                            <EyeButton unitId={u.id} faction={u.factionTrait ?? faction} allegiance={state.roster.allegiance} />
                            {u.name} <span className="pick-pts">{u.points.base}{u.points.maxModels > u.points.minModels ? '+' : ''} pts</span>
                          </li>
                        ))}
                        {!ex.length && <li className="hint">No {roleLabel(s.role)} units for {faction} in this data set.</li>}
                      </ul>
                    </div>
                  );
                })}
                <p className="hint">{howAvailable(d)}</p>
              </details>
            </li>
          );
        })}
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
