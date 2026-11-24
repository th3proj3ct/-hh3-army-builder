/**
 * Plain-text army roster in the style of NewRecruit's text export:
 *
 *   Death Guard - Death Guard army - [1 Primary Detachment, 2735 Point(s), 4 Auxiliary Detachment(s)]
 *   # ++ Primary - Crusade Primary Detachment ++ [1 Primary Detachment, 950 Point(s)]
 *   ## Command [160 Point(s)]
 *   Centurion [80 Point(s)]: Power weapon, Bolt pistol, Prime Unit (Unnatural Resilience)
 *
 * Wargear comes from the imported datasheets (default kit minus exchanges plus options). If
 * datasheets aren't available, only the options taken are listed.
 */
import { CATALOG } from '../../src/catalog';
import type { DetachmentDef, DetachmentInstance, SlotDef, UnitInstance } from '../../src/model';
import { unitPoints } from '../../src/points';
import { roleLabel } from '../../src/validate';
import { buildLoadout, type Datasheet } from './loadout';
import { detDefs, primeDefs, slotsOf, unitDefs, type BuilderState } from './state';

const KIND: Record<DetachmentDef['kind'], string> = {
  Primary: 'Primary',
  Auxiliary: 'Auxiliary',
  Apex: 'Apex',
  Allied: 'Allied',
  LordOfWar: 'Lord of War',
  Warlord: 'Warlord',
};
const pts = (n: number) => `[${n} Point(s)]`;

function unitPts(u: UnitInstance): number {
  const d = unitDefs.get(u.unitId);
  return d ? unitPoints(u, d) : 0;
}
function detPts(det: DetachmentInstance): number {
  return det.fills.reduce((s, f) => s + (f.unit ? unitPts(f.unit) : 0), 0);
}

/** "1 Primary Detachment, 2735 Point(s), 4 Auxiliary Detachment(s), 1 Apex Detachment(s)" */
function counts(dets: DetachmentInstance[], points: number): string {
  const by = new Map<string, number>();
  for (const d of dets) {
    const k = detDefs.get(d.defId)?.kind;
    if (k) by.set(k, (by.get(k) ?? 0) + 1);
  }
  const parts = [`${by.get('Primary') ?? 0} Primary Detachment`, `${points} Point(s)`];
  // NewRecruit writes "(s)" even for one of these.
  for (const k of ['Auxiliary', 'Apex', 'Allied', 'Warlord', 'LordOfWar'] as const) if (by.get(k)) parts.push(`${by.get(k)} ${KIND[k]} Detachment(s)`);
  return `[${parts.join(', ')}]`;
}

/** Detachments in reading order: each root (Primary first), then what its slots unlocked, depth first. */
function ordered(dets: DetachmentInstance[]): DetachmentInstance[] {
  const order = ['Primary', 'Warlord', 'LordOfWar', 'Allied'];
  const roots = dets.filter((d) => !d.unlockedBy || !dets.some((p) => p.id === d.unlockedBy!.detachmentId));
  roots.sort((a, b) => order.indexOf(detDefs.get(a.defId)?.kind ?? '') - order.indexOf(detDefs.get(b.defId)?.kind ?? ''));
  const out: DetachmentInstance[] = [];
  const visit = (d: DetachmentInstance) => {
    if (out.includes(d)) return;
    out.push(d);
    for (const s of slotsOf(d)) for (const c of dets.filter((x) => x.unlockedBy?.detachmentId === d.id && x.unlockedBy.slotId === s.id)) visit(c);
  };
  roots.forEach(visit);
  return out;
}

/** "Prime Unit (Logistical Benefit (extra Support slot))" */
function primeText(det: DetachmentInstance, slotId: string, primeId: string): string {
  const name = primeDefs.get(primeId)?.name ?? primeId;
  const extra = det.extraSlots.find((x) => x.grantedBy.slotId === slotId && x.grantedBy.primeAdvantageId === primeId);
  return `Prime Unit (${name}${extra ? ` (extra ${roleLabel(extra.role)} slot)` : ''})`;
}

