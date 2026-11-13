/**
 * ERRATA DRILL. Each test applies a JSON errata patch (data only, no code edits) and
 * checks that a list's verdict changes the way the errata says it should. The last
 * test marks the boundary: a *new kind* of rule cannot be data-only, and the app must
 * refuse it loudly instead of silently ignoring it.
 */
import { describe, expect, it } from 'vitest';
import { applyErrata, type ErrataPatch } from '../src/errata';
import { explainChange } from '../src/explain';
import { totalPoints } from '../src/points';
import { validate } from '../src/validate';
import { CATALOG, det, roster, slot, u } from './fixtures';

const patch = (ops: ErrataPatch['ops']): ErrataPatch => ({ version: 'fixture-2', source: { title: 'Drill', date: '2026-11-13' }, ops });
const ids = (r: ReturnType<typeof validate>) => [...new Set(r.errors.map((e) => e.ruleId))].sort();

const P = 'crusade-primary';
const armourList = (n: number) => {
  const fills: Record<string, ReturnType<typeof u>> = {};
  for (let i = 1; i <= n; i++) fills[`Armour${i}`] = u('predator');
  return roster([
    det('p', P, { Command1: u('centurion'), Troops1: u('tactical-squad') }),
    det('as', 'armoured-support', fills, { from: ['p', slot(P, 'Command1')] }),
  ]);
};

describe('errata drill: rule and points changes are data-only', () => {
  it('points change: a list exactly at the limit goes over', () => {
    const list = armourList(4); // 75 + 125 + 4×120 = 680
    const limit = totalPoints(list, CATALOG);
    const atLimit = { ...list, pointsLimit: limit };
    expect(validate(atLimit, CATALOG).legal).toBe(true);
    const next = applyErrata(CATALOG, patch([{ op: 'set', path: ['units', { id: 'predator' }, 'points', 'base'], value: 125 }]));
    expect(ids(validate({ ...atLimit, catalogVersion: next.version }, next))).toEqual(['ARMY-POINTS']);
  });

  it('slot change: Armoured Support loses a slot', () => {
    const next = applyErrata(CATALOG, patch([{ op: 'remove', path: ['detachments', { id: 'armoured-support' }, 'slots', { id: 'armoured-support.Armour4' }] }]));
    expect(ids(validate(armourList(4), next))).toEqual(['SLOT-EXISTS']);
    expect(validate(armourList(3), next).legal).toBe(true);
  });

  it('role change: a unit moves from Command to High Command', () => {
    const next = applyErrata(CATALOG, patch([{ op: 'set', path: ['units', { id: 'centurion' }, 'role'], value: 'HighCommand' }]));
    expect(ids(validate(armourList(1), next))).toEqual(['SLOT-ROLE-MATCH']);
  });

  it('limit change: Prime Advantage becomes once per army', () => {
    const list = roster([
      det('p', P, { HighCommand1: u('praetor'), Command1: { unit: u('centurion'), prime: 'combat-veterans' }, Troops1: u('tactical-squad') }),
      det('oc', 'officer-cadre', { Command1: { unit: u('centurion'), prime: 'combat-veterans' } }, { from: ['p', slot(P, 'HighCommand1')] }),
    ]);
    expect(validate(list, CATALOG).legal).toBe(true);
    const next = applyErrata(CATALOG, patch([{ op: 'set', path: ['primeAdvantages', { id: 'combat-veterans' }, 'oncePer'], value: 'army' }]));
    expect(ids(validate(list, next))).toEqual(['PRIME-ONCE']);
  });

  it('cap change: Warlord/Lord of War share drops from 25% to 10%', () => {
    const list = roster([det('p', P, { Troops1: u('tactical-squad') }), det('low', 'lord-of-war', { LordOfWar1: u('fellblade') })]); // 450 ≤ 750
    expect(validate(list, CATALOG).legal).toBe(true);
    const next = applyErrata(CATALOG, patch([{ op: 'set', path: ['limits', 'warlordLordOfWarShare'], value: 0.1 }]));
    expect(ids(validate(list, next))).toEqual(['LOW-CAP']);
  });

  it('new detachment: published as data and immediately usable, with lock reasons', () => {
    const next = applyErrata(
      CATALOG,
      patch([
        {
          op: 'push',
          path: ['detachments'],
          value: {
            id: 'drill-recon-wing',
            name: 'Drill Recon Wing',
            kind: 'Auxiliary',
            slots: [{ id: 'drill-recon-wing.Recon1', role: 'Recon' }],
            armyListRule: 'linked',
            requirements: [{ kind: 'minPointsLimit', value: 3500, source: { book: 'Drill', section: 'x' } }],
            grantsUnlocks: false,
            source: { book: 'Drill', section: 'x' },
          },
        },
      ]),
    );
    const base = roster([det('p', P, { Command1: u('centurion'), Troops1: u('tactical-squad') })]);
    const add = (r: typeof base) => ({ ...r, detachments: [...r.detachments, det('d', 'drill-recon-wing', { Recon1: u('recon-squad') }, { from: ['p', slot(P, 'Command1')] })] });
    // At 3,000 the UI can show *why* it's locked, straight from the validator:
    const reasons = explainChange(base, next, add);
    expect(reasons.map((r) => r.ruleId)).toEqual(['DET-REQUIREMENT']);
    expect(reasons[0]!.message).toContain('needs a points limit of 3,500+');
    expect(validate(add({ ...base, pointsLimit: 3500 }), next).legal).toBe(true);
  });

  it('catalog version bump flags old lists for re-checking (warning, not error)', () => {
    const next = applyErrata(CATALOG, patch([]));
    const res = validate(armourList(1), next);
    expect(res.legal).toBe(true);
    expect(res.warnings.map((w) => w.ruleId)).toContain('DATA-VERSION');
  });

  it('BOUNDARY: a new *kind* of requirement is refused loudly, not ignored', () => {
    const next = applyErrata(CATALOG, patch([
      { op: 'push', path: ['detachments', { id: 'armoured-support' }, 'requirements'], value: { kind: 'maxPerArmy', value: 1, source: { book: 'Drill', section: 'x' } } },
    ]));
    const res = validate(armourList(1), next);
    expect(ids(res)).toEqual(['DATA-UNKNOWN']);
    expect(res.errors[0]!.message).toContain('"maxPerArmy"');
  });
});
