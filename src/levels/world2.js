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
    case 1:  return _buildUnderground();
    case 2:  return _buildArea2();
    default: return _buildUnderground();
  }
}

function _buildArea0() {
  // Short overworld intro: PC building at left, wide ground, entrance pipe
  // Player auto-walks from PC into the pipe (cinematic, handled in game.js)
  const T = TILE, GY = GROUND_Y;
  const platforms = [];

  platforms.push(new Platform(0, GY, 24 * T, 120, COLORS.ground));

  // Entrance pipe — auto-walk target, pressing down enters underground
  const pipe = new PipeBlock(10 * T, 3, true);
  pipe.leadsToArea = 1;
  platforms.push(pipe);

  return {
    platforms,
    qblocks: [], enemies: [], coins: [], plants: [], movingPlatforms: [],
    boss: null,
    flagPole: null,
    pokeCenterX: 0,
    pokeShopX: undefined,
    entrancePipeX: 10 * T,  // used by auto-walk in game.js
    setting: 'overworld',
    get solids() { return [...this.platforms, ...this.qblocks]; },
    width: 24 * T,
  };
}

function _buildUnderground() {
  // Load underground from FSM JSON, then strip the auto-generated flagpole/PC
  // and add a real exit pipe at the end of the level.
  const T = TILE, GY = GROUND_Y;
  const lvl = loadFSMLevel(world11Data, 1);

  // Remove auto-generated flagpole and PC building — the underground exits
  // via a pipe at the end, not a flagpole.
  lvl.flagPole = null;
  lvl.pokeCenterX = undefined;

  // Add exit pipe just before the final brick wall (x≈5900px = tile ~184).
  // The floor section `{ "macro": "Floor", "x": 1266, "width": 256 }` goes
  // from px 5064 to 6088. We place the exit pipe at 5700px.
  const exitPipe = new PipeBlock(5700, 3, true);
  exitPipe.leadsToArea = 2;
  lvl.platforms.push(exitPipe);

  return lvl;
}

function _buildArea2() {
  // Short overworld exit section — ends with PokéShop
  const T = TILE, GY = GROUND_Y;
  const platforms = [];

  platforms.push(new Platform(0, GY, 20 * T, 120, COLORS.ground));

  // Exit pipe (cosmetic — marks where player emerged)
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
    pokeShopX: (14 + 3) * T,
    setting: 'overworld',
    get solids() { return [...this.platforms, ...this.qblocks]; },
    width: 20 * T,
  };
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
