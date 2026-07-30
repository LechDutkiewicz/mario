// ============================================================
// WORLD 5 — converted from FSM World51-54 (introduces Cannons)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world51Data } from './data/world5-1.js';
import { world52Data } from './data/world5-2.js';
import { world53Data } from './data/world5-3.js';
import { world54Data } from './data/world5-4.js';
import { GROUND_Y } from '../constants.js';

export function buildWorld5(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0:  return _build51(subArea);
    case 1:  return _build52(subArea);
    case 2:  return loadFSMLevel(world53Data, 0);
    case 3:  return loadFSMLevel(world54Data, 0);
    default: return _build51(0);
  }
}

function _build51(subArea) {
  if (subArea === 1) return loadFSMLevel(world51Data, 1);   // underworld bonus
  const lvl = loadFSMLevel(world51Data, 0);
  lvl.exitSpawn = { x: 5220, y: GROUND_Y - 64 - 64 };       // entrance:1 pipe (x:1304)
  return lvl;
}

// 5-2: 0 = overworld, 1 = underwater bonus, 2 = sky bonus (vine)
function _build52(subArea) {
  if (subArea === 1) return loadFSMLevel(world52Data, 1);
  if (subArea === 2) {
    const lvl = loadFSMLevel(world52Data, 2);
    lvl.flagPole = null;
    lvl.pokeCenterX = undefined;
    lvl.isSky = true;
    lvl.skyReturnX = 4128;                                  // FSM loc 2: xloc 1032
    return lvl;
  }
  const lvl = loadFSMLevel(world52Data, 0);
  lvl.exitSpawn = { x: 3684, y: GROUND_Y - 64 - 64 };       // entrance:1 pipe (x:920)
  return lvl;
}
