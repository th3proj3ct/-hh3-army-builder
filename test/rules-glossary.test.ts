/** Special-rule hover text: every rule a weapon or unit names should find its BSData text. */
import { describe, expect, it } from 'vitest';
import data from '../data/bsdata/datasheets.json';
import { itemInfo, itemKey, lookupRule, splitRules, type Datasheet, type Glossary } from '../ui/src/loadout';

const file = data as unknown as { glossary: Glossary; datasheets: Record<string, Datasheet> };
const g = file.glossary;

describe('special-rules glossary', () => {
  it('finds Shred (6) under Shred (X) and says what X is', () => {
    const r = lookupRule(g, 'Shred (6)');
    expect(r?.name).toBe('Shred (X)');
    expect(r?.x).toBe('6');
    expect(r?.text).toMatch(/Wound Test/);
  });
  it('matches regardless of case and apostrophe style', () => {
    expect(lookupRule(g, 'Feel no Pain (5+)')?.name).toMatch(/Feel No Pain/i);
    expect(lookupRule(g, 'Deep Strike')?.x).toBeUndefined();
  });
  it('splits at commas outside brackets, and where BSData left the comma out', () => {
    expect(splitRules('Shock (Pinning, Suppressed), Breaching (5+)')).toEqual(['Shock (Pinning, Suppressed)', 'Breaching (5+)']);
    expect(splitRules('Shred (4+) Reaping Blow (2)')).toEqual(['Shred (4+)', 'Reaping Blow (2)']);
    expect(splitRules('-')).toEqual([]);
  });
  it('nearly every weapon rule in the import has text (a handful of BSData typos excepted)', () => {
    const names = new Set(Object.values(file.datasheets).flatMap((d) => d.weapons.flatMap((w) => splitRules(w.stats['Special Rules'] ?? ''))));
    const missing = [...names].filter((n) => !lookupRule(g, n));
    expect(missing.length).toBeLessThanOrEqual(5);
  });
});

describe('wargear text', () => {
  const w = (data as unknown as { wargear: import('../ui/src/loadout').WargearText }).wargear;
  it('non-weapon wargear has its rule text (Cyber-familiar, Augury scanner)', () => {
    expect(itemInfo(file.datasheets['forge-lord'], w, 'Cyber-familiar').text?.text).toMatch(/Intelligence Checks/);
    expect(w[itemKey('Augury scanner')]?.summary).toMatch(/Shrouded/);
  });
  it('weapons resolve to their profiles', () => {
    const info = itemInfo(file.datasheets['forge-lord'], w, 'Thunder hammer');
    expect(info.weapons.map((x) => x.name)).toContain('Thunder hammer');
  });
  it("itemKey keeps the letter s (a regex once dropped it)", () => expect(itemKey('Augury  Scanners')).toBe('augury scanners'));
});
