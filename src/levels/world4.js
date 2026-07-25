// ============================================================
// WORLD 4 — converted from FSM World41-44
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world41Data } from './data/world4-1.js';
import { world42Data } from './data/world4-2.js';
import { world43Data } from './data/world4-3.js';
import { world44Data } from './data/world4-4.js';
import { GROUND_Y } from '../constants.js';

export function buildWorld4(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0:  return _build41(subArea);
    case 1:  return _build42(subArea);
    case 2:  return loadFSMLevel(world43Data, 0);
    case 3:  return loadFSMLevel(world44Data, 0);
    default: return _build41(0);
  }
}

function _build41(subArea) {
  if (subArea === 1) return loadFSMLevel(world41Data, 1);   // underworld bonus
  const lvl = loadFSMLevel(world41Data, 0);
  lvl.lakituStopX = 6656;                                    // FSM zoneDisableLakitu
  lvl.exitSpawn = { x: 5220, y: GROUND_Y - 64 - 64 };        // entrance:1 pipe
  return lvl;
}

// 4-2: 0 = entrance (auto-walk), 1 = main underworld, 2 = side bonus,
//      3 = overworld exit, 4 = sky bonus (vine)
function _build42(subArea) {
  if (subArea === 1) {
    const lvl = loadFSMLevel(world42Data, 1);
    lvl.flagPole = null;
    lvl.pokeCenterX = undefined;
    // Coming back from the side bonus: emerge on the entrance:2 pipe (x:1048)
    lvl.exitSpawn = { x: 4196, y: GROUND_Y - 64 - 64 };
    return lvl;
  }
  if (subArea === 2) return loadFSMLevel(world42Data, 2);    // side underworld bonus
  if (subArea === 3) {
    const lvl = loadFSMLevel(world42Data, 3);                // overworld exit + flag
    lvl.exitSpawn = { x: 16, y: GROUND_Y - 128 };            // emerge on the pipe
    return lvl;
  }
  if (subArea === 4) {
    const lvl = loadFSMLevel(world42Data, 4);                // mushroom sky bonus
    lvl.flagPole = null;
    lvl.pokeCenterX = undefined;
    lvl.isSky = true;
    lvl.skyReturnX = 2048;
    return lvl;
  }
  // subArea 0: short entrance, auto-walk into the horizontal pipe
  const lvl = loadFSMLevel(world42Data, 0);
  lvl.flagPole      = null;
  lvl.pokeCenterX   = undefined;
  lvl.entrancePipeX = lvl.hPipeExits[0]?.x ?? 384;
  return lvl;
}
