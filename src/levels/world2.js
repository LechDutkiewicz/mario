// ============================================================
// WORLD 2 — 4 levels: 2-1, 2-2, 2-3, 2-4
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
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
    const lvl = loadFSMLevel(world21Data, 2);
    lvl.exitOverworldX = 5120;
    return lvl;
  }
  // subArea 0: overworld (area 0)
  const lvl = loadFSMLevel(world21Data, 0);
  for (const p of lvl.platforms) {
    if (p.transportId === 4) p.leadsToArea = 1;
  }
  return lvl;
}

// --- Level 2-2 ---
function _build22(subArea) {
  if (subArea === 1) {
    // Underwater area
    return loadFSMLevel(world22Data, 1);
  }
  if (subArea === 2) {
    // Overworld exit
    return loadFSMLevel(world22Data, 2);
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
