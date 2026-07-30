// ============================================================
// WORLD 6 — converted from FSM World61-64 (night world)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world61Data } from './data/world6-1.js';
import { world62Data } from './data/world6-2.js';
import { world63Data } from './data/world6-3.js';
import { world64Data } from './data/world6-4.js';

export function buildWorld6(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0:  return _night(loadFSMLevel(world61Data, 0), 5632);   // Lakitu quits at x:1408
    case 1:  return _build62(subArea);
    case 2:  return _night(loadFSMLevel(world63Data, 0));
    case 3:  return loadFSMLevel(world64Data, 0);
    default: return _night(loadFSMLevel(world61Data, 0), 5632);
  }
}

function _night(lvl, lakituStopX) {
  lvl.setting = 'night';
  if (lakituStopX) lvl.lakituStopX = lakituStopX;
  return lvl;
}

// 6-2: 0 = main, 1 = first underworld, 2 = underwater, 3 = sky, 4 = second underworld
function _build62(subArea) {
  if (subArea === 1) return loadFSMLevel(world62Data, 1);
  if (subArea === 2) return loadFSMLevel(world62Data, 2);
  if (subArea === 3) {
    const lvl = _night(loadFSMLevel(world62Data, 3));
    lvl.flagPole = null;
    lvl.pokeCenterX = undefined;
    lvl.isSky = true;
    lvl.skyReturnX = 5216;                     // FSM loc 3: xloc 1304
    return lvl;
  }
  if (subArea === 4) return loadFSMLevel(world62Data, 4);
  return _night(loadFSMLevel(world62Data, 0));
}

// Where the player emerges on the main level when leaving each bonus area
export const WORLD62_RETURN_X = { 1: 1120, 2: 3680, 4: 5728 };
