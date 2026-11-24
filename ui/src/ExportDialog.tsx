import { useEffect, useRef, useState } from 'react';
import { loadDatasheets, type Datasheet } from './loadout';
import { rosterText } from './rosterText';
import type { BuilderState } from './state';

/**
 * Export pop-up: the list as NewRecruit-style text to copy or download, plus the raw JSON
 * (the builder's own save format) as a secondary download.
 */
export function ExportDialog({ state, onClose }: { state: BuilderState; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [sheets, setSheets] = useState<Record<string, Datasheet> | null | 'loading'>('loading');
  const [copied, setCopied] = useState<'' | 'ok' | 'failed'>('');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // Wargear lines need the datasheets; without them the export lists options only.
    loadDatasheets().then(setSheets, () => setSheets(null));
  }, []);

  const text = sheets === 'loading' ? '' : rosterText(state, sheets);
  const file = state.roster.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'army';

  const download = (content: string, type: string, ext: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = `${file}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      // Clipboard can be blocked (permissions, insecure page): select the text so Ctrl+C works.
      const ta = ref.current?.querySelector('textarea');
      ta?.focus();
      ta?.select();
      setCopied('failed');
    }
  };

  return (
    <dialog ref={ref} className="sheet export" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="export-title">
      <div className="sheet-body">
        <header className="sheet-head">
          <h2 id="export-title">Export list</h2>
          <button className="link" onClick={() => ref.current?.close()}>✕ Close</button>
        </header>
        <p className="hint">Plain text in the same style as NewRecruit's export, ready to paste into a message or forum post.</p>
        {sheets === 'loading' ? (
          <p className="hint">Loading wargear…</p>
        ) : (
          <>
            {sheets === null && <p className="why">Datasheets couldn't load, so only the wargear options taken are listed.</p>}
            <textarea className="export-text" readOnly value={text} rows={20} spellCheck={false} aria-label="Exported list" onFocus={(e) => e.currentTarget.select()} />
            <div className="row">
              <button className="primary" onClick={copy}>{copied === 'ok' ? '✓ Copied' : 'Copy to clipboard'}</button>
              <button onClick={() => download(text, 'text/plain', 'txt')}>Download .txt</button>
              <button onClick={() => download(JSON.stringify(state, null, 2), 'application/json', 'json')} title="The builder's own format, as a backup of the list">
                Download JSON
              </button>
            </div>
            {copied === 'failed' && <p className="why">Couldn't copy automatically; the text is selected, so press Ctrl+C.</p>}
          </>
        )}
      </div>
    </dialog>
  );
}
