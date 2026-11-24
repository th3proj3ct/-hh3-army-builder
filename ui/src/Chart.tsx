import { useMemo } from 'react';
import { CATALOG } from '../../src/catalog';
import type { DetachmentInstance, Issue, SlotDef, ValidationResult } from '../../src/model';
import { unitPoints } from '../../src/points';
import { roleLabel } from '../../src/validate';
import type { Selection } from './App';
import { EyeButton } from './datasheet';
import { detachmentReasons, splitMessage } from './reasons';
import { forArmyList, forPrimaryLegion } from './fits';
import {
  FACTIONS,
  addBenefitSlot,
  addDetachment,
  benefitAllowance,
  canUnlock,
  childrenOf,
  detDefs,
  fillOf,
  primeDefs,
  removeDetachment,
  setAlliedFaction,
  setPrimaryDetachment,
  setChoice,
  slotsOf,
  unitDefs,
  unlockAllowance,
  unlockSummary,
  type BuilderState,
} from './state';
import { RoleIcon } from './RoleIcon';

interface Props {
  state: BuilderState;
  result: ValidationResult;
  sel: Selection;
  setSel: (s: Selection) => void;
  commit: (s: BuilderState, msg?: string) => void;
  issuesAt: (detId: string, slotId?: string) => Issue[];
}



export function slotLabel(det: DetachmentInstance, slot: SlotDef): string {
  const extra = det.extraSlots.find((x) => x.id === slot.id);
  if (det.benefitSlots?.some((x) => x.id === slot.id)) return `${roleLabel(slot.role)} (extra, ${detDefs.get(det.defId)?.name ?? 'benefit'})`;
  if (extra) return `${roleLabel(slot.role)} (extra, ${primeDefs.get(extra.grantedBy.primeAdvantageId)?.name ?? 'Prime'})`;
  const n = /(\d+)$/.exec(slot.id)?.[1];
  return `${roleLabel(slot.role)}${n ? ` ${n}` : ''}`;
}

export function detPoints(det: DetachmentInstance): number {
  return det.fills.reduce((s, f) => {
    const d = f.unit && unitDefs.get(f.unit.unitId);
    return s + (f.unit && d ? unitPoints(f.unit, d) : 0);
  }, 0);
}

function SlotChip({ det, slot, props }: { det: DetachmentInstance; slot: SlotDef; props: Props }) {
  const fill = fillOf(det, slot.id);
  const unit = fill?.unit;
  const def = unit && unitDefs.get(unit.unitId);
  const errs = props.issuesAt(det.id, slot.id);
  const selected = props.sel?.kind === 'slot' && props.sel.detId === det.id && props.sel.slotId === slot.id;
  const label = slotLabel(det, slot);
  return (
    <div className="slot-wrap">
    <button
      id={`slot-${det.id}-${slot.id}`}
      className={`slot ${unit ? 'filled' : 'empty'} ${slot.prime ? 'prime' : ''} ${errs.length ? 'error' : ''} ${selected ? 'selected' : ''}`}
      aria-pressed={selected}
      aria-label={`${label}${slot.prime ? ', Prime slot' : ''}: ${def ? `${def.name}, ${unitPoints(unit!, def)} points` : 'empty'}${errs.length ? `, ${errs.length} problem` : ''}`}
      onClick={() => props.setSel({ kind: 'slot', detId: det.id, slotId: slot.id })}
    >
      {/* Its own line just above the icon, so every slot's icon and label sit on the same line. */}
      {slot.prime && <span className="star slot-prime" title="Prime slot">★ Prime</span>}
      <span className="slot-role">
        <RoleIcon role={slot.role} size={40} frame={slot.prime ? 'prime' : 'circle'} />
        {label}
      </span>
      {def ? (
        <span className="slot-unit">
          <span className="unit-name">{def.name}</span>
          <span className="unit-meta">
            {unit!.models > 1 ? `${unit!.models} models · ` : ''}
            {unitPoints(unit!, def)} pts
            {fill?.primeAdvantage ? ` · ${primeDefs.get(fill.primeAdvantage)?.name}` : ''}
          </span>
        </span>
      ) : (
        <span className="slot-empty">+ Add {roleLabel(slot.role)}</span>
      )}
      {errs.length > 0 && <span className="slot-err">{splitMessage(errs[0]!.message).what}</span>}
    </button>
    {def && <EyeButton unitId={def.id} inst={unit!} allegiance={props.state.roster.allegiance} />}
    </div>
  );
}

