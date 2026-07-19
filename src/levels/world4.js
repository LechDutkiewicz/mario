// ============================================================
// WORLD 4 — converted from FSM World41+ (currently only 4-1)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world41Data } from './data/world4-1.js';
import { GROUND_Y } from '../constants.js';

export function buildWorld4(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0:  return _build41(subArea);
    default: return _build41(0);
  }
}

function _build41(subArea) {
  if (subArea === 1) {
    // Underworld bonus (area 1)
    return loadFSMLevel(world41Data, 1);
  }
  // subArea 0: overworld
  const lvl = loadFSMLevel(world41Data, 0);
  // Zubat (Lakitu) gives up past the final staircase (FSM zoneDisableLakitu)
  lvl.lakituStopX = 6656;   // 1664 * 4
  // Returning from the underworld: emerge ON the entrance:1 pipe at x:1304
  // (5216px, 2 tiles tall)
  lvl.exitSpawn = { x: 5220, y: GROUND_Y - 64 - 64 };
  return lvl;
}
