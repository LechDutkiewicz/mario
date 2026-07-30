// ============================================================
// WORLD 8 — converted from FSM World81-84 (the final world)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world81Data } from './data/world8-1.js';
import { world82Data } from './data/world8-2.js';
import { world83Data } from './data/world8-3.js';
import { world84Data } from './data/world8-4.js';
import { GROUND_Y } from '../constants.js';

export function buildWorld8(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0:  return _build81(subArea);
    case 1:  return _build82(subArea);
    case 2:  return loadFSMLevel(world83Data, 0);
    case 3:  return _build84(subArea);
    default: return _build81(0);
  }
}

function _build81(subArea) {
  if (subArea === 1) return loadFSMLevel(world81Data, 1);
  const lvl = loadFSMLevel(world81Data, 0);
  lvl.exitSpawn = { x: 3684, y: GROUND_Y - 64 - 64 };   // entrance:1 pipe (x:920)
  return lvl;
}

function _build82(subArea) {
  if (subArea === 1) return loadFSMLevel(world82Data, 1);
  const lvl = loadFSMLevel(world82Data, 0);
  lvl.lakituStopX = 6592;                                // FSM zoneDisableLakitu (x:1648)
  lvl.exitSpawn = { x: 5220, y: GROUND_Y - 64 - 64 };    // entrance:1 pipe (x:1304)
  return lvl;
}

// 8-4 maze: five rooms, sub-area N = FSM area N. Only one pipe per room
// leads onward; the others drop you back into room 0.
function _build84(subArea) {
  const lvl = loadFSMLevel(world84Data, Math.min(subArea, 4));
  if (subArea !== 4) { lvl.flagPole = null; lvl.pokeCenterX = undefined; }
  return lvl;
}
