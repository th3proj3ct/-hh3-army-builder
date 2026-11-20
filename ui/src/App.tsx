import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATALOG } from '../../src/catalog';
import type { Issue } from '../../src/model';
import { validate } from '../../src/validate';
import { Chart } from './Chart';
import { DatasheetProvider } from './datasheet';
import { Reference } from './Reference';
import { Panel } from './Panel';
import { PointsBar } from './PointsBar';
import { deathGuardSample } from './samples';
import { FACTIONS, armyListOf, emptyState, load, save, setPrimaryLegion, type BuilderState } from './state';
import { THEMES, applyTheme, loadTheme, type Theme } from './theme';

const THEME_LABEL: Record<Theme, string> = { auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark' };

export type Selection =
  | { kind: 'slot'; detId: string; slotId: string }
  | { kind: 'unlock'; detId: string; slotId: string }
  | null;

interface History {
  past: BuilderState[];
  present: BuilderState;
  future: BuilderState[];
}

export function App() {
  const [hist, setHist] = useState<History>(() => ({ past: [], present: load() ?? deathGuardSample(), future: [] }));
  const [sel, setSel] = useState<Selection>(null);
  const [announce, setAnnounce] = useState('');
  const [view, setView] = useState<'builder' | 'reference'>('builder');
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const nextTheme = () => {
    const t = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
    applyTheme(t);
    setTheme(t);
  };
  const state = hist.present;
  const result = useMemo(() => validate(state.roster, CATALOG), [state]);

  useEffect(() => save(state), [state]);

  const commit = useCallback((next: BuilderState, message?: string) => {
    setHist((h) => ({ past: [...h.past.slice(-99), h.present], present: next, future: [] }));
    if (message) setAnnounce(message);
  }, []);
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future] } : h)), []);
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) } : h)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const issuesAt = useCallback(
    (detId: string, slotId?: string): Issue[] => result.errors.filter((e) => e.at?.detachmentId === detId && (slotId ? e.at.slotId === slotId : !e.at.slotId)),
    [result],
  );

  const showMe = (e: Issue) => {
    if (e.at?.detachmentId && e.at.slotId) setSel({ kind: 'slot', detId: e.at.detachmentId, slotId: e.at.slotId });
    const el = document.getElementById(e.at?.slotId ? `slot-${e.at.detachmentId}-${e.at.slotId}` : `det-${e.at?.detachmentId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus();
  };

  const r = state.roster;
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${r.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <DatasheetProvider>
    <div className="app">
      <header className="topbar">
        <h1>HH3 Army Builder</h1>
        <nav className="tabs" aria-label="View">
          <button aria-current={view === 'builder' ? 'page' : undefined} className={view === 'builder' ? 'active' : ''} onClick={() => setView('builder')}>
            Builder
          </button>
          <button aria-current={view === 'reference' ? 'page' : undefined} className={view === 'reference' ? 'active' : ''} onClick={() => setView('reference')}>
            Unit reference
          </button>
        </nav>
        <div className="settings">
          <label>
            Faction
            <select
              value={state.primaryLegion}
              onChange={(e) => {
                const to = e.target.value;
                const fresh = armyListOf(to) !== armyListOf(state.primaryLegion);
                commit(setPrimaryLegion(state, to), fresh ? `Started a new ${to} list (different army list; Undo brings the old one back)` : `Primary Legion set to ${to}`);
                if (fresh) setSel(null);
              }}
            >
              <optgroup label="Legiones Astartes">
                {FACTIONS.filter((f) => armyListOf(f) === 'legiones-astartes').map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </optgroup>
              <optgroup label="Other army lists">
                {FACTIONS.filter((f) => armyListOf(f) !== 'legiones-astartes').map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <label>
            Allegiance
            <select value={r.allegiance} onChange={(e) => commit({ ...state, roster: { ...r, allegiance: e.target.value as 'Loyalist' | 'Traitor' } })}>
              <option>Traitor</option>
              <option>Loyalist</option>
            </select>
          </label>
          <label>
            Points limit
            <input
              type="number"
              min={500}
              step={250}
              value={r.pointsLimit}
              onChange={(e) => commit({ ...state, roster: { ...r, pointsLimit: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={r.missionId === 'core'}
              onChange={(e) => {
                const { missionId: _drop, ...rest } = r;
                commit({ ...state, roster: e.target.checked ? { ...rest, missionId: 'core' } : rest });
              }}
            />
            Core Mission
          </label>
        </div>
        <div className="actions">
          <button onClick={undo} disabled={!hist.past.length} title="Undo (Ctrl+Z)">Undo</button>
          <button onClick={redo} disabled={!hist.future.length} title="Redo (Ctrl+Shift+Z)">Redo</button>
          <button onClick={() => { commit(emptyState(state.primaryLegion, r.pointsLimit, r.allegiance), 'New empty list'); setSel(null); }}>New list</button>
          <button onClick={() => { commit(deathGuardSample(), 'Loaded the Death Guard sample'); setSel(null); }}>Death Guard sample</button>
          <button onClick={exportJson}>Export JSON</button>
          <button
            onClick={nextTheme}
            title={`Theme: ${theme === 'auto' ? 'follows your device' : theme}. Click for ${THEME_LABEL[THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!].slice(2)}.`}
            aria-label={`Theme: ${THEME_LABEL[theme].slice(2)}. Change theme`}
          >
            {THEME_LABEL[theme]}
          </button>
        </div>
      </header>

      <PointsBar result={result} limit={r.pointsLimit} onShow={showMe} />

      {view === 'builder' ? (
        <main className="layout">
          <Chart state={state} result={result} sel={sel} setSel={setSel} commit={commit} issuesAt={issuesAt} />
          <Panel state={state} sel={sel} setSel={setSel} commit={commit} issuesAt={issuesAt} />
        </main>
      ) : (
        <main className="ref-layout">
          <Reference state={state} />
        </main>
      )}

      <footer className="foot">
        Data: BSData {CATALOG.version.replace('bsdata-', '')} · rules: Age of Darkness Rulebook v1.2 · test points checked against Wahapedia for 14 units.
      </footer>
      <div className="sr-only" aria-live="polite">
        {announce} {`${result.totals.points} of ${r.pointsLimit} points. ${result.legal ? 'Legal.' : `${result.errors.length} problems.`}`}
      </div>
    </div>
    </DatasheetProvider>
  );
}
