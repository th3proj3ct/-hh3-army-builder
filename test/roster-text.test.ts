/** The NewRecruit-style text export, on the Death Guard sample with real datasheets. */
import { describe, expect, it } from 'vitest';
import { rosterText } from '../ui/src/rosterText';
import { deathGuardSample } from '../ui/src/samples';

import data from '../data/bsdata/datasheets.json';
import type { Datasheet } from '../ui/src/loadout';

const sheets = (data as unknown as { datasheets: Record<string, Datasheet> }).datasheets;

describe('text roster', () => {
  const text = rosterText(deathGuardSample(), sheets);
  it('has the NewRecruit-style header with totals', () => {
    expect(text.split('\n')[0]).toMatch(/^Death Guard - .* - \[1 Primary Detachment, 2735 Point\(s\)/);
    expect(text).toContain('# ++ Crusade Force Organization Chart ++');
    expect(text).toContain('Allegiance: Traitor');
  });
  it('lists every detachment and its units with points', () => {
    expect(text).toMatch(/# \+\+ Primary - Crusade Primary Detachment \+\+ \[1 Primary Detachment, \d+ Point\(s\)\]/);
    expect(text).toMatch(/^Calas Typhon \[200 Point\(s\)\]/m);
    expect(text).toMatch(/^Tactical Squad \[200 Point\(s\)\]:/m);
    expect(text).toMatch(/^• \d+x /m);
  });
  it('still works without datasheets (options only)', () => {
    const t = rosterText(deathGuardSample(), null);
    expect(t).toMatch(/^Calas Typhon \[200 Point\(s\)\]/m);
  });
});
