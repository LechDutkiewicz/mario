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

export function buildWorld1(levelIndex = 0) {
  switch (levelIndex) {
    case 0:  return _buildLevel1_1();
    case 1:  return _buildLevel1_2();
    case 2:  return _buildLevel1_3();
    case 3:  return _buildLevel1_4();
    default: return _buildLevel1_1();
  }
}

function _buildLevel1_1() {
  const lvl = loadFSMLevel(world11Data, 0);
  lvl.areaIndex = 0;
  return lvl;
}

function _buildLevel1_2() {
  const lvl = loadFSMLevel(world12Data, 1);
  lvl.areaIndex = 1;
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
