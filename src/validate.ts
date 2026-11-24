import type {
  BattlefieldRole,
  Catalog,
  DetachmentDef,
  DetachmentInstance,
  DetachmentRequirement,
  Issue,
  ModelTag,
  Roster,
  SlotDef,
  SlotFill,
  UnitDef,
  UnitInstance,
  ValidationResult,
} from './model';
import { shareCap, unitPoints } from './points';
import { rule } from './rules';

const ROLE_LABEL: Record<BattlefieldRole, string> = {
  Warlord: 'Warlord',
  HighCommand: 'High Command',
  Command: 'Command',
  Retinue: 'Retinue',
  Elites: 'Elites',
  WarEngine: 'War-engine',
  Troops: 'Troops',
  Support: 'Support',
  LordOfWar: 'Lord of War',
  Transport: 'Transport',
  HeavyAssault: 'Heavy Assault',
  HeavyTransport: 'Heavy Transport',
  Armour: 'Armour',
  Recon: 'Recon',
  FastAttack: 'Fast Attack',
};
export const roleLabel = (r: BattlefieldRole) => ROLE_LABEL[r];
const article = (r: BattlefieldRole) => (/^[AEIOU]/.test(ROLE_LABEL[r]) ? 'an' : 'a');
/** Battlefield Role of a slot in a detachment: a chart slot, a Prime-added slot or a benefit slot. */
const slotRoleOf = (det: DetachmentInstance, def: DetachmentDef, slotId: string): BattlefieldRole | undefined =>
  def.slots.find((s) => s.id === slotId)?.role ?? det.extraSlots.find((x) => x.id === slotId)?.role ?? det.benefitSlots?.find((x) => x.id === slotId)?.role;

interface ResolvedUnit {
  inst: UnitInstance;
  def: UnitDef;
  det: DetachmentInstance;
  detDef: DetachmentDef;
  slotId: string;
  role: BattlefieldRole; // after option effects
  tags: Set<ModelTag>;
  faction: string | undefined;
  /** Mechanicum sub-faction: fixed by the profile or chosen on the unit. */
  subFaction: string | undefined;
  points: number;
}

/**
 * Pure: same roster + catalog ⇒ same result. No I/O, no mutation, order-independent
 * verdict. Every Issue carries a ruleId from RULES and a plain-language message
 * that ends with the rule's title so a player can see *which* rule bit them.
 */
