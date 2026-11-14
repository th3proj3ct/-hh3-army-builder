import {
  addDetachment,
  emptyState,
  placeUnit,
  setOptionCount,
  setPrime,
  updateUnit,
  type BuilderState,
} from './state';

/** The legal 3,000 pt Death Guard list from test/death-guard.test.ts, built with UI operations. */
export function deathGuardSample(): BuilderState {
  let s = emptyState('Death Guard', 3000, 'Traitor');
  s = { ...s, roster: { ...s.roster, name: 'Death Guard sample (3,000)', missionId: 'core' } };
  const P = 'primary';
  const slot = (def: string, suffix: string) => `${def}.${suffix}`;
  const put = (det: string, def: string, suffix: string, unit: string, models?: number) => {
    s = placeUnit(s, det, slot(def, suffix), unit);
    if (models) s = updateUnit(s, det, slot(def, suffix), (u) => ({ ...u, models }));
  };

  put(P, 'crusade-primary', 'HighCommand1', 'calas-typhon');
  put(P, 'crusade-primary', 'Command1', 'centurion');
  s = setPrime(s, P, slot('crusade-primary', 'Command1'), 'unnatural-resilience');
  put(P, 'crusade-primary', 'Command2', 'centurion');
  put(P, 'crusade-primary', 'Command3', 'centurion');
  put(P, 'crusade-primary', 'Troops1', 'tactical-squad', 20);
  s = setPrime(s, P, slot('crusade-primary', 'Troops1'), 'master-sergeant');
  put(P, 'crusade-primary', 'Troops2', 'tactical-squad');
  put(P, 'crusade-primary', 'Troops3', 'inductii-squad-death-guard');
  put(P, 'crusade-primary', 'Transport1', 'rhino');
  put(P, 'crusade-primary', 'Transport2', 'rhino');

  const add = (defId: string, from?: string) => {
    const r = addDetachment(s, defId, from ? { detachmentId: P, slotId: slot('crusade-primary', from) } : undefined);
    s = r.state;
    return r.id;
  };
  const wl = add('warlord');
  put(wl, 'warlord', 'Warlord1', 'mortarion');
  put(wl, 'warlord', 'Retinue1', 'deathshroud-terminator-squad', 5);
  s = setOptionCount(s, wl, slot('warlord', 'Retinue1'), 'deathshroud--melta-bombs', 5);
  put(wl, 'warlord', 'HeavyTransport1', 'land-raider-carrier');

  const av = add('army-vanguard', 'HighCommand1');
  put(av, 'army-vanguard', 'Elites1', 'mortus-poisoner-squad', 10);
  const rh = add('reaping-host', 'Command1');
  put(rh, 'reaping-host', 'Troops1', 'tactical-squad');
  put(rh, 'reaping-host', 'Support1', 'apothecary');
  put(rh, 'reaping-host', 'HeavyAssault1', 'grave-warden-terminator-squad');
  const as = add('armoured-support', 'Command2');
  put(as, 'armoured-support', 'Armour1', 'predator');
  put(as, 'armoured-support', 'Armour2', 'predator');
  const hs = add('heavy-support', 'Command3');
  put(hs, 'heavy-support', 'WarEngine1', 'contemptor-dreadnought');
  return s;
}
