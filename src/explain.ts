import type { Catalog, Issue, Roster } from './model';
import { validate } from './validate';

/**
 * Why can't I do X? Apply a hypothetical change, validate, and return only the
 * errors the change *introduces*. The UI uses this for every locked slot and every
 * greyed-out unit, so lock reasons come from the same code as the verdict — no
 * second rules engine to drift out of sync.
 */
export function explainChange(roster: Roster, catalog: Catalog, change: (draft: Roster) => Roster): Issue[] {
  const before = new Set(validate(roster, catalog).errors.map(key));
  const after = validate(change(structuredClone(roster)), catalog).errors;
  return after.filter((e) => !before.has(key(e)));
}

const key = (e: Issue) => `${e.ruleId}|${e.message}`;
