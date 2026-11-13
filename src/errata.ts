import type { Catalog } from './model';

/**
 * Errata as data. A patch is a JSON document of operations on the catalog.
 * Path segments are object keys, array indexes, or `{ id }` to find an array
 * element by id (robust to re-ordering between data releases).
 */
export type PathSeg = string | number | { id: string };
export type ErrataOp =
  | { op: 'set'; path: PathSeg[]; value: unknown }
  | { op: 'push'; path: PathSeg[]; value: unknown }
  | { op: 'remove'; path: PathSeg[] };

export interface ErrataPatch {
  /** New catalog version after applying, e.g. "aod-1.2+faq-2026-11". */
  version: string;
  source: { title: string; date: string; url?: string };
  ops: ErrataOp[];
}

export function applyErrata(catalog: Catalog, patch: ErrataPatch): Catalog {
  const next = structuredClone(catalog) as unknown as Record<string, unknown>;
  for (const op of patch.ops) {
    const parentPath = op.path.slice(0, -1);
    const last = op.path[op.path.length - 1];
    if (last === undefined) throw new Error('Errata op with empty path');
    const parent = walk(next, parentPath);
    if (op.op === 'push') {
      const arr = get(parent, last);
      if (!Array.isArray(arr)) throw new Error(`push target is not an array: ${fmt(op.path)}`);
      arr.push(op.value);
    } else if (op.op === 'set') {
      setOrRemove(parent, last, op.value, false, op.path);
    } else {
      setOrRemove(parent, last, undefined, true, op.path);
    }
  }
  next.version = patch.version;
  return next as unknown as Catalog;
}

function walk(root: unknown, path: PathSeg[]): unknown {
  let cur = root;
  for (const seg of path) {
    cur = get(cur, seg);
    if (cur === undefined) throw new Error(`Errata path not found at ${fmt(path)}`);
  }
  return cur;
}

function get(obj: unknown, seg: PathSeg): unknown {
  if (typeof seg === 'object') return Array.isArray(obj) ? obj.find((x) => x?.id === seg.id) : undefined;
  return (obj as Record<string | number, unknown>)?.[seg];
}

function setOrRemove(parent: unknown, seg: PathSeg, value: unknown, remove: boolean, full: PathSeg[]) {
  if (typeof seg === 'object') {
    if (!Array.isArray(parent)) throw new Error(`{id} segment on non-array at ${fmt(full)}`);
    const i = parent.findIndex((x) => x?.id === seg.id);
    if (i < 0) throw new Error(`No element with id ${seg.id} at ${fmt(full)}`);
    remove ? parent.splice(i, 1) : (parent[i] = value);
    return;
  }
  const p = parent as Record<string | number, unknown>;
  if (remove) Array.isArray(p) ? (p as unknown[]).splice(Number(seg), 1) : delete p[seg];
  else p[seg] = value;
}

const fmt = (p: PathSeg[]) => p.map((s) => (typeof s === 'object' ? `[id=${s.id}]` : String(s))).join('.');