/** Lines for one unit: a one-liner for single models, a bullet per model type otherwise. */
function unitLines(det: DetachmentInstance, slot: SlotDef, u: UnitInstance, sheets: Record<string, Datasheet> | null): string[] {
  const def = unitDefs.get(u.unitId);
  if (!def) return [`${u.unitId} [?]`];
  const fill = det.fills.find((f) => f.slotId === slot.id);
  const prime = fill?.primeAdvantage ? primeText(det, slot.id, fill.primeAdvantage) : '';
  const sub = def.subFactions ? u.subFaction : undefined;
  // What each taken option costs, to show "[5 Point(s)]" after it like NewRecruit does.
  const cost = new Map<string, number>();
  for (const sel of u.options) {
    const o = def.options.find((x) => x.id === sel.optionId);
    if (o?.display) cost.set(o.display.item.toLowerCase(), o.cost.points);
  }
  const fmt = (items: string[]) =>
    items.map((it) => {
      const m = /^(\d+)× (.*)$/.exec(it);
      const name = m ? m[2]! : it;
      const c = cost.get(name.toLowerCase());
      return `${m ? `${m[1]}x ${name}` : name}${c ? ` ${pts(c)}` : ''}`;
    });

  const head = `${def.name} ${pts(unitPts(u))}`;
  const sheet = sheets?.[def.id];
  if (!sheet) {
    // No datasheet: list the options taken.
    const items = u.options.map((sel) => {
      const o = def.options.find((x) => x.id === sel.optionId);
      return `${sel.count > 1 ? `${sel.count}x ` : ''}${o?.display?.item ?? o?.name ?? sel.optionId}${o?.cost.points ? ` ${pts(o.cost.points)}` : ''}`;
    });
    const all = [...(sub ? [sub] : []), ...items, ...(prime ? [prime] : [])];
    return [`${head}${all.length ? `: ${all.join(', ')}` : ''}`];
  }
  const { lines } = buildLoadout(sheet, def.options, u);
  const models = lines.filter((l) => l.count > 0 && l.model !== 'Unit upgrades');
  const upgrades = lines.find((l) => l.model === 'Unit upgrades');
  if (models.length === 1 && models[0]!.count === 1 && !upgrades) {
    const all = [...(sub ? [sub] : []), ...fmt(models[0]!.items), ...(prime ? [prime] : [])];
    return [`${head}${all.length ? `: ${all.join(', ')}` : ''}`];
  }
  const out = [`${head}:${sub ? ` ${sub}` : ''}`];
  for (const l of models) out.push(`• ${l.count}x ${l.model}${l.items.length ? `: ${fmt(l.items).join(', ')}` : ''}`);
  if (upgrades?.items.length) out.push(`  ${fmt(upgrades.items).join(', ')}`);
  if (prime) out.push(`  ${prime}`);
  return out;
}

export function rosterText(s: BuilderState, sheets: Record<string, Datasheet> | null): string {
  const r = s.roster;
  const points = r.detachments.reduce((sum, d) => sum + detPts(d), 0);
  const all = counts(r.detachments, points);
  const out: string[] = [];
  out.push(`${s.primaryLegion} - ${r.name} - ${all}`, '');
  out.push(`# ++ Crusade Force Organization Chart ++ ${all}`);
  out.push('## Allegiance', `Allegiance: ${r.allegiance}`, '');
  const rites = Object.values(r.ritesOfWar)
    .map((id) => CATALOG.armyLists.flatMap((l) => l.rites).find((x) => x.id === id)?.name)
    .filter(Boolean);
  out.push('## Army Configuration', `Points Limit: ${r.pointsLimit}`, ...(r.missionId ? ['Mission: Core Mission'] : []), ...rites.map((x) => `${x}`), '');

  for (const det of ordered(r.detachments)) {
    const def = detDefs.get(det.defId);
    if (!def) continue;
    const kind = KIND[def.kind];
    const allied = def.kind === 'Allied' ? ` (${s.alliedFaction[det.id] ?? ''})` : '';
    const choice = det.choice ? ` (${det.choice})` : '';
    out.push(`# ++ ${kind} - ${def.name}${choice}${allied} ++ [1 ${kind} Detachment, ${detPts(det)} Point(s)]`);
    // Group filled slots by role, in the order the roles first appear in the detachment.
    const roles: SlotDef['role'][] = [];
    for (const sl of slotsOf(det)) if (!roles.includes(sl.role)) roles.push(sl.role);
    for (const role of roles) {
      const filled = slotsOf(det)
        .filter((sl) => sl.role === role)
        .map((sl) => ({ sl, u: det.fills.find((f) => f.slotId === sl.id)?.unit }))
        .filter((x): x is { sl: SlotDef; u: UnitInstance } => !!x.u);
      if (!filled.length) continue;
      out.push(`## ${roleLabel(role)} ${pts(filled.reduce((sum, x) => sum + unitPts(x.u), 0))}`);
      for (const { sl, u } of filled) out.push(...unitLines(det, sl, u, sheets));
      out.push('');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
