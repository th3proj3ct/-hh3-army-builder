import { useMemo, useState } from 'react';
import { CATALOG } from '../../src/catalog';
import type { UnitDef } from '../../src/model';
import { roleLabel } from '../../src/validate';
import { EyeButton } from './datasheet';
import { ROLE_ORDER, detachmentsFor, howAvailable } from './fits';
import { FACTIONS, armyListOf, type BuilderState } from './state';
import { RoleIcon } from './RoleIcon';

/** Unit lookup: every unit grouped by Battlefield Role, with where it can go. */
export function Reference({ state }: { state: BuilderState }) {
  const [q, setQ] = useState('');
  const [legion, setLegion] = useState<string>(state.primaryLegion);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOG.units.filter(
      (u) =>
        (legion === 'all' || u.factionTrait === legion || (u.factionTrait === null && u.armyList === armyListOf(legion))) &&
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
            <option value="all">All Factions</option>
            {FACTIONS.map((l) => (
              <option key={l} value={l}>
                {armyListOf(l) === 'legiones-astartes' ? `Generic + ${l}` : l}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setClosed(new Set(ROLE_ORDER))}>Collapse all</button>
        <button onClick={() => setClosed(new Set())}>Expand all</button>
        <label className="check">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show detachments for every unit
        </label>
      </div>
      <p className="hint">
        {visible.length} units. Hover a unit (or use "Fits in…") to see which detachments have a slot for it. Use the eye to open the datasheet.
      </p>
      {groups.map(({ role, units }) => (
        <details key={role} className="ref-group" open={searching || !closed.has(role)} onToggle={(e) => !searching && toggle(role, (e.target as HTMLDetailsElement).open)}>
          <summary>
            <RoleIcon role={role} size={40} /> <h2>{roleLabel(role)}</h2> <span className="count">{units.length}</span>
          </summary>
          <ul className="ref-list">
            {units.map((u) => (
              <RefRow key={u.id} u={u} state={state} showAll={showAll} />
            ))}
          </ul>
        </details>
      ))}
      {!groups.length && <p className="hint">No units match "{q}".</p>}
    </section>
  );
}

function RefRow({ u, state, showAll }: { u: UnitDef; state: BuilderState; showAll: boolean }) {
  const fits = detachmentsFor(u);
  const faction = u.factionTrait ?? (state.primaryLegion || undefined);
  const [pinned, setPinned] = useState(false);
  const open = showAll || pinned;
  const fitsId = `fits-${u.id}`;
  return (
    <li className={`ref-row ${open ? 'open' : ''}`}>
      <div className="ref-main">
        <EyeButton unitId={u.id} {...(faction ? { faction } : {})} allegiance={state.roster.allegiance} showFits />
        <RoleIcon role={u.role} size={32} title />
        <span className="unit-name">{u.name}</span>
        {u.factionTrait && <span className="tag">{u.factionTrait}</span>}
        {u.allegiance !== 'Any' && <span className="tag">{u.allegiance}</span>}
        <span className="pick-pts">
          {u.points.base}
          {u.points.maxModels > u.points.minModels ? '+' : ''} pts
        </span>
        {fits.length > 0 && !showAll && (
          <button className="fits-toggle" aria-expanded={pinned} aria-controls={fitsId} onClick={() => setPinned((p) => !p)}>
            Fits in {fits.length} {pinned ? '▴' : '▾'}
          </button>
        )}
      </div>
      <div className="ref-fits" id={fitsId}>
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
