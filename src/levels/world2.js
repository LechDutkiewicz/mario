// ============================================================
// WORLD 2 — 4 levels: 2-1, 2-2, 2-3, 2-4
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { GROUND_Y } from '../constants.js';
import { world21Data } from './data/world2-1.js';
import { world22Data } from './data/world2-2.js';
import { world23Data } from './data/world2-3.js';
import { world24Data } from './data/world2-4.js';

export function buildWorld2(levelIndex = 0, subArea = 0) {
  switch (levelIndex) {
    case 0: return _build21(subArea);
    case 1: return _build22(subArea);
    case 2: return _build23(subArea);
    case 3: return _build24(subArea);
    default: return _build21(subArea);
  }
}

// --- Level 2-1 ---
function _build21(subArea) {
  if (subArea === 1) {
    // Underground: area index 2 in 2-1 JSON
    return loadFSMLevel(world21Data, 2);
  }
  if (subArea === 2) {
    // Sky bonus area (vine climb) — area index 1 in 2-1 JSON
    const lvl = loadFSMLevel(world21Data, 1);
    lvl.flagPole = null;
    lvl.pokeCenterX = undefined;
    lvl.isSky = true;
    lvl.skyReturnX = 5152;   // FSM location 1: xloc 1288 → back in the overworld
    return lvl;
  }
  // subArea 0: overworld (area 0)
  const lvl = loadFSMLevel(world21Data, 0);
  for (const p of lvl.platforms) {
    if (p.transportId === 4) p.leadsToArea = 1;
  }
  // Returning from the underground: emerge ON the entrance:2 pipe at x:920
  // (3680px, 2 tiles tall)
  lvl.exitSpawn = { x: 3684, y: GROUND_Y - 64 - 64 };
  return lvl;
}

// --- Level 2-2 ---
function _build22(subArea) {
  if (subArea === 1) {
    // Underwater area
    return loadFSMLevel(world22Data, 1);
  }
  if (subArea === 2) {
    // Overworld exit — emerge ON the pipe at x:0 (default x=80 would spawn
    // the player inside the first staircase step)
    const lvl = loadFSMLevel(world22Data, 2);
    lvl.exitSpawn = { x: 16, y: GROUND_Y - 128 };
    return lvl;
  }
  // subArea 0: short overworld entrance
  const lvl = loadFSMLevel(world22Data, 0);
  lvl.entrancePipeX = lvl.hPipeExits[0]?.x;
  return lvl;
}

// --- Level 2-3 ---
function _build23(subArea) {
  return loadFSMLevel(world23Data, 0);
}

// --- Level 2-4 ---
function _build24(subArea) {
  return loadFSMLevel(world24Data, 0);
}
