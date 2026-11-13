import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Catalog, UnitDef, UnitInstance } from '../src/model';
import { shareCap, totalPoints, unitPoints } from '../src/points';
import { validate } from '../src/validate';
import { CATALOG, UNITS, det, roster, u } from './fixtures';

const defOf = (id: string) => UNITS.find((x) => x.id === id)!;
let propSeq = 0;

/** A valid-sized instance of any fixture unit with a random subset of its options. */
const arbUnit = (pool: UnitDef[] = UNITS): fc.Arbitrary<UnitInstance> =>
  fc.constantFrom(...pool).chain((def) =>
    fc
      .record({
        models: fc.integer({ min: def.points.minModels, max: def.points.maxModels }),
        picks: fc.subarray(def.options.filter((o) => !o.group)),
      })
      .chain(({ models, picks }) =>
        fc.tuple(...picks.map((o) => fc.integer({ min: 1, max: o.max === 'models' ? models : o.max }))).map((counts) => ({
          id: `prop-${++propSeq}`,
          unitId: def.id,
          models,
          options: picks.map((o, i) => ({ optionId: o.id, count: counts[i]! })),
          ...(def.factionTrait === null ? { factionTrait: def.armyList === 'mechanicum' ? 'Reductor' : 'Blood Angels' } : {}),
        })),
      ),
  );

/** Free-form roster for arithmetic-only properties (slot legality irrelevant). */
const asRoster = (units: UnitInstance[]) =>
  roster([{ id: 'p', defId: 'crusade-primary', armyList: 'legiones-astartes', extraSlots: [], fills: units.map((unit, i) => ({ slotId: `s${i}`, unit })) }]);

describe('points totals (property-based)', () => {
  it('total = Σ unitPoints, and is a non-negative integer', () => {
    fc.assert(
      fc.property(fc.array(arbUnit(), { maxLength: 25 }), (units) => {
        const total = totalPoints(asRoster(units), CATALOG);
        const sum = units.reduce((s, x) => s + unitPoints(x, defOf(x.unitId)), 0);
        expect(total).toBe(sum);
        expect(Number.isInteger(total)).toBe(true);
        expect(total).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('is independent of unit order', () => {
    fc.assert(
      fc.property(
        fc.array(arbUnit(), { minLength: 1, maxLength: 20 }).chain((units) => fc.tuple(fc.constant(units), fc.shuffledSubarray(units, { minLength: units.length, maxLength: units.length }))),
        ([a, b]) => {
          expect(totalPoints(asRoster(a), CATALOG)).toBe(totalPoints(asRoster(b), CATALOG));
        },
      ),
    );
  });

  it('adding a unit adds exactly its cost', () => {
    fc.assert(
      fc.property(fc.array(arbUnit(), { maxLength: 15 }), arbUnit(), (units, extra) => {
        const before = totalPoints(asRoster(units), CATALOG);
        const after = totalPoints(asRoster([...units, extra]), CATALOG);
        expect(after - before).toBe(unitPoints(extra, defOf(extra.unitId)));
      }),
    );
  });

  it('one more model adds exactly perExtraModel', () => {
    const growable = UNITS.filter((d) => d.points.maxModels > d.points.minModels);
    fc.assert(
      fc.property(arbUnit(growable).filter((x) => x.models < defOf(x.unitId).points.maxModels), (x) => {
        const def = defOf(x.unitId);
        // Per-model options are priced by how many were taken, not by unit size.
        expect(unitPoints({ ...x, models: x.models + 1 }, def) - unitPoints(x, def)).toBe(def.points.perExtraModel);
      }),
    );
  });

  it('validator total matches the calculator, and ARMY-POINTS fires iff total > limit', () => {
    const troops = fc.array(arbUnit([defOf('tactical-squad')]), { minLength: 1, maxLength: 4 });
    const transports = fc.array(arbUnit([defOf('rhino')]), { maxLength: 4 });
    fc.assert(
      fc.property(troops, transports, fc.integer({ min: 100, max: 4000 }), (t, r, limit) => {
        const fills: Record<string, UnitInstance> = {};
        t.forEach((x, i) => (fills[`Troops${i + 1}`] = x));
        r.forEach((x, i) => (fills[`Transport${i + 1}`] = x));
        const ro = roster([det('p', 'crusade-primary', fills)], { pointsLimit: limit });
        const res = validate(ro, CATALOG);
        const total = totalPoints(ro, CATALOG);
        expect(res.totals.points).toBe(total);
        expect(res.errors.some((e) => e.ruleId === 'ARMY-POINTS')).toBe(total > limit);
      }),
    );
  });
});

describe('percentage caps round up at the exact boundary (property-based)', () => {
  /** Data-only override: set a fixture unit's base points. */
  const withPoints = (unitId: string, base: number): Catalog => {
    const c = structuredClone(CATALOG);
    c.units.find((x) => x.id === unitId)!.points.base = base;
    return c;
  };

  it('Allied cap: ALLIED-CAP iff allied points > ceil(50% × limit)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 5000 }), fc.integer({ min: 1, max: 3000 }), (limit, allied) => {
        const cat = withPoints('thallax', allied);
        const ro = roster([det('p', 'crusade-primary', { Troops1: u('tactical-squad') }), det('al', 'allied', { Troops1: u('thallax') }, { list: 'mechanicum' })], { pointsLimit: limit });
        const res = validate(ro, cat);
        expect(res.totals.allied).toBe(allied);
        expect(res.errors.some((e) => e.ruleId === 'ALLIED-CAP')).toBe(allied > shareCap(limit, 0.5));
      }),
    );
  });

  it('Warlord/Lord of War cap: LOW-CAP iff points > ceil(25% × limit)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 5000 }), fc.integer({ min: 1, max: 2000 }), (limit, low) => {
        const cat = withPoints('small-low', low);
        const ro = roster([det('p', 'crusade-primary', { Troops1: u('tactical-squad') }), det('low', 'lord-of-war', { LordOfWar1: u('small-low') })], { pointsLimit: limit });
        const res = validate(ro, cat);
        expect(res.errors.some((e) => e.ruleId === 'LOW-CAP')).toBe(low > shareCap(limit, 0.25));
      }),
    );
  });

  it('shareCap examples from the rulebook text', () => {
    expect(shareCap(3000, 0.25)).toBe(750);
    expect(shareCap(2250, 0.25)).toBe(563); // 562.5 rounds up
    expect(shareCap(3001, 0.5)).toBe(1501);
  });
});
