import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { OptionDef, UnitInstance } from '../../src/model';
import { unitPoints } from '../../src/points';
import { roleLabel } from '../../src/validate';
import { detachmentsFor, howAvailable } from './fits';
import { unitDefs } from './state';
import { RoleIcon } from './RoleIcon';

interface Datasheet {
  models: { name: string; min: number; max: number; profile: Record<string, string> }[];
  wargear: { model: string; items: string[] }[];
  weapons: { name: string; kind: 'Ranged' | 'Melee'; stats: Record<string, string>; legions?: string[] }[];
  rules: { name: string; summary: string; legions?: string[]; whenSelected?: string; variants?: { when: string; name: string }[]; otherwise?: string }[];
  traits: string[];
  items?: Record<string, string[]>;
}

// Datasheets are display-only and large, so they load on first use (own bundle chunk).
let cache: Promise<Record<string, Datasheet>> | null = null;
const loadDatasheets = () =>
  (cache ??= import('../../data/bsdata/datasheets.json').then((m) => (m.default as unknown as { datasheets: Record<string, Datasheet> }).datasheets));

export interface DatasheetRequest {
  unitId: string;
  /** The unit as built in the list, if any (shows its models, options and Legion). */
  inst?: UnitInstance;
  /** Legion to show for "[Legiones Astartes]" units not yet in the list. */
  faction?: string;
  allegiance?: string;
}

const Ctx = createContext<(r: DatasheetRequest) => void>(() => {});
export const useDatasheet = () => useContext(Ctx);

export function DatasheetProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<DatasheetRequest | null>(null);
  return (
    <Ctx.Provider value={setReq}>
      {children}
      {req && <DatasheetDialog req={req} onClose={() => setReq(null)} />}
    </Ctx.Provider>
  );
}

