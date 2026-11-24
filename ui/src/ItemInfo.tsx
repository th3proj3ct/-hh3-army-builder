import { useEffect, useState } from 'react';
import { itemInfo, loadAll, lookupRule, splitRules, type Datasheet, type Glossary, type WargearText } from './loadout';

type Data = { datasheets: Record<string, Datasheet>; glossary: Glossary; wargear: WargearText };
let shared: Data | null = null;

/**
 * What one wargear item does, shown under a wargear option: its weapon profile(s), what each of
 * the weapon's special rules does in a line, and the item's own rule text (e.g. Cyber-familiar).
 */
export function ItemInfo({ unitId, item }: { unitId: string; item: string }) {
  const [data, setData] = useState<Data | null>(shared);
  useEffect(() => {
    if (!data) loadAll().then((d) => { shared = d; setData(d); }, () => {});
  }, [data]);
  if (!data) return <div className="item-info hint">Loading…</div>;
  const { weapons, text } = itemInfo(data.datasheets[unitId], data.wargear, item);
  if (!weapons.length && !text) return <div className="item-info hint">No profile or rule text for {item} in the data.</div>;
  const keys = [...new Set(weapons.flatMap((w) => Object.keys(w.stats)))];
  const rules = [...new Set(weapons.flatMap((w) => splitRules(w.stats['Special Rules'] ?? '')))]
    .map((r) => ({ name: r, rule: lookupRule(data.glossary, r) }))
    .filter((x) => x.rule);
  // A rule's text opens with a one-line summary in quotes: show just that here.
  const short = (t: string) => (/^["“]([^"”]+)["”]/.exec(t)?.[1] ?? t.split(/(?<=\.)\s/)[0] ?? t).trim();
  return (
    <div className="item-info">
      {weapons.length > 0 && (
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th scope="col">{weapons[0]!.kind}</th>
                {keys.map((k) => <th key={k} scope="col">{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {weapons.map((w) => (
                <tr key={w.name}>
                  <th scope="row">{w.name}</th>
                  {keys.map((k) => <td key={k}>{w.stats[k] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rules.length > 0 && (
        <ul className="plain item-rules">
          {rules.map(({ name, rule }) => (
            <li key={name}><strong>{name}:</strong> {short(rule!.text)}</li>
          ))}
        </ul>
      )}
      {text && (
        <p className="item-text">
          {text.summary && <strong>{text.summary} </strong>}
          {text.text}
        </p>
      )}
    </div>
  );
}
