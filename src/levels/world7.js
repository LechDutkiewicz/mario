// ============================================================
// WORLD 7 — converted from FSM World71-74 (the cannon world)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world71Data } from './data/world7-1.js';
import { world72Data } from './data/world7-2.js';
import { world73Data } from './data/world7-3.js';
import { world74Data } from './data/world7-4.js';
import { GROUND_Y } from '../constants.js';

export function buildWorld7(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0:  return _build71(subArea);
    case 1:  return _build72(subArea);
    case 2:  return loadFSMLevel(world73Data, 0);
    case 3:  return loadFSMLevel(world74Data, 0);
    default: return _build71(0);
  }
}

function _build71(subArea) {
  if (subArea === 1) return loadFSMLevel(world71Data, 1);   // coin vault
  const lvl = loadFSMLevel(world71Data, 0);
  lvl.exitSpawn = { x: 3684, y: GROUND_Y - 64 - 64 };       // entrance:1 pipe (x:920)
  return lvl;
}

// 7-2: 0 = entrance (auto-walk), 1 = underwater, 2 = overworld exit
function _build72(subArea) {
  if (subArea === 1) {
    const lvl = loadFSMLevel(world72Data, 1);
    lvl.flagPole = null;
    lvl.pokeCenterX = undefined;
    return lvl;
  }
  if (subArea === 2) {
    const lvl = loadFSMLevel(world72Data, 2);
    lvl.exitSpawn = { x: 16, y: GROUND_Y - 128 };           // emerge on the pipe
    return lvl;
  }
  const lvl = loadFSMLevel(world72Data, 0);
  lvl.flagPole      = null;
  lvl.pokeCenterX   = undefined;
  lvl.entrancePipeX = lvl.hPipeExits[0]?.x ?? 384;
  return lvl;
}
