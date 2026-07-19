// ============================================================
// WORLD 3 — Night world (4 sub-levels), converted from FSM World31-34
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world31Data } from './data/world3-1.js';
import { world32Data } from './data/world3-2.js';
import { world33Data } from './data/world3-3.js';
import { world34Data } from './data/world3-4.js';
import { GROUND_Y } from '../constants.js';

export function buildWorld3(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0:  return _build31(subArea);
    case 1:  return _night(loadFSMLevel(world32Data, 0));
    case 2:  return _night(loadFSMLevel(world33Data, 0));
    case 3:  return loadFSMLevel(world34Data, 0);
    default: return _build31(0);
  }
}

function _night(lvl) {
  lvl.setting = 'night';
  return lvl;
}

function _build31(subArea) {
  if (subArea === 1) {
    // Underworld bonus (area 1)
    return loadFSMLevel(world31Data, 1);
  }
  if (subArea === 2) {
    // Sky Night bonus (vine climb, area 2)
    const lvl = _night(loadFSMLevel(world31Data, 2));
    lvl.flagPole = null;
    lvl.pokeCenterX = undefined;
    lvl.isSky = true;
    lvl.skyReturnX = 5088;   // FSM loc 2: xloc 1272 → back in the overworld
    return lvl;
  }
  // subArea 0: overworld night
  const lvl = _night(loadFSMLevel(world31Data, 0));
  // Returning from the underworld: emerge ON the entrance:1 pipe at x:536
  // (2144px, 2 tiles tall)
  lvl.exitSpawn = { x: 2148, y: GROUND_Y - 64 - 64 };
  return lvl;
}