function DetachmentCard({ det, depth, props }: { det: DetachmentInstance; depth: number; props: Props }) {
  const def = detDefs.get(det.defId);
  if (!def) return null;
  const { state, commit } = props;
  const slots = slotsOf(det);
  const errs = props.issuesAt(det.id);
  const unlockers = slots.filter((s) => canUnlock(det, s) && fillOf(det, s.id)?.unit);
  return (
    <article id={`det-${det.id}`} tabIndex={-1} className={`det kind-${def.kind} ${errs.length ? 'error' : ''}`} style={{ marginLeft: depth ? 0 : undefined }}>
      <header className="det-head">
        <div>
          <span className="kind">{def.kind}</span>
          <h2>{def.name}</h2>
        </div>
        <div className="det-tools">
          <span className="det-pts">{detPoints(det)} pts</span>
          {def.kind === 'Allied' && (
            <label>
              Faction{' '}
              <select value={state.alliedFaction[det.id] ?? ''} onChange={(e) => commit(setAlliedFaction(state, det.id, e.target.value))}>
                {FACTIONS.filter((l) => l !== state.primaryLegion).map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          )}
          {def.kind === 'Primary' && det.armyList === 'legiones-astartes' && (
            <label title="Legiones Astartes armies may use one of these in place of the Crusade Primary Detachment">
              Type{' '}
              <select
                value={det.defId}
                onChange={(e) => {
                  const r = setPrimaryDetachment(state, e.target.value);
                  const name = detDefs.get(e.target.value)?.name;
                  commit(r.state, `Primary Detachment set to ${name}${r.dropped.length ? `; no slot for: ${r.dropped.join(', ')}` : ''}`);
                }}
              >
                {CATALOG.detachments
                  .filter((d) => d.kind === 'Primary' && (!d.armyLists || d.armyLists.includes(det.armyList)))
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </label>
          )}
          {def.choice && (
            <label>
              {def.choice.label}{' '}
              <select value={det.choice ?? ''} onChange={(e) => commit(setChoice(state, det.id, e.target.value))}>
                {def.choice.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          )}
          {def.kind !== 'Primary' && (
            <button className="link danger" onClick={() => { commit(removeDetachment(state, det.id), `Removed ${def.name}`); props.setSel(null); }}>
              Remove
            </button>
          )}
        </div>
      </header>
      {errs.map((e, i) => (
        <p key={i} className="det-err">
          {splitMessage(e.message).what} <small>Rule: {splitMessage(e.message).rule}</small>
        </p>
      ))}
      <div className="slots">
        {slots.map((s) => (
          <SlotChip key={s.id} det={det} slot={s} props={props} />
        ))}
      </div>
      {(() => {
        // Benefit slots (Pride of the Legion: a Heavy Transport per filled Retinue/Heavy Assault/Elites slot…).
        const xs = def.primaryRules?.extraSlots;
        const room = xs && benefitAllowance(state, det);
        if (!xs || !room) return null;
        const per = xs.perFilledRoles ? `filled ${xs.perFilledRoles.map(roleLabel).join('/')} slot` : 'non-Vehicle unit in the army';
        return (
          <div className="benefit-slots">
            <span className="hint">
              {def.name}: one extra {xs.roles.map(roleLabel).join(' or ')} slot per {per} · {room.used} of {room.allowed} added
            </span>
            {room.used < room.allowed &&
              xs.roles.map((r) => (
                <button key={r} className="ghost" onClick={() => commit(addBenefitSlot(state, det.id, r), `Added an extra ${roleLabel(r)} slot to ${def.name}`)}>
                  + Add {roleLabel(r)} slot
                </button>
              ))}
          </div>
        );
      })()}
      {unlockers.length > 0 && (
        <div className="unlocks">
          {unlockers.map((s) => {
            const fill = fillOf(det, s.id)!;
            const unitName = unitDefs.get(fill.unit!.unitId)?.name ?? '';
            const kids = childrenOf(state.roster, det.id, s.id);
            const allowance = unlockAllowance(det, s);
            const special = fill.primeAdvantage === 'special-assignment';
            const unlockSel = props.sel?.kind === 'unlock' && props.sel.detId === det.id && props.sel.slotId === s.id;
            return (
              <div key={s.id} className="unlock">
                <div className="connector">
                  <span aria-hidden>↳</span> {unitName} in <strong>{slotLabel(det, s)}</strong>{' '}
                  {unlockSummary(det, s, kids.length)}
                </div>
                {kids.map((k) => (
                  <DetachmentCard key={k.id} det={k} depth={depth + 1} props={props} />
                ))}
                {kids.length < allowance && !special && (
                  <button className={`ghost ${unlockSel ? 'selected' : ''}`} aria-pressed={unlockSel} onClick={() => props.setSel({ kind: 'unlock', detId: det.id, slotId: s.id })}>
                    + Unlock {kids.length ? 'another' : 'a'} detachment
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function AddBar({ props }: { props: Props }) {
  const { state, commit } = props;
  const options = useMemo(
    () =>
      CATALOG.detachments
        .filter((d) => (d.kind === 'Warlord' || d.kind === 'LordOfWar' || d.kind === 'Allied') && forPrimaryLegion(d, state.primaryLegion) && forArmyList(d, state.roster.detachments[0]?.armyList ?? 'legiones-astartes'))
        .map((d) => ({ def: d, reasons: detachmentReasons(state, d.id) })),
    [state],
  );
  return (
    <section className="addbar" aria-label="Detachments you can always consider">
      <h3>Other detachments</h3>
      <p className="hint">These don't need a Command slot. Each shows why it's locked, if it is.</p>
      <ul>
        {options.map(({ def, reasons }) => {
          const locked = reasons.length > 0;
          const id = `add-${def.id}-why`;
          return (
            <li key={def.id}>
              <button
                aria-disabled={locked}
                aria-describedby={locked ? id : undefined}
                className={locked ? 'locked' : ''}
                onClick={() => {
                  if (locked) return;
                  const r = addDetachment(state, def.id);
                  commit(r.state, `Added ${def.name}`);
                }}
              >
                {locked ? '🔒 ' : '+ '}
                {def.name}
              </button>
              {locked && (
                <span id={id} className="why">
                  {splitMessage(reasons[0]!.message).what}
                  {reasons.length > 1 && <span className="more"> (+{reasons.length - 1} more)</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Chart(props: Props) {
  const roots = props.state.roster.detachments.filter((d) => !d.unlockedBy);
  const order = ['Primary', 'Warlord', 'LordOfWar', 'Allied'];
  roots.sort((a, b) => order.indexOf(detDefs.get(a.defId)?.kind ?? '') - order.indexOf(detDefs.get(b.defId)?.kind ?? ''));
  const orphans = props.state.roster.detachments.filter((d) => d.unlockedBy && !props.state.roster.detachments.some((p) => p.id === d.unlockedBy!.detachmentId));
  return (
    <section className="chart" aria-label="Force Organisation chart">
      {roots.map((d) => (
        <DetachmentCard key={d.id} det={d} depth={0} props={props} />
      ))}
      {orphans.map((d) => (
        <DetachmentCard key={d.id} det={d} depth={0} props={props} />
      ))}
      <AddBar props={props} />
    </section>
  );
}