export function EyeButton({ unitId, inst, faction, allegiance, label }: DatasheetRequest & { label?: string }) {
  const open = useDatasheet();
  const name = unitDefs.get(unitId)?.name ?? unitId;
  return (
    <button
      type="button"
      className="eye"
      aria-label={`View datasheet: ${name}`}
      title="View datasheet"
      onClick={(e) => {
        e.stopPropagation();
        open({ unitId, ...(inst ? { inst } : {}), ...(faction ? { faction } : {}), ...(allegiance ? { allegiance } : {}) });
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="currentColor" />
      </svg>
      {label && <span>{label}</span>}
    </button>
  );
}

/**
 * Work out what a built unit carries: each model type's default kit, minus items swapped
 * out by exchange options, plus every option taken. Returns display lines and the set of
 * weapon profile names in use.
 */
function buildLoadout(sheet: Datasheet, options: OptionDef[], inst: UnitInstance) {
  const optById = new Map(options.map((o) => [o.id, o]));
  // Model counts: each type at its minimum, extra models go to the first variable type.
  let spare = Math.max(0, inst.models - sheet.models.reduce((s, m) => s + m.min, 0));
  const counts = new Map<string, number>();
  for (const m of sheet.models) {
    const extra = m.max > m.min ? Math.min(spare, m.max - m.min) : 0;
    spare -= extra;
    counts.set(m.name, m.min + extra);
  }
  const unitKit = sheet.wargear.find((w) => w.model === 'Unit')?.items ?? [];
  const lines = sheet.models.map((m) => {
    const n = counts.get(m.name) ?? 0;
    const kit = new Map<string, number>();
    for (const it of [...(sheet.wargear.find((w) => w.model === m.name)?.items ?? []), ...unitKit]) kit.set(it, n);
    for (const sel of inst.options) {
      const o = optById.get(sel.optionId);
      if (!o?.display || (o.display.model ?? m.name) !== m.name) continue;
      kit.set(o.display.item, (kit.get(o.display.item) ?? 0) + sel.count);
      const swapped = o.display.replaces && [...kit.keys()].find((k) => k.toLowerCase() === o.display!.replaces!.toLowerCase());
      if (swapped) kit.set(swapped, Math.max(0, (kit.get(swapped) ?? 0) - sel.count));
    }
    const items = [...kit.entries()].filter(([, c]) => c > 0).map(([it, c]) => (c === n ? it : `${c}× ${it}`));
    return { model: m.name, count: n, items, kit };
  });
  // Unit-level options (no model), e.g. vehicle upgrades.
  const unitLevel = inst.options
    .map((sel) => ({ sel, o: optById.get(sel.optionId) }))
    .filter((x) => x.o?.display && !x.o.display.model && !sheet.models.some((m) => m.name === x.o!.display!.model));
  if (unitLevel.length && sheet.models.length > 1)
    lines.push({ model: 'Unit upgrades', count: 1, items: unitLevel.map((x) => `${x.sel.count > 1 ? `${x.sel.count}× ` : ''}${x.o!.display!.item}`), kit: new Map(unitLevel.map((x) => [x.o!.display!.item, x.sel.count])) });
  else if (unitLevel.length && lines[0]) {
    for (const x of unitLevel) lines[0].kit.set(x.o!.display!.item, x.sel.count);
    lines[0].items = [...lines[0].kit.entries()].filter(([, c]) => c > 0).map(([it, c]) => (c === lines[0]!.count ? it : `${c}× ${it}`));
  }
  const weapons = new Set<string>();
  const carriedItems = new Set<string>();
  for (const l of lines)
    for (const [it, c] of l.kit)
      if (c > 0) {
        carriedItems.add(it.toLowerCase());
        for (const w of sheet.items?.[it] ?? [it]) weapons.add(w);
      }
  return { lines: lines.filter((l) => l.count > 0 || l.items.length), weapons, carriedItems };
}

function StatTable({ rows, keys, first }: { rows: { name: string; stats: Record<string, string> }[]; keys: string[]; first: string }) {
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead>
          <tr>
            <th scope="col">{first}</th>
            {keys.map((k) => (
              <th key={k} scope="col">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">{r.name}</th>
              {keys.map((k) => (
                <td key={k}>{r.stats[k] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DatasheetDialog({ req, onClose }: { req: DatasheetRequest; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [sheets, setSheets] = useState<Record<string, Datasheet> | null>(null);
  const [failed, setFailed] = useState(false);
  const def = unitDefs.get(req.unitId);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    loadDatasheets().then(setSheets, () => setFailed(true));
  }, []);

  if (!def) return null;
  const sheet = sheets?.[def.id];
  const faction = req.inst?.factionTrait ?? def.factionTrait ?? req.faction;
  const allegiance = def.allegiance !== 'Any' ? def.allegiance : req.allegiance;
  const traits = (sheet?.traits ?? []).map((t) => (t === '[Legiones Astartes]' && faction ? faction : t === '[Allegiance]' && allegiance ? allegiance : t));
  const optionNames = new Map(def.options.map((o) => [o.id, o]));
  const fits = detachmentsFor(def);
  // Legion armoury weapons show only for that Legion (tagged when no Legion is known).
  // As built: only the weapons this unit actually carries (defaults minus exchanges, plus options taken).
  const loadout = sheet && req.inst ? buildLoadout(sheet, def.options, req.inst) : null;
  const inUse = (original: string) => !loadout || loadout.weapons.has(original);
  const rowsWithOriginal = (sheet?.weapons ?? [])
    .filter((w) => !w.legions?.length || !faction || w.legions.includes(faction))
    .map((w) => ({ original: w.name, row: w.legions?.length ? { ...w, name: `${w.name} (${w.legions.join('/')} armoury)` } : w }));
  const carried = rowsWithOriginal.filter((x) => inUse(x.original)).map((x) => x.row);
  const notCarried = loadout ? rowsWithOriginal.filter((x) => !loadout.weapons.has(x.original)).map((x) => x.row) : [];
  const ranged = carried.filter((w) => w.kind === 'Ranged');
  const melee = carried.filter((w) => w.kind === 'Melee');
  // Rules: drop other Legions' rules; rules granted by an option show only once it's taken
  // (on the general sheet they're listed with that condition).
  // Options taken, plus the unit's sub-faction (some rule values depend on it, e.g. Bulky with Myrmidax).
  const sub = req.inst?.subFaction ?? def.subFaction;
  const taken = new Set([
    ...((req.inst?.options ?? []).map((s) => def.options.find((o) => o.id === s.optionId)?.display?.item?.toLowerCase()).filter(Boolean) as string[]),
    ...(req.inst && sub ? [sub.toLowerCase()] : []),
  ]);
  const ruleRows = (sheet?.rules ?? [])
    .filter((r) => !r.legions?.length || !faction || r.legions.includes(faction))
    .filter((r) => !r.whenSelected || !req.inst || taken.has(r.whenSelected.toLowerCase()))
    .map((r) => {
      if (!r.variants?.length) return r;
      // As built: pick the variant for what the unit carries (an option taken beats the default kit).
      if (loadout) {
        const pick = r.variants.find((v) => taken.has(v.when.toLowerCase())) ?? r.variants.find((v) => loadout.carriedItems.has(v.when.toLowerCase()));
        if (pick) return { ...r, name: pick.name };
        if (r.otherwise) return { ...r, name: r.otherwise };
      }
      const value = (n: string) => n.match(/\(([^)]*)\)$/)?.[1] ?? n;
      const parts = [...r.variants.map((v) => `${value(v.name)} with ${v.when}`), ...(r.otherwise ? [`otherwise ${value(r.otherwise)}`] : [])];
      return { ...r, name: `${r.name.replace(/\s*\(X\)$/, '')} (${parts.join(', ')})` };
    });
  const keysOf = (rows: { stats: Record<string, string> }[]) => [...new Set(rows.flatMap((r) => Object.keys(r.stats)))];

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="sheet-title">
      <div className="sheet-body">
        <header className="sheet-head">
          <div>
            <span className="kind"><RoleIcon role={def.role} size={36} /> {roleLabel(def.role)}</span>
            <h2 id="sheet-title">{def.name}</h2>
            <p className="unit-sub">
              {def.points.base} pts for {def.points.minModels} model{def.points.minModels > 1 ? 's' : ''}
              {def.points.maxModels > def.points.minModels ? ` · up to ${def.points.maxModels} at +${def.points.perExtraModel} each` : ''}
              {req.inst ? ` · as built: ${req.inst.models} models, ${unitPoints(req.inst, def)} pts` : ''}
            </p>
            <p className="tags">
              {[faction ?? 'Any Legion', allegiance ?? 'Any Allegiance', ...def.modelTags].map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </p>
          </div>
          <button className="link close" onClick={() => ref.current?.close()} aria-label="Close datasheet">✕ Close</button>
        </header>

        {failed && <p className="det-err">Couldn't load datasheet details.</p>}
        {!sheet && !failed && <p className="hint">Loading datasheet…</p>}
        {sheet && (
          <>
            {sheet.models.length > 0 && (
              <section>
                <h3>Models</h3>
                <StatTable first="Model" rows={sheet.models.map((m) => ({ name: m.min === m.max ? `${m.name} (${m.min})` : `${m.name} (${m.min}–${m.max})`, stats: m.profile }))} keys={keysOf(sheet.models.map((m) => ({ stats: m.profile })))} />
              </section>
            )}
            {loadout && (
              <section>
                <h3>Wargear as built</h3>
                <ul className="plain">
                  {loadout.lines.map((l) => (
                    <li key={l.model}>
                      <strong>{l.model}{l.count > 1 ? ` ×${l.count}` : ''}:</strong> {l.items.join(', ') || '—'}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!loadout && sheet.wargear.some((w) => w.items.length) && (
              <section>
                <h3>Wargear</h3>
                <ul className="plain">
                  {sheet.wargear.filter((w) => w.items.length).map((w) => (
                    <li key={w.model}><strong>{w.model}:</strong> {w.items.join(', ')}</li>
                  ))}
                </ul>
              </section>
            )}
            {ranged.length > 0 && (
              <section>
                <h3>Ranged weapons</h3>
                <StatTable first="Weapon" rows={ranged} keys={keysOf(ranged)} />
              </section>
            )}
            {melee.length > 0 && (
              <section>
                <h3>Melee weapons</h3>
                <StatTable first="Weapon" rows={melee} keys={keysOf(melee)} />
              </section>
            )}
            {notCarried.length > 0 && (
              <details className="other-weapons">
                <summary>Other weapons this unit could take ({notCarried.length})</summary>
                {(['Ranged', 'Melee'] as const).map((k) => {
                  const rows = notCarried.filter((w) => w.kind === k);
                  return rows.length ? (
                    <section key={k}>
                      <h3>{k}</h3>
                      <StatTable first="Weapon" rows={rows} keys={keysOf(rows)} />
                    </section>
                  ) : null;
                })}
              </details>
            )}
            {ruleRows.length > 0 && (
              <section>
                <h3>Special rules</h3>
                <dl className="rules">
                  {ruleRows.map((r) => (
                    <div key={r.name}>
                      <dt>
                        {r.name}
                        {r.whenSelected && !req.inst && <span className="tag"> only if {r.whenSelected} is taken</span>}
                        {r.legions?.length ? <span className="tag"> {r.legions.join('/')} only</span> : null}
                      </dt>
                      {r.summary && <dd>{r.summary}</dd>}
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {traits.length > 0 && <p className="hint">Traits: {traits.join(', ')}</p>}
          </>
        )}

        {req.inst && req.inst.options.length > 0 && (
          <section>
            <h3>Options taken</h3>
            <ul className="plain">
              {req.inst.options.map((o) => (
                <li key={o.optionId}>{o.count}× {optionNames.get(o.optionId)?.name ?? o.optionId} (+{(optionNames.get(o.optionId)?.cost.points ?? 0) * o.count} pts)</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3>Fits in these detachments</h3>
          <ul className="plain fits">
            {fits.map((f, i) => (
              <li key={`${f.def.id}-${i}`}>
                <strong>{f.def.name}</strong> <span className="tag">{f.def.kind}</span> — {f.slots} {roleLabel(f.note?.startsWith('via') ? 'Command' : def.role)} slot{f.slots > 1 ? 's' : ''}
                {f.prime ? ` (${f.prime}★ Prime)` : ''}
                {f.note ? `, ${f.note}` : ''}
                <br />
                <small className="hint">{howAvailable(f.def)}</small>
              </li>
            ))}
            {!fits.length && <li className="hint">No detachment in this data set has a slot for this unit yet.</li>}
          </ul>
        </section>
        <p className="hint">Source: BSData {def.source.version}. Stats and points are for reference; check the book in a dispute.</p>
      </div>
    </dialog>
  );
}
