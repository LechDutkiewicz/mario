// ============================================================
// WORLD 2 — Multi-area: Overworld intro → Underground → Overworld exit
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world11Data } from './data/world1-1.js';
import { TILE, GROUND_Y, COLORS } from '../constants.js';
import { Platform, PipeBlock } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';

export function buildWorld2(areaIndex = 0) {
  switch (areaIndex) {
    case 0:  return _buildArea0();
    case 1:  return loadFSMLevel(world11Data, 1);
    case 2:  return _buildArea2();
    default: return loadFSMLevel(world11Data, 1);
  }
}

function _buildArea0() {
  // Short overworld intro: PC building at left, wide ground, entrance pipe
  const T = TILE, GY = GROUND_Y;
  const platforms = [];

  // Wide ground floor (24 tiles)
  platforms.push(new Platform(0, GY, 24 * T, 120, COLORS.ground));

  // Entrance pipe — player presses down to enter underground (area 1)
  const pipe = new PipeBlock(10 * T, 3, true);
  pipe.leadsToArea = 1;
  platforms.push(pipe);

  return {
    platforms,
    qblocks: [], enemies: [], coins: [], plants: [], movingPlatforms: [],
    boss: null,
    flagPole: null,
    pokeCenterX: 0,       // PC building drawn at world x=0
    pokeShopX: undefined,
    setting: 'overworld',
    get solids() { return [...this.platforms, ...this.qblocks]; },
    width: 24 * T,
  };
}

function _buildArea2() {
  // Short overworld exit — ends with PokéShop
  const T = TILE, GY = GROUND_Y;
  const platforms = [];

  // Ground floor (20 tiles)
  platforms.push(new Platform(0, GY, 20 * T, 120, COLORS.ground));

  // Exit pipe (cosmetic — marks where player came out)
  platforms.push(new PipeBlock(2 * T, 3, false));

  // Small ascending staircase before the shop
  for (let i = 1; i <= 3; i++) {
    platforms.push(new Platform((7 + i) * T, GY - i * T, T, i * T, COLORS.brick));
  }

  const fp = new FlagPole(14 * T);

  return {
    platforms,
    qblocks: [], enemies: [], coins: [], plants: [], movingPlatforms: [],
    boss: null,
    flagPole: fp,
    pokeCenterX: undefined,
    pokeShopX: (14 + 3) * T,  // PokéShop building drawn here
    setting: 'overworld',
    get solids() { return [...this.platforms, ...this.qblocks]; },
    width: 20 * T,
  };
}
