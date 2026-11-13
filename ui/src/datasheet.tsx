import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { UnitInstance } from '../../src/model';
import { unitPoints } from '../../src/points';
import { roleLabel } from '../../src/validate';
import { detachmentsFor, howAvailable } from './fits';
import { unitDefs } from './state';

interface Datasheet {
  models: { name: string; min: number; max: number; profile: Record<string, string> }[];
  wargear: { model: string; items: string[] }[];
  weapons: { name: string; kind: 'Ranged' | 'Melee'; stats: Record<string, string> }[];
  rules: { name: string; summary: string }[];
  traits: string[];
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
  const ranged = sheet?.weapons.filter((w) => w.kind === 'Ranged') ?? [];
  const melee = sheet?.weapons.filter((w) => w.kind === 'Melee') ?? [];
  const keysOf = (rows: { stats: Record<string, string> }[]) => [...new Set(rows.flatMap((r) => Object.keys(r.stats)))];

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="sheet-title">
      <div className="sheet-body">
        <header className="sheet-head">
          <div>
            <span className="kind">{roleLabel(def.role)}</span>
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
            {sheet.wargear.some((w) => w.items.length) && (
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
            {sheet.rules.length > 0 && (
              <section>
                <h3>Special rules</h3>
                <dl className="rules">
                  {sheet.rules.map((r) => (
                    <div key={r.name}>
                      <dt>{r.name}</dt>
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
