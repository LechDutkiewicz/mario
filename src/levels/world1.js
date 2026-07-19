// ============================================================
// WORLD 1 — Eevee's Adventure (4 sub-levels)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world11Data } from './data/world1-1.js';
import { world12Data } from './data/world1-2.js';
import { world13Data } from './data/world1-3.js';
import { world14Data } from './data/world1-4.js';
import { TILE, GROUND_Y, COLORS } from '../constants.js';
import { Platform, PipeBlock } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';

export function buildWorld1(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0:  return _buildLevel1_1(subArea);
    case 1:  return _buildLevel1_2(subArea);
    case 2:  return _buildLevel1_3();
    case 3:  return _buildLevel1_4();
    default: return _buildLevel1_1(0);
  }
}

// subArea 0 = overworld, 1 = underground bonus
function _buildLevel1_1(subArea = 0) {
  const fsmArea = subArea === 1 ? 1 : 0;
  const lvl = loadFSMLevel(world11Data, fsmArea);
  lvl.areaIndex = fsmArea;
  lvl.subArea   = subArea;
  if (subArea === 0) {
    // Returning from the underground bonus: emerge ON the entrance:1 pipe
    // at x:1304 (5216px, 2 tiles tall) — flag lives on the OVERWORLD level,
    // because the transition reads it from the freshly built target level
    lvl.exitSpawn = { x: 5220, y: GROUND_Y - 64 - 64 };
  }
  return lvl;
}

// subArea: 0 = overworld entrance (auto-walk only), 1 = underground, 2 = overworld exit (flagpole)
function _buildLevel1_2(subArea = 0) {
  const fsmArea = [0, 1, 3][subArea] ?? 1;
  const lvl = loadFSMLevel(world12Data, fsmArea);
  lvl.areaIndex = fsmArea;
  lvl.subArea   = subArea;
  if (subArea === 0) {
    // Tiny auto-walk entrance — no flag, no Pokemon Center, no pipe exit visuals
    lvl.flagPole      = null;
    lvl.pokeCenterX   = null;
    lvl.hPipeExits    = [];
    lvl.entrancePipeX = 96 * 4; // 384px — vertical pipe player exits from underground
  }
  return lvl;
}

function _buildLevel1_3() {
  const lvl = loadFSMLevel(world13Data, 0);
  lvl.areaIndex = 0;
  return lvl;
}

function _buildLevel1_4() {
  const lvl = loadFSMLevel(world14Data, 0);
  lvl.setting = 'castle';
  lvl.areaIndex = 0;
  return lvl;
}
