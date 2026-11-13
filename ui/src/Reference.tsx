import { useMemo, useState } from 'react';
import { CATALOG } from '../../src/catalog';
import type { UnitDef } from '../../src/model';
import { roleLabel } from '../../src/validate';
import { EyeButton } from './datasheet';
import { ROLE_ORDER, detachmentsFor, howAvailable } from './fits';
import { LEGIONS, type BuilderState } from './state';

/** Unit lookup: every unit grouped by Battlefield Role, with where it can go. */
export function Reference({ state }: { state: BuilderState }) {
  const [q, setQ] = useState('');
  const [legion, setLegion] = useState<string>(state.primaryLegion);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOG.units.filter(
      (u) =>
        (legion === 'all' || u.factionTrait === null || u.factionTrait === legion) &&
        (!needle || u.name.toLowerCase().includes(needle) || roleLabel(u.role).toLowerCase().includes(needle)),
    );
  }, [q, legion]);

  const groups = ROLE_ORDER.map((role) => ({ role, units: visible.filter((u) => u.role === role).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.units.length);
  const searching = q.trim().length > 0;
  const toggle = (role: string, open: boolean) =>
    setClosed((c) => {
      const n = new Set(c);
      open ? n.delete(role) : n.add(role);
      return n;
    });

  return (
    <section className="reference" aria-label="Unit reference">
      <div className="ref-tools">
        <input type="search" className="search" placeholder="Search units or roles (e.g. Saturnine, Recon)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search units" />
        <label>
          Show{' '}
          <select value={legion} onChange={(e) => setLegion(e.target.value)}>
            <option value="all">All Legions</option>
            {LEGIONS.map((l) => (
              <option key={l} value={l}>
                Generic + {l}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setClosed(new Set(ROLE_ORDER))}>Collapse all</button>
        <button onClick={() => setClosed(new Set())}>Expand all</button>
      </div>
      <p className="hint">
        {visible.length} units. Each row lists the detachments with a slot it can fill. Use the eye to open the datasheet.
      </p>
      {groups.map(({ role, units }) => (
        <details key={role} className="ref-group" open={searching || !closed.has(role)} onToggle={(e) => !searching && toggle(role, (e.target as HTMLDetailsElement).open)}>
          <summary>
            <h2>{roleLabel(role)}</h2> <span className="count">{units.length}</span>
          </summary>
          <ul className="ref-list">
            {units.map((u) => (
              <RefRow key={u.id} u={u} state={state} />
            ))}
          </ul>
        </details>
      ))}
      {!groups.length && <p className="hint">No units match "{q}".</p>}
    </section>
  );
}

function RefRow({ u, state }: { u: UnitDef; state: BuilderState }) {
  const fits = detachmentsFor(u);
  const faction = u.factionTrait ?? (state.primaryLegion || undefined);
  return (
    <li className="ref-row">
      <div className="ref-main">
        <EyeButton unitId={u.id} {...(faction ? { faction } : {})} allegiance={state.roster.allegiance} />
        <span className="unit-name">{u.name}</span>
        {u.factionTrait && <span className="tag">{u.factionTrait}</span>}
        {u.allegiance !== 'Any' && <span className="tag">{u.allegiance}</span>}
        <span className="pick-pts">
          {u.points.base}
          {u.points.maxModels > u.points.minModels ? '+' : ''} pts
        </span>
      </div>
      <div className="ref-fits">
        {fits.length ? (
          fits.map((f, i) => {
            const only = f.def.requirements.find((r) => r.kind === 'primaryFaction');
            return (
              <span key={`${f.def.id}-${i}`} className={`fit kind-${f.def.kind}`} title={`${f.def.kind}: ${f.slots} slot(s)${f.note ? `, ${f.note}` : ''} — ${howAvailable(f.def)}`}>
                {f.def.name}
                {f.note?.startsWith('via') ? ' (Special Assignment)' : f.note ? ` (${f.note})` : ''}
                {only && only.kind === 'primaryFaction' ? ` · ${only.factions.join('/')} only` : ''}
              </span>
            );
          })
        ) : (
          <span className="hint">No detachment in this data set has a slot for it yet.</span>
        )}
      </div>
    </li>
  );
}
