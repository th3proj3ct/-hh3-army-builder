/**
 * Datasheet display data (imported from BSData). The validator never reads these, but
 * players do, so check the importer only shows rules a unit actually has.
 */
import { describe, expect, it } from 'vitest';
import data from '../data/bsdata/datasheets.json';

type Rule = { name: string; summary: string; legions?: string[]; whenSelected?: string };
const sheets = (data as unknown as { datasheets: Record<string, { rules: Rule[] }> }).datasheets;
const always = (id: string) => sheets[id]!.rules.filter((r) => !r.whenSelected && !r.legions).map((r) => r.name);

describe('datasheet special rules', () => {
  it('Tactical Squad shows only its unconditional rules, with values filled in', () => {
    expect(always('tactical-squad')).toEqual(['Fury of the Legion', 'Line (2)']);
  });

  it('upgrade-granted rules are tied to the upgrade, not shown outright', () => {
    const t = sheets['tactical-squad']!.rules;
    expect(t.find((r) => r.name === 'Aberrant')?.whenSelected).toBe('Aberrant');
    expect(t.find((r) => r.name === 'Clone')?.whenSelected).toBe('Clone');
  });

  it('no unit shows Blackshields oath rules', () => {
    const oath = /^(Doomed Heroics|Loot the Dead|To Fight and Die Alone)\b/;
    for (const [id, s] of Object.entries(sheets)) expect(s.rules.filter((r) => oath.test(r.name)).map((r) => `${id}: ${r.name}`)).toEqual([]);
  });

  it('variable rules carry their value, or per-option values (no bare "(X)" left)', () => {
    for (const [id, s] of Object.entries(sheets))
      expect(s.rules.filter((r) => /\(X\)/.test(r.name) && !(r as Rule & { variants?: unknown[] }).variants?.length).map((r) => `${id}: ${r.name}`)).toEqual([]);
  });

  it('Mounted characters\' Bulky depends on the mount', () => {
    const bulky = sheets['mounted-centurion']!.rules.find((r) => r.name.startsWith('Bulky')) as Rule & { variants?: { when: string; name: string }[] };
    expect(bulky.variants).toEqual([{ when: 'Outrider', name: 'Bulky (2)' }, { when: 'Scimitar Jetbike', name: 'Bulky (3)' }]);
  });

  it('Mortarion keeps his own rules with values', () => {
    expect(always('mortarion')).toEqual(['Bulky (5)', 'Death Cloud', 'Eternal Warrior (3)', 'Fear (1)', 'Preternatural Resilience', 'Shadow of the Reaper']);
  });
});
