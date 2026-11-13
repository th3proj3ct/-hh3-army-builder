import { useState } from 'react';
import { CATALOG } from '../../src/catalog';
import type { Issue, ValidationResult } from '../../src/model';
import { shareCap } from '../../src/points';
import { splitMessage } from './reasons';

function Meter({ label, value, max, rule }: { label: string; value: number; max: number; rule: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = value > max;
  return (
    <div className={`meter ${over ? 'over' : ''}`} title={rule}>
      <div className="meter-label">
        <span>{label}</span>
        <strong>
          {value.toLocaleString('en')} / {max.toLocaleString('en')}
          {over && <span className="over-by"> +{(value - max).toLocaleString('en')} over</span>}
        </strong>
      </div>
      <div className="meter-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PointsBar({ result, limit, onShow }: { result: ValidationResult; limit: number; onShow: (e: Issue) => void }) {
  const [open, setOpen] = useState(false);
  const { totals, errors, warnings } = result;
  return (
    <section className="pointsbar" aria-label="Points and problems">
      <div className="meters">
        <Meter label="Points" value={totals.points} max={limit} rule="Total may not exceed the points limit" />
        {totals.allied > 0 && <Meter label="Allied" value={totals.allied} max={shareCap(limit, CATALOG.limits.alliedShare)} rule="Allied detachments: at most 50% of the limit, rounded up" />}
        <Meter
          label="Warlord + Lord of War"
          value={totals.warlordAndLordOfWar}
          max={shareCap(limit, CATALOG.limits.warlordLordOfWarShare)}
          rule="Warlord and Lord of War role units share one 25% allowance, rounded up"
        />
      </div>
      <button className={`status ${result.legal ? 'ok' : 'bad'}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {result.legal ? '✓ Legal list' : `● ${errors.length} problem${errors.length === 1 ? '' : 's'}`}
        {warnings.length > 0 && <span className="warn-count"> · {warnings.length} note{warnings.length === 1 ? '' : 's'}</span>}
        <span aria-hidden> {open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <ul className="problems">
          {errors.map((e, i) => {
            const m = splitMessage(e.message);
            return (
              <li key={`e${i}`} className="problem">
                <span>{m.what}</span>
                <small className="rule">Rule: {m.rule}</small>
                {e.at?.detachmentId && <button className="link" onClick={() => onShow(e)}>Show me</button>}
              </li>
            );
          })}
          {warnings.map((w, i) => (
            <li key={`w${i}`} className="problem warn">
              <span>{splitMessage(w.message).what}</span>
              <small className="rule">Advisory: {splitMessage(w.message).rule}</small>
            </li>
          ))}
          {!errors.length && !warnings.length && <li className="problem ok">Nothing to fix.</li>}
        </ul>
      )}
    </section>
  );
}