export function validate(roster: Roster, catalog: Catalog): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (ruleId: string, what: string, at?: Issue['at']) =>
    errors.push({ ruleId, message: `${what} — Rule: ${rule(ruleId).title}.`, ...(at ? { at } : {}) });
  const warn = (ruleId: string, what: string, at?: Issue['at']) =>
    warnings.push({ ruleId, message: `${what} — Rule: ${rule(ruleId).title}.`, ...(at ? { at } : {}) });

  const unitDefs = new Map(catalog.units.map((u) => [u.id, u]));
  const detDefs = new Map(catalog.detachments.map((d) => [d.id, d]));
  const primeDefs = new Map(catalog.primeAdvantages.map((p) => [p.id, p]));
  const listDefs = new Map(catalog.armyLists.map((l) => [l.id, l]));
  const dets = new Map(roster.detachments.map((d) => [d.id, d]));
  const limit = roster.pointsLimit;

  // ── Army-level basics ────────────────────────────────────────────────────
  if (roster.catalogVersion !== catalog.version)
    warn('DATA-VERSION', `This list was built with rules data "${roster.catalogVersion}"; the current data is "${catalog.version}". Points or rules may have changed`);
  if (roster.missionId) {
    const mission = catalog.missions.find((m) => m.id === roster.missionId);
    if (!mission) err('DATA-UNKNOWN', `Mission "${roster.missionId}" is not in the catalog`);
    else if (mission.requiredPointsLimit !== undefined && mission.requiredPointsLimit !== limit)
      err('ARMY-MISSION-LIMIT', `${mission.name} is played at ${mission.requiredPointsLimit.toLocaleString('en')} points, but this list is set to ${limit.toLocaleString('en')}`);
  }
  if (limit < catalog.limits.advisedMin || limit > catalog.limits.advisedMax)
    warn('ARMY-POINTS-BAND', `A ${limit.toLocaleString('en')} point limit may play unbalanced`);

  const resolvedDefs = new Map<string, DetachmentDef>();
  for (const det of roster.detachments) {
    const def = detDefs.get(det.defId);
    if (!def) err('DATA-UNKNOWN', `Detachment type "${det.defId}" is not in the catalog`, { detachmentId: det.id });
    else resolvedDefs.set(det.id, def);
  }
  const ofKind = (k: DetachmentDef['kind']) => roster.detachments.filter((d) => resolvedDefs.get(d.id)?.kind === k);

  const primaries = ofKind('Primary');
  if (primaries.length === 0) err('ARMY-ONE-PRIMARY', 'This list has no Primary Detachment; every army is built around one');
  if (primaries.length > 1) err('ARMY-ONE-PRIMARY', `This list has ${primaries.length} Primary Detachments; only one is allowed`);
  const primary = primaries[0];

  // Exclusive groups (Lord of War; Warlord and its replacements).
  const groupCounts = new Map<string, { max: number; names: string[] }>();
  for (const det of roster.detachments) {
    const g = resolvedDefs.get(det.id)?.exclusiveGroup;
    if (!g) continue;
    const entry = groupCounts.get(g.id) ?? { max: g.max, names: [] };
    entry.names.push(resolvedDefs.get(det.id)!.name);
    groupCounts.set(g.id, entry);
  }
  for (const [id, { max, names }] of groupCounts) {
    if (names.length > max)
      err(id === 'lord-of-war' ? 'DET-MAX-LOW' : id === 'warlord' ? 'DET-MAX-WARLORD' : 'DET-MAX-ONCE', `This list has ${names.length} of: ${names.join(', ')}; only ${max} allowed`);
  }

  // ── Slots, units, options, primes ────────────────────────────────────────
  const resolved: ResolvedUnit[] = [];
  const primeUseArmy = new Map<string, number>();

  for (const det of roster.detachments) {
    const def = resolvedDefs.get(det.id);
    if (!def) continue;
    const at = { detachmentId: det.id };
    if (!det.fills.some((f) => f.unit)) err('ARMY-DETACHMENT-NOT-EMPTY', `${def.name} has no units in it`, at);
    if (def.armyLists && !def.armyLists.includes(det.armyList))
      err('DET-ARMY-LIST', `${def.name} is only for the ${def.armyLists.map((l) => listDefs.get(l)?.name ?? l).join('/')} list, not ${listDefs.get(det.armyList)?.name ?? det.armyList}`, at);

    const slotById = new Map<string, SlotDef>(def.slots.map((s) => [s.id, s]));
    const fillBySlot = new Map<string, SlotFill>();
    for (const f of det.fills) {
      if (fillBySlot.has(f.slotId)) err('SLOT-ONE-UNIT', `Two units were placed in the same slot (${f.slotId}) of ${def.name}`, { ...at, slotId: f.slotId });
      fillBySlot.set(f.slotId, f);
    }

    // Extra slots from Prime Advantages.
    const grantsUsed = new Set<string>();
    for (const extra of det.extraSlots) {
      const src = fillBySlot.get(extra.grantedBy.slotId);
      const adv = primeDefs.get(extra.grantedBy.primeAdvantageId);
      const key = `${extra.grantedBy.slotId}|${extra.grantedBy.primeAdvantageId}`;
      const xat = { ...at, slotId: extra.id };
      if (!src?.unit || src.primeAdvantage !== extra.grantedBy.primeAdvantageId || !adv || adv.effect.kind !== 'addSlot') {
        err('PRIME-EXTRA-SLOT', `The extra ${roleLabel(extra.role)} slot in ${def.name} isn't backed by a filled Prime slot with a slot-granting Prime Advantage`, xat);
        continue;
      }
      if (grantsUsed.has(key)) err('PRIME-EXTRA-SLOT', `${adv.name} adds only one slot, but more than one was added from the same Prime slot`, xat);
      grantsUsed.add(key);
      const eff = adv.effect;
      if ((eff.allowedRoles && !eff.allowedRoles.includes(extra.role)) || eff.excludedRoles?.includes(extra.role))
        err('PRIME-EXTRA-SLOT', `${adv.name} cannot add a ${roleLabel(extra.role)} slot`, xat);
      // FAQ: restrictions on a role's slots also bind added slots of that role.
      const restricted = def.slots.find((s) => s.role === extra.role && s.restriction);
      slotById.set(extra.id, { id: extra.id, role: extra.role, ...(restricted?.restriction ? { restriction: restricted.restriction } : {}) });
    }
    // Slots added by the detachment's own benefit (Pride of the Legion, Orbital Drop Assault).
    // How many are allowed is checked army-wide below, once every unit is known.
    for (const b of det.benefitSlots ?? []) {
      if (!def.primaryRules?.extraSlots?.roles.includes(b.role))
        err('PRIMARY-EXTRA-SLOTS', `${def.name} can't add ${article(b.role)} ${roleLabel(b.role)} slot`, { ...at, slotId: b.id });
      slotById.set(b.id, { id: b.id, role: b.role });
    }

    const primeUseDet = new Map<string, number>();
    for (const fill of det.fills) {
      const fat = { ...at, slotId: fill.slotId };
      const slot = slotById.get(fill.slotId);
      if (!slot) {
        err('SLOT-EXISTS', `${def.name} has no slot "${fill.slotId}"`, fat);
        continue;
      }
      if (fill.primeAdvantage && !fill.unit)
        err('PRIME-ONLY-ON-PRIME', `A Prime Advantage was picked for an empty slot in ${def.name}`, fat);
      if (!fill.unit) continue;

      const inst = fill.unit;
      const uat = { ...fat, unitInstanceId: inst.id };
      const udef = unitDefs.get(inst.unitId);
      if (!udef) {
        err('DATA-UNKNOWN', `Unit "${inst.unitId}" is not in the catalog`, uat);
        continue;
      }

      // Effective role & tags after option effects.
      let role = udef.role;
      const tags = new Set<ModelTag>(udef.modelTags);
      for (const sel of inst.options) {
        const o = udef.options.find((x) => x.id === sel.optionId);
        for (const e of o?.effects ?? []) {
          if (e.kind === 'setRole') role = e.role;
          if (e.kind === 'addModelTag') tags.add(e.tag);
        }
      }

      // Role match (Special Assignment lets High Command sit in a Command slot).
      const specialAssigned = fill.primeAdvantage === 'special-assignment' && slot.role === 'Command' && role === 'HighCommand';
      // Armoured Spearhead: a Decurion Magna tank may fill High Command, other Decurion tanks Command.
      const decurions = inst.options.map((o) => o.optionId).filter((id) => /--decurion-/.test(id));
      const decurionFill =
        def.primaryRules?.decurionCommand &&
        ((slot.role === 'HighCommand' && decurions.some((id) => id.endsWith('--decurion-magna'))) ||
          (slot.role === 'Command' && decurions.some((id) => !id.endsWith('--decurion-magna'))));
      if (role !== slot.role && !specialAssigned && !decurionFill)
        err('SLOT-ROLE-MATCH', `${udef.name} is ${article(role)} ${roleLabel(role)} unit and can't fill ${article(slot.role)} ${roleLabel(slot.role)} slot`, uat);

      // Sub-faction (Mechanicum): fixed by the profile, or one of the profile's choices.
      let subFaction: string | undefined = udef.subFaction;
      if (udef.subFactions) {
        if (!inst.subFaction) err('UNIT-SUB-FACTION', `${udef.name} needs a sub-faction chosen (${udef.subFactions.join(', ')})`, uat);
        else if (!udef.subFactions.includes(inst.subFaction)) err('UNIT-SUB-FACTION', `"${inst.subFaction}" isn't a sub-faction ${udef.name} can take`, uat);
        else subFaction = inst.subFaction;
      } else if (inst.subFaction && inst.subFaction !== udef.subFaction) {
        err('UNIT-SUB-FACTION', udef.subFaction ? `${udef.name} is always ${udef.subFaction}; its sub-faction can't be changed` : `${udef.name} has no sub-faction to choose`, uat);
      }

      // Slot restrictions.
      const rs = slot.restriction;
      if (rs?.modelTag && !tags.has(rs.modelTag))
        err(det.extraSlots.some((x) => x.id === slot.id) ? 'SLOT-RESTRICTION-EXTRA' : 'SLOT-RESTRICTION', `${roleLabel(slot.role)} slots in ${def.name} only take ${rs.modelTag} units`, uat);
      if (rs?.subFaction && subFaction !== rs.subFaction)
        err(det.extraSlots.some((x) => x.id === slot.id) ? 'SLOT-RESTRICTION-EXTRA' : 'SLOT-RESTRICTION', `${roleLabel(slot.role)} slots in ${def.name} only take ${rs.subFaction} units`, uat);
      if (rs?.unitIds && !rs.unitIds.includes(udef.id))
        err(det.extraSlots.some((x) => x.id === slot.id) ? 'SLOT-RESTRICTION-EXTRA' : 'SLOT-RESTRICTION',
          `${roleLabel(slot.role)} slots in ${def.name} only take: ${rs.unitIds.map((id) => unitDefs.get(id)?.name ?? id).join(', ')}`, uat);
      if (rs?.excludeUnitIds?.includes(udef.id))
        err(det.extraSlots.some((x) => x.id === slot.id) ? 'SLOT-RESTRICTION-EXTRA' : 'SLOT-RESTRICTION',
          `${roleLabel(slot.role)} slots in ${def.name} can't take ${udef.name}`, uat);
      if (rs?.nameContainsDetachmentChoice && (!det.choice || !udef.name.includes(det.choice)))
        err('SLOT-RESTRICTION', det.choice
          ? `${def.name} was set to "${det.choice}", so ${roleLabel(slot.role)} slots need a unit with "${det.choice}" in its name`
          : `${def.name} needs a ${def.choice?.label ?? 'choice'} before its ${roleLabel(slot.role)} slots can be filled`, uat);

      // Army list.
      const expectedList = rs?.armyList ?? det.armyList;
      if (udef.armyList !== expectedList)
        err('UNIT-ARMY-LIST', `${udef.name} comes from the ${listDefs.get(udef.armyList)?.name ?? udef.armyList} list, but this slot uses ${listDefs.get(expectedList)?.name ?? expectedList}`, uat);

      // Allegiance.
      if (udef.allegiance !== 'Any' && udef.allegiance !== roster.allegiance)
        err('ARMY-ALLEGIANCE', `${udef.name} is ${udef.allegiance}-only and this army is ${roster.allegiance}`, uat);

      // Faction trait.
      let faction: string | undefined = udef.factionTrait ?? undefined;
      if (udef.factionTrait === null) {
        const choices = listDefs.get(udef.armyList)?.factionChoices ?? [];
        if (!inst.factionTrait) err('UNIT-FACTION-TRAIT', `${udef.name} needs a Legion (Faction trait) chosen`, uat);
        else if (!choices.includes(inst.factionTrait)) err('UNIT-FACTION-TRAIT', `"${inst.factionTrait}" isn't a Faction ${udef.name} can take`, uat);
        else faction = inst.factionTrait;
      } else if (inst.factionTrait && inst.factionTrait !== udef.factionTrait) {
        err('UNIT-FACTION-TRAIT', `${udef.name} is always ${udef.factionTrait}; its Faction can't be changed`, uat);
      }

      // Model count.
      if (!Number.isInteger(inst.models) || inst.models < udef.points.minModels || inst.models > udef.points.maxModels)
        err('UNIT-MODEL-COUNT', `${udef.name} must have ${udef.points.minModels}–${udef.points.maxModels} models (has ${inst.models})`, uat);

      // Options / wargear.
      const groupTotals = new Map<string, { count: number; max: number | 'models' }>();
      for (const sel of inst.options) {
        const o = udef.options.find((x) => x.id === sel.optionId);
        if (!o) {
          err('OPT-EXISTS', `${udef.name} has no option "${sel.optionId}"`, uat);
          continue;
        }
        const cap = o.max === 'models' ? inst.models : o.max;
        if (!Number.isInteger(sel.count) || sel.count < 1 || sel.count > cap)
          err('OPT-MAX', `${o.name} can be taken at most ${cap} time(s) on ${udef.name} (taken ${sel.count})`, uat);
        if (o.group) {
          const g = groupTotals.get(o.group) ?? { count: 0, max: o.groupMax ?? 'models' };
          g.count += sel.count;
          groupTotals.set(o.group, g);
        }
        for (const req of o.requiresOptions ?? [])
          if (!inst.options.some((s) => s.optionId === req))
            err('OPT-REQUIRES', `${o.name} needs ${udef.options.find((x) => x.id === req)?.name ?? req} first`, uat);
        if (o.allegiance && o.allegiance !== roster.allegiance)
          err('OPT-GATED', `${o.name} is only available to ${o.allegiance} armies`, uat);
        if (o.factionTraits && (!faction || !o.factionTraits.includes(faction)))
          err('OPT-GATED', `${o.name} is only available to ${o.factionTraits.join('/')} units`, uat);
      }
      for (const [group, g] of groupTotals) {
        const cap = g.max === 'models' ? inst.models : g.max;
        if (g.count > cap)
          err(group === 'decurion' ? 'OPT-DECURION-ONE' : 'OPT-GROUP', `${udef.name} takes ${g.count} options from "${group}" but only ${cap} allowed`, uat);
      }

      // Prime Advantage.
      if (fill.primeAdvantage) {
        const adv = primeDefs.get(fill.primeAdvantage);
        if (!slot.prime) err('PRIME-ONLY-ON-PRIME', `The ${roleLabel(slot.role)} slot in ${def.name} isn't a Prime slot`, uat);
        if (!adv) err('DATA-UNKNOWN', `Prime Advantage "${fill.primeAdvantage}" is not in the catalog`, uat);
        else {
          if (def.allowedPrimeAdvantages && !def.allowedPrimeAdvantages.includes(adv.id))
            err('PRIME-DET-ALLOWED', `${def.name} only allows: ${def.allowedPrimeAdvantages.map((p) => primeDefs.get(p)?.name ?? p).join(', ')}`, uat);
          if (udef.rules?.includes('Inductii')) err('PRIME-BARRED-UNIT', `${udef.name} has the Inductii rule and can't take ${adv.name}`, uat);
          if (tags.has('Unique') && !adv.allowedForUnique)
            err('PRIME-UNIQUE', `${udef.name} contains a Unique model, so ${adv.name} isn't allowed`, uat);
          if (adv.slotRoles && !adv.slotRoles.includes(slot.role))
            err('PRIME-SLOT-ROLE', `${adv.name} can only be chosen for ${adv.slotRoles.map(roleLabel).join('/')} slots`, uat);
          if (adv.onlyInDetachments && !adv.onlyInDetachments.includes(def.id))
            err('PRIME-DET-ALLOWED', `${adv.name} can only be chosen in ${adv.onlyInDetachments.map((d) => detDefs.get(d)?.name ?? d).join('/')}`, uat);
          if (adv.allegiance && adv.allegiance !== roster.allegiance)
            err('PRIME-ELIGIBILITY', `${adv.name} is only for ${adv.allegiance} armies`, uat);
          const ur = adv.unitRequirement;
          if (ur) {
            const fails: string[] = [];
            if (ur.unitIds && !ur.unitIds.includes(udef.id)) fails.push('unit type');
            if (ur.roles && !ur.roles.includes(role)) fails.push(`role must be ${ur.roles.map(roleLabel).join('/')}`);
            if (ur.factionTraits && (!faction || !ur.factionTraits.includes(faction))) fails.push(`Faction must be ${ur.factionTraits.join('/')}`);
            if (ur.armyLists && !ur.armyLists.includes(udef.armyList)) fails.push('army list');
            if (ur.excludeModelTags?.some((t) => tags.has(t))) fails.push(`no ${ur.excludeModelTags.join('/')} models`);
            if (ur.modelTags && !ur.modelTags.some((t) => tags.has(t))) fails.push(`needs a ${ur.modelTags.join('/')} model`);
            if (fails.length) err('PRIME-ELIGIBILITY', `${udef.name} doesn't qualify for ${adv.name} (${fails.join('; ')})`, uat);
          }
          primeUseDet.set(adv.id, (primeUseDet.get(adv.id) ?? 0) + 1);
          primeUseArmy.set(adv.id, (primeUseArmy.get(adv.id) ?? 0) + 1);
          if (adv.oncePer === 'detachment' && primeUseDet.get(adv.id) === 2)
            err('PRIME-ONCE', `${adv.name} was chosen more than once in ${def.name}`, uat);
          if (adv.oncePer === 'army' && primeUseArmy.get(adv.id) === 2)
            err('PRIME-ONCE', `${adv.name} was chosen more than once in the army`, uat);
        }
      }

      resolved.push({ inst, def: udef, det, detDef: def, slotId: fill.slotId, role, tags, faction, subFaction, points: unitPoints(inst, udef) });
    }

    // Single Faction per detachment.
    const factions = new Set(resolved.filter((u) => u.det === det && u.faction).map((u) => u.faction!));
    if (factions.size > 1 && !def.mixedFactions)
      err('DET-SINGLE-FACTION', `${def.name} mixes Factions (${[...factions].join(', ')}); a detachment uses one`, at);
    // One sub-faction per detachment (BSData: "Multiple Mechanicum Traits in Detachment").
    const subs = new Set(resolved.filter((u) => u.det === det && u.subFaction).map((u) => u.subFaction!));
    if (subs.size > 1) err('DET-SINGLE-SUBFACTION', `${def.name} mixes Mechanicum sub-factions (${[...subs].sort().join(', ')}); a detachment uses one`, at);
  }

  // ── Alternative Primary Detachments (Pride of the Legion, Armoured Spearhead…) ──
  const primaryDet = roster.detachments.find((d) => resolvedDefs.get(d.id)?.kind === 'Primary');
  const primaryDef = primaryDet && resolvedDefs.get(primaryDet.id);
  const pr = primaryDef?.primaryRules;
  if (primaryDet && primaryDef && pr) {
    const pat = { detachmentId: primaryDet.id };
    const who = primaryDef.name;
    // "Only the following additional Detachments may be selected."
    if (pr.allowedDetachments) {
      const counts = new Map<string, number>();
      for (const d of roster.detachments) {
        const dd = resolvedDefs.get(d.id);
        if (!dd || d === primaryDet) continue;
        counts.set(dd.id, (counts.get(dd.id) ?? 0) + 1);
        if (!pr.allowedDetachments.includes(dd.id))
          err('PRIMARY-ALLOWED-DETACHMENTS', `${who} only allows these other detachments: ${pr.allowedDetachments.map((x) => detDefs.get(x)?.name ?? x).join(', ')} (not ${dd.name})`, { detachmentId: d.id });
      }
      for (const [id, max] of Object.entries(pr.maxOf ?? {}))
        if ((counts.get(id) ?? 0) > max) err('PRIMARY-ALLOWED-DETACHMENTS', `${who} allows at most ${max} ${detDefs.get(id)?.name ?? id}`, pat);
    }
    // "Lord of War (may only be used to select Models with the Transport Sub-Type)".
    if (pr.lordOfWarModelTag)
      for (const u of resolved)
        if (u.detDef.kind === 'LordOfWar' && !u.tags.has(pr.lordOfWarModelTag))
          err('PRIMARY-UNIT-LIMITS', `With ${who}, the Lord of War Detachment may only take ${pr.lordOfWarModelTag} units (not ${u.def.name})`, { detachmentId: u.det.id, slotId: u.slotId });
    // "Prime Advantages which add additional Battlefield Role Slots may not be selected."
    if (pr.noSlotAddingPrimes)
      for (const d of roster.detachments)
        for (const x of d.extraSlots)
          if (!pr.noSlotAddingPrimes.exceptRoles?.includes(x.role))
            err('PRIMARY-NO-SLOT-PRIMES', `${who}: ${primeDefs.get(x.grantedBy.primeAdvantageId)?.name ?? 'This Prime Advantage'} can't add slots${pr.noSlotAddingPrimes.exceptRoles ? ` (except ${pr.noSlotAddingPrimes.exceptRoles.map(roleLabel).join('/')} slots)` : ''}`, { detachmentId: d.id, slotId: x.grantedBy.slotId });
    // "An Army using this Primary Detachment must include at least one Model with the Master of the Legion Trait."
    if (pr.armyNeedsRule && !resolved.some((u) => u.def.rules?.includes(pr.armyNeedsRule!)))
      err('PRIMARY-UNIT-LIMITS', `${who} needs a unit with ${pr.armyNeedsRule} somewhere in the army`, pat);
    // Units of some types need Battlesmith (Fury: Command/Specialist; Spearhead: anything but Vehicles).
    if (pr.unitsNeedRule) {
      const { ifTags, ifNotTags, rule } = pr.unitsNeedRule;
      for (const u of resolved) {
        const applies = (ifTags && ifTags.some((t) => u.tags.has(t))) || (ifNotTags && !ifNotTags.some((t) => u.tags.has(t)));
        if (applies && !u.def.rules?.includes(rule))
          err('PRIMARY-UNIT-LIMITS', `With ${who}, ${u.def.name} needs the ${rule} (X) rule (${ifTags ? `${ifTags.join('/')} units` : `non-${ifNotTags!.join('/')} units`})`, { detachmentId: u.det.id, slotId: u.slotId });
      }
    }
    if (pr.noImmobile)
      for (const u of resolved.filter((x) => x.def.rules?.includes('Immobile')))
        err('PRIMARY-UNIT-LIMITS', `With ${who}, units with a Move of 0 or "-" can't be taken (${u.def.name})`, { detachmentId: u.det.id, slotId: u.slotId });
    // Its own extra slots: one per filled slot of some roles here, or per non-Vehicle unit in the army.
    const xs = pr.extraSlots;
    const added = primaryDet.benefitSlots ?? [];
    if (added.length && xs) {
      const filledHere = (role: string) => resolved.filter((u) => u.det === primaryDet && slotRoleOf(primaryDet, primaryDef, u.slotId) === role).length;
      const allowance = xs.perFilledRoles
        ? xs.perFilledRoles.reduce((s, r) => s + filledHere(r), 0)
        : xs.perNonVehicleUnit
          ? resolved.filter((u) => !u.tags.has('Vehicle')).length
          : 0;
      if (added.length > allowance)
        err('PRIMARY-EXTRA-SLOTS', `${who} has ${added.length} extra ${xs.roles.map(roleLabel).join('/')} slots but may add ${allowance} (one per ${xs.perFilledRoles ? `filled ${xs.perFilledRoles.map(roleLabel).join('/')} slot` : 'non-Vehicle unit in the army'})`, pat);
    }
    if (pr.warnUnlessTags)
      for (const u of resolved.filter((x) => !pr.warnUnlessTags!.some((t) => x.tags.has(t))))
        warn('PRIMARY-DEPLOYMENT', `${u.def.name} isn't ${pr.warnUnlessTags.join(' or ')}: with ${who} it can only deploy embarked on a Flyer transport, otherwise it's removed as a casualty`, { detachmentId: u.det.id, slotId: u.slotId });
  } else if (roster.detachments.some((d) => d.benefitSlots?.length)) {
    for (const d of roster.detachments.filter((x) => x.benefitSlots?.length))
      err('PRIMARY-EXTRA-SLOTS', `${resolvedDefs.get(d.id)?.name ?? 'This detachment'} has no benefit that adds slots`, { detachmentId: d.id });
  }

  // ── Rites of War ─────────────────────────────────────────────────────────
  const factionsByList = new Map<string, Set<string>>();
  for (const u of resolved) {
    if (!u.faction) continue;
    const set = factionsByList.get(u.def.armyList) ?? new Set();
    set.add(u.faction);
    factionsByList.set(u.def.armyList, set);
  }
  for (const [listId, factions] of factionsByList) {
    const list = listDefs.get(listId);
    if (!list?.requiresRiteOfWarPerFaction) continue;
    for (const f of factions) {
      const riteId = roster.ritesOfWar[f];
      const rite = list.rites.find((x) => x.id === riteId);
      if (!riteId) err('ARMY-RITE-OF-WAR', `No Rite of War chosen for ${f}`);
      else if (!rite || rite.factionTrait !== f) err('ARMY-RITE-OF-WAR', `"${riteId}" isn't a ${f} Rite of War`);
    }
  }

  // ── Unlock links ─────────────────────────────────────────────────────────
  const unitIn = (detId: string, slotId: string) => roster.detachments.find((d) => d.id === detId)?.fills.find((f) => f.slotId === slotId);
  const slotUse = new Map<string, DetachmentDef[]>();
  for (const det of roster.detachments) {
    const def = resolvedDefs.get(det.id);
    if (!def) continue;
    const at = { detachmentId: det.id };
    const needsUnlock = def.kind === 'Apex' || def.kind === 'Auxiliary';
    if (!needsUnlock) {
      if (det.unlockedBy) err('DET-UNLOCK-SOURCE', `${def.name} is always available and shouldn't be linked to a slot`, at);
      continue;
    }
    const link = det.unlockedBy;
    if (!link) {
      err('DET-UNLOCK-REQUIRED', `${def.name} (${def.kind}) needs a filled ${def.kind === 'Apex' ? 'High Command' : 'Command or High Command'} slot to unlock it`, at);
      continue;
    }
    const parent = dets.get(link.detachmentId);
    const parentDef = parent && resolvedDefs.get(parent.id);
    if (!parent || !parentDef) {
      err('DET-UNLOCK-REQUIRED', `${def.name} is linked to a detachment that isn't in the list`, at);
      continue;
    }
    const pslot = parentDef.slots.find((s) => s.id === link.slotId);
    const pfill = unitIn(parent.id, link.slotId);
    const key = `${parent.id}|${link.slotId}`;
    slotUse.set(key, [...(slotUse.get(key) ?? []), def]);

    if (!['Primary', 'Apex', 'Allied'].includes(parentDef.kind) || !parentDef.grantsUnlocks) {
      err('DET-UNLOCK-SOURCE', `Slots in ${parentDef.name} can't unlock other detachments`, at);
      continue;
    }
    if (!pslot || !pfill?.unit) {
      err('DET-UNLOCK-REQUIRED', `${def.name} is linked to an empty or missing slot in ${parentDef.name}; fill it first`, at);
      continue;
    }
    if (pfill.primeAdvantage === 'special-assignment')
      err('PRIME-SPECIAL-ASSIGNMENT', `The ${parentDef.name} Command slot used for Special Assignment can't unlock ${def.name}`, at);
    if (pslot.role === 'HighCommand') {
      if (parentDef.kind === 'Allied' && def.kind === 'Apex')
        err('DET-UNLOCK-ALLIED', `An Allied Detachment can only unlock Auxiliary detachments, not ${def.name}`, at);
    } else if (pslot.role === 'Command') {
      // Consul-Delegatus: this Command unit may unlock one Apex instead of an Auxiliary.
      const consul = pfill.primeAdvantage !== 'special-assignment' && unitDefs.get(pfill.unit.unitId)?.commandUnlocksApex;
      if (def.kind === 'Apex' && !consul) err('DET-UNLOCK-CMD', `${def.name} is an Apex detachment; it needs a High Command slot, not a Command slot`, at);
      if (def.kind === 'Apex' && consul && parentDef.kind === 'Allied')
        err('DET-UNLOCK-ALLIED', `An Allied Detachment can only unlock Auxiliary detachments, not ${def.name}`, at);
    } else {
      err('DET-UNLOCK-REQUIRED', `A ${roleLabel(pslot.role)} slot can't unlock detachments; only Command and High Command slots can`, at);
    }
  }
  for (const [key, kids] of slotUse) {
    const [detId, slotId] = key.split('|') as [string, string];
    const names = kids.map((k) => k.name);
    const pdet = dets.get(detId);
    const pslot = pdet && resolvedDefs.get(pdet.id)?.slots.find((s) => s.id === slotId);
    const pfill = pdet?.fills.find((f) => f.slotId === slotId);
    const unit = pfill?.primeAdvantage !== 'special-assignment' ? unitDefs.get(pfill?.unit?.unitId ?? '') : undefined;
    // Officer of the Line (X): a Command slot holding this unit unlocks X Auxiliary detachments.
    const officer = pslot?.role === 'Command' ? unit?.commandAuxUnlocks ?? 1 : 1;
    // Tank Commander (X): a (High) Command slot unlocks X Auxiliaries, if every one has only Armour slots.
    const tanksOnly = kids.every((k) => k.kind === 'Auxiliary' && k.slots.every((s) => s.role === 'Armour'));
    const tank = unit?.tankCommander && tanksOnly ? unit.tankCommander : 0;
    const allowance = Math.max(officer, tank);
    if (names.length > allowance) {
      const why =
        unit?.tankCommander && !tanksOnly && names.length <= unit.tankCommander
          ? `${unit.name} (Tank Commander (${unit.tankCommander})) unlocks ${unit.tankCommander} Auxiliary detachments only if each has only Armour slots (${names.join(', ')})`
          : allowance > 1
            ? `${unit!.name} (${tank >= officer ? `Tank Commander (${allowance})` : `Officer of the Line (${allowance})`}) unlocks ${allowance} Auxiliary detachments, but ${names.length} are linked to it (${names.join(', ')})`
            : `One slot is being used to unlock ${names.length} detachments (${names.join(', ')}); each slot unlocks one`;
      err('DET-UNLOCK-ONE', why, { detachmentId: detId, slotId });
    }
  }
  // Consul-Delegatus: "An Army may not include more than one Model with this Special Rule."
  const consuls = resolved.filter((u) => u.def.commandUnlocksApex);
  if (consuls.length > 1) err('ARMY-CONSUL-ONE', `The army has ${consuls.length} Consul-Delegatus units (${consuls.map((u) => u.def.name).join(', ')}); only one is allowed`);

  // Root of each detachment (Primary or Allied) + cycle detection.
  const rootOf = new Map<string, DetachmentInstance | null>();
  for (const det of roster.detachments) {
    const seen = new Set<string>();
    let cur: DetachmentInstance | undefined = det;
    let root: DetachmentInstance | null = null;
    while (cur) {
      if (seen.has(cur.id)) {
        err('DET-UNLOCK-CYCLE', `${resolvedDefs.get(det.id)?.name ?? det.id} is unlocked in a loop that never reaches the Primary or an Allied detachment`, { detachmentId: det.id });
        break;
      }
      seen.add(cur.id);
      const k = resolvedDefs.get(cur.id)?.kind;
      if (k === 'Primary' || k === 'Allied' || k === 'Warlord' || k === 'LordOfWar') {
        root = cur;
        break;
      }
      cur = cur.unlockedBy ? dets.get(cur.unlockedBy.detachmentId) : undefined;
    }
    rootOf.set(det.id, root);
  }

  // Linked army lists, Apex rooted at Primary.
  for (const det of roster.detachments) {
    const def = resolvedDefs.get(det.id);
    const root = rootOf.get(det.id);
    if (!def || !root || root === det) continue;
    if (def.armyListRule === 'linked' && det.armyList !== root.armyList)
      err('DET-LINKED-LIST', `${def.name} must use the same army list as the ${resolvedDefs.get(root.id)?.name} it is linked to`, { detachmentId: det.id });
    if (def.kind === 'Apex' && resolvedDefs.get(root.id)?.kind !== 'Primary')
      err('DET-UNLOCK-ALLIED', `${def.name} must trace back to the Primary Detachment`, { detachmentId: det.id });
  }

  // ── Faction relations ────────────────────────────────────────────────────
  const primaryFactions = new Set(resolved.filter((u) => u.det === primary && u.faction).map((u) => u.faction!));
  for (const det of roster.detachments) {
    const def = resolvedDefs.get(det.id);
    if (!def || !primary) continue;
    const units = resolved.filter((u) => u.det === det);
    const at = { detachmentId: det.id };
    if (def.armyListRule === 'primary' && det !== primary) {
      if (det.armyList !== primary.armyList)
        err('WARLORD-SAME-LIST', `${def.name} must use the Primary Detachment's army list`, at);
      const off = units.filter((u) => u.faction && !primaryFactions.has(u.faction));
      if (off.length) err('WARLORD-SAME-LIST', `${def.name} must match the Primary Detachment's Faction (${[...primaryFactions].join(', ')})`, at);
    }
    if (def.kind === 'Allied' || (rootOf.get(det.id) && resolvedDefs.get(rootOf.get(det.id)!.id)?.kind === 'Allied' && det !== rootOf.get(det.id))) {
      const clash = [...new Set(units.filter((u) => u.faction && primaryFactions.has(u.faction)).map((u) => u.faction!))];
      if (clash.length) {
        const sameFaction = primaryFactions.size === 1 && clash.length === 1;
        err(sameFaction ? 'ALLIED-FACTION' : 'ALLIED-FACTION-TRAITS', `Allied units share the Primary Detachment's Faction (${clash.join(', ')})`, at);
      }
    }
    if (def.armyListRule === 'anySingle') {
      const lists = new Set(units.map((u) => u.def.armyList));
      if (lists.size > 1) err('DET-LOW-SINGLE-LIST', `${def.name} mixes units from ${lists.size} army lists`, at);
    }
  }

  // ── Detachment requirements ──────────────────────────────────────────────
  const allUnitIds = new Set(resolved.map((u) => u.def.id));
  const primaryFaction = primary ? [...primaryFactions][0] : undefined;
  const ruleFor = (req: DetachmentRequirement, def: DetachmentDef): string => {
    if (req.kind === 'minPointsLimit' && def.kind === 'Warlord') return 'WARLORD-MIN-LIMIT';
    if (req.kind === 'detachmentIncludesModelTag' && req.tag === 'Paragon') return 'WARLORD-PARAGON';
    if (req.kind === 'riteOfWar') return 'ARMY-RITE-SCOPE';
    if (req.kind === 'unlockedByUnit' || req.kind === 'primaryIncludesUnit') return 'DET-UNLOCK-SPECIFIC';
    return 'DET-REQUIREMENT';
  };
  for (const det of roster.detachments) {
    const def = resolvedDefs.get(det.id);
    if (!def) continue;
    const at = { detachmentId: det.id };
    const units = resolved.filter((u) => u.det === det);
    const name = (ids: string[]) => ids.map((id) => unitDefs.get(id)?.name ?? id).join(' or ');
    for (const req of def.requirements) {
      const fail = (what: string) => err(ruleFor(req, def), what, at);
      switch (req.kind) {
        case 'minPointsLimit':
          if (limit < req.value) fail(`${def.name} needs a points limit of ${req.value.toLocaleString('en')}+ (this list: ${limit.toLocaleString('en')})`);
          break;
        case 'allegiance':
          if (roster.allegiance !== req.value) fail(`${def.name} is only for ${req.value} armies`);
          break;
        case 'primaryFaction':
          if (!primaryFaction || !req.factions.includes(primaryFaction)) fail(`${def.name} needs a ${req.factions.join('/')} Primary Detachment`);
          break;
        case 'riteOfWar': {
          const chosen = primaryFaction ? roster.ritesOfWar[primaryFaction] : undefined;
          if (!chosen || !req.rites.includes(chosen)) fail(`${def.name} comes from a Rite of War this army didn't choose`);
          break;
        }
        case 'armyIncludesUnit':
          if (!req.unitIds.some((id) => allUnitIds.has(id))) fail(`${def.name} needs ${name(req.unitIds)} somewhere in the army`);
          break;
        case 'primaryIncludesUnit': {
          const inPrimary = resolved.some((u) => u.det === primary && req.unitIds.includes(u.def.id));
          if (!inPrimary) fail(`${def.name} needs ${name(req.unitIds)} in the Primary Detachment`);
          break;
        }
        case 'detachmentIncludesUnit':
          if (!units.some((u) => req.unitIds.includes(u.def.id))) fail(`${def.name} must include ${name(req.unitIds)}`);
          break;
        case 'detachmentIncludesModelTag':
          if (!units.some((u) => u.tags.has(req.tag))) fail(`${def.name} must include a ${req.tag} model`);
          break;
        case 'unlockedByUnit': {
          const link = det.unlockedBy;
          const u = link ? unitIn(link.detachmentId, link.slotId)?.unit : undefined;
          const udef = u ? unitDefs.get(u.unitId) : undefined;
          const sub = u && udef ? (udef.subFactions ? u.subFaction : udef.subFaction) : undefined;
          if (!udef || !req.unitIds.includes(udef.id) || (req.allegiance && roster.allegiance !== req.allegiance) || (req.subFaction && sub !== req.subFaction))
            fail(`${def.name} is only unlocked by ${req.subFaction ? `a ${req.subFaction} ` : ''}${name(req.unitIds)} in a ${def.kind === 'Apex' ? 'High Command' : 'Command'} slot${req.allegiance ? ` (${req.allegiance})` : ''}`);
          break;
        }
        default:
          // A new *kind* of rule arrived as data. Refuse loudly rather than skip it.
          err('DATA-UNKNOWN', `${def.name} has a requirement of kind "${(req as { kind: string }).kind}" that this app version can't check`, at);
      }
    }
  }

  // ── Points ───────────────────────────────────────────────────────────────
  const points = resolved.reduce((s, u) => s + u.points, 0);
  if (points > limit) err('ARMY-POINTS', `The list is ${points.toLocaleString('en')} points, ${(points - limit).toLocaleString('en')} over the ${limit.toLocaleString('en')} limit`);

  const allied = resolved
    .filter((u) => { const root = rootOf.get(u.det.id); return root && resolvedDefs.get(root.id)?.kind === 'Allied'; })
    .reduce((s, u) => s + u.points, 0);
  const alliedCap = shareCap(limit, catalog.limits.alliedShare);
  if (allied > alliedCap) err('ALLIED-CAP', `Allied detachments total ${allied.toLocaleString('en')} points; the cap is ${alliedCap.toLocaleString('en')}`);

  const big = resolved
    .filter((u) => u.role === 'Warlord' || u.role === 'LordOfWar')
    .reduce((s, u) => s + u.points, 0);
  const bigCap = shareCap(limit, catalog.limits.warlordLordOfWarShare);
  if (big > bigCap) err('LOW-CAP', `Warlord and Lord of War units total ${big.toLocaleString('en')} points; the shared cap is ${bigCap.toLocaleString('en')}`);

  if (limit < catalog.limits.warlordMinPointsLimit)
    for (const u of resolved.filter((x) => x.role === 'Warlord'))
      err('WARLORD-MIN-LIMIT', `${u.def.name} is a Warlord unit, which needs a ${catalog.limits.warlordMinPointsLimit.toLocaleString('en')}+ point game`, { detachmentId: u.det.id, slotId: u.slotId, unitInstanceId: u.inst.id });

  return { legal: errors.length === 0, errors, warnings, totals: { points, allied, warlordAndLordOfWar: big } };
}
