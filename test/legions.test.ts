/**
 * All 18 Legion catalogues imported from BSData: every Legion gets its own units and
 * armoury, per-Legion units with the same name stay apart, and odd unit-size encodings
 * (Procurators) come out with a real size.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG, LEGIONS } from '../src/catalog';
import type { Roster } from '../src/model';
import { validate } from '../src/validate';
import { emptyState, migrate, placeUnit } from '../ui/src/state';

const byId = new Map(CATALOG.units.map((d) => [d.id, d]));
const slug = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

describe('every Legion is imported', () => {
  for (const legion of LEGIONS)
    it(`${legion} has its own units, including its Inductii Squad`, () => {
      expect(CATALOG.units.filter((u) => u.factionTrait === legion).length).toBeGreaterThanOrEqual(5);
      const inductii = byId.get(`inductii-squad-${slug(legion)}`);
      expect(inductii?.factionTrait).toBe(legion);
      expect(inductii?.rules).toContain('Inductii');
    });

  it('unit ids are unique', () => expect(new Set(CATALOG.units.map((u) => u.id)).size).toBe(CATALOG.units.length));
  it('every unit has at least one model', () => expect(CATALOG.units.filter((u) => u.points.minModels < 1).map((u) => u.id)).toEqual([]));
  it('Procurators: 5–15 models (size read from a unit-scope limit)', () =>
    expect(byId.get('procurators')?.points).toMatchObject({ minModels: 5, maxModels: 15, base: 100 }));
});

describe('Legion units in lists', () => {
  const army = (legion: string, unitId: string): Roster => {
    let s = emptyState(legion, 3000, 'Traitor');
    s = placeUnit(s, 'primary', 'crusade-primary.Command1', 'centurion');
    s = placeUnit(s, 'primary', 'crusade-primary.Troops1', unitId);
    return s.roster;
  };
  const ids = (r: Roster) => [...new Set(validate(r, CATALOG).errors.map((e) => e.ruleId))].sort();

  it('a Sons of Horus army can take Sons of Horus Inductii', () => expect(ids(army('Sons of Horus', 'inductii-squad-sons-of-horus'))).toEqual([]));
  it("but not another Legion's", () => expect(ids(army('Sons of Horus', 'inductii-squad-death-guard'))).toContain('DET-SINGLE-FACTION'));
  it('Thousand Sons cults are imported on generic units, gated to Thousand Sons', () => {
    const cult = CATALOG.units.flatMap((u) => u.options.map((o) => ({ u, o }))).find(({ u, o }) => u.factionTrait === null && o.factionTraits?.includes('Thousand Sons') && /Raptora$/.test(o.name));
    expect(cult).toBeDefined();
    expect(cult!.o.factionTraits).toEqual(['Thousand Sons']);
  });
});

describe('saved lists', () => {
  it('a list saved with the old "inductii-squad" id loads as that Legion\'s Inductii', () => {
    let s = emptyState('Death Guard');
    s = placeUnit(s, 'primary', 'crusade-primary.Troops1', 'tactical-squad');
    s.roster.detachments[0]!.fills[0]!.unit!.unitId = 'inductii-squad';
    expect(migrate(s).roster.detachments[0]!.fills[0]!.unit!.unitId).toBe('inductii-squad-death-guard');
  });
});
