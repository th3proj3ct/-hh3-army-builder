/**
 * Independent check of imported BSData points against Wahapedia unit pages, read
 * 13 Nov 2026 (Wahapedia "UNIT COMPOSITION … N Points" and "+N Points per Model").
 * BSData is the data source, so it can't also be the check; Wahapedia is the second
 * source. A failure means one of them changed: look at both before "fixing" either.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog';

const WAHAPEDIA_2026_11_13: [unitId: string, base: number, perExtraModel: number, minModels: number, maxModels: number][] = [
  ['tactical-squad', 100, 10, 10, 20],
  ['assault-squad', 140, 12, 10, 20],
  ['cataphractii-terminator-squad', 150, 30, 5, 12],
  ['deathshroud-terminator-squad', 100, 45, 2, 10],
  ['grave-warden-terminator-squad', 225, 40, 5, 10],
  ['mortarion', 425, 0, 1, 1],
  ['calas-typhon', 200, 0, 1, 1],
  ['centurion', 80, 0, 1, 1],
  ['praetor', 120, 0, 1, 1],
  ['apothecary', 30, 0, 1, 1],
  ['rhino', 60, 0, 1, 1],
  ['predator', 100, 0, 1, 1],
  ['land-raider-carrier', 265, 0, 1, 1],
  ['contemptor-dreadnought', 150, 0, 1, 1],
];

describe('BSData points match Wahapedia', () => {
  for (const [id, base, per, min, max] of WAHAPEDIA_2026_11_13) {
    it(id, () => {
      const u = CATALOG.units.find((x) => x.id === id);
      expect(u, `${id} missing from import`).toBeDefined();
      expect(u!.points).toEqual({ base, perExtraModel: per, minModels: min, maxModels: max });
    });
  }
  it('Deathshroud melta bombs are +5 per model on both', () => {
    const o = CATALOG.units.find((x) => x.id === 'deathshroud-terminator-squad')!.options.find((x) => x.id === 'deathshroud--melta-bombs');
    expect(o?.cost.points).toBe(5);
  });
});
