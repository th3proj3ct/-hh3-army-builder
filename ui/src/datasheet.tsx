import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { UnitInstance } from '../../src/model';
import { buildLoadout, loadDatasheets, loadGlossary, lookupRule, splitRules, type Datasheet, type Glossary } from './loadout';
import { unitPoints } from '../../src/points';
import { roleLabel } from '../../src/validate';
import { detachmentsFor, howAvailable } from './fits';
import { unitDefs } from './state';
import { RoleIcon } from './RoleIcon';



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

// ── special-rule hover text ────────────────────────────────────────────────
interface Tip { name: string; text: string; x?: string; rect: DOMRect }
const TipCtx = createContext<{ glossary: Glossary; show: (t: Tip) => void; hide: () => void }>({ glossary: {}, show: () => {}, hide: () => {} });

/** A rule name that shows the rule's full text on hover, keyboard focus or tap. */
function RuleName({ name }: { name: string }) {
  const { glossary, show, hide } = useContext(TipCtx);
  const rule = lookupRule(glossary, name);
  if (!rule) return <>{name}</>;
  const open = (e: { currentTarget: HTMLElement }) => show({ ...rule, rect: e.currentTarget.getBoundingClientRect() });
  return (
    <span className="rule-tip" tabIndex={0} role="button" aria-label={`${name}: show rule`} onMouseEnter={open} onFocus={open} onMouseLeave={hide} onBlur={hide} onClick={(e) => { e.stopPropagation(); open(e); }}>
      {name}
    </span>
  );
}
/** A weapon's "Special Rules" cell: each rule hoverable, commas kept. */
function RuleList({ text }: { text: string }) {
  const parts = splitRules(text);
  if (!parts.length) return <>{text}</>;
  return <>{parts.map((p, i) => <span key={i}>{i ? ', ' : ''}<RuleName name={p} /></span>)}</>;
}
/** The pop-up itself: under the rule (or above it, near the bottom of the screen), kept on screen. */
function RulePopup({ tip, keep, hide }: { tip: Tip; keep: () => void; hide: () => void }) {
  const w = Math.min(380, window.innerWidth - 16);
  const left = Math.max(8, Math.min(tip.rect.left, window.innerWidth - w - 8));
  const below = tip.rect.bottom + 6;
  const above = window.innerHeight - tip.rect.top + 6;
  const roomBelow = window.innerHeight - below;
  const style = roomBelow > 220 || roomBelow > tip.rect.top ? { left, top: below, width: w, maxHeight: roomBelow - 8 } : { left, bottom: above, width: w, maxHeight: tip.rect.top - 14 };
  return (
    // Moving onto the pop-up keeps it open, so long rules can be scrolled.
    <div className="rule-pop" role="tooltip" style={style} onMouseEnter={keep} onMouseLeave={hide} onClick={(e) => e.stopPropagation()}>
      <strong>{tip.name}</strong>
      {tip.x && <span className="rule-x"> · X = {tip.x}</span>}
      <p>{tip.text}</p>
    </div>
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
                <td key={k}>{k === 'Special Rules' ? <RuleList text={r.stats[k] ?? ''} /> : r.stats[k] ?? ''}</td>
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
  const [glossary, setGlossary] = useState<Glossary>({});
  const [tip, setTip] = useState<Tip | null>(null);
  // Leaving a rule name hides the pop-up after a moment, unless the pointer moved onto it.
  const hideTimer = useRef<number | undefined>(undefined);
  const showTip = (t: Tip) => { window.clearTimeout(hideTimer.current); setTip(t); };
  const hideTip = () => { window.clearTimeout(hideTimer.current); hideTimer.current = window.setTimeout(() => setTip(null), 150); };
  const keepTip = () => window.clearTimeout(hideTimer.current);
  const def = unitDefs.get(req.unitId);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    loadDatasheets().then(setSheets, () => setFailed(true));
    loadGlossary().then(setGlossary, () => {});
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
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => { setTip(null); if (e.target === ref.current) ref.current?.close(); }} onScroll={() => setTip(null)} aria-labelledby="sheet-title">
      <TipCtx.Provider value={{ glossary, show: showTip, hide: hideTip }}>
      {tip && <RulePopup tip={tip} keep={keepTip} hide={hideTip} />}
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
                        <RuleName name={r.name} />
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
      </TipCtx.Provider>
    </dialog>
  );
}
