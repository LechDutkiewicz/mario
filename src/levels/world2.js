// ============================================================
// WORLD 1-2 — Underground (based on SMB 1-2 layout)
// ============================================================
import { TILE, GROUND_Y, COLORS } from '../constants.js';
import { Platform, QuestionBlock, PipeBlock } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';
import { Enemy } from '../entities/enemy.js';
import { Coin } from '../entities/coin.js';
import { PipePlant } from '../entities/pipeplant.js';

export function buildWorld2() {
  const T = TILE;        // 32
  const GY = GROUND_Y;  // 540

  const gx = n => n * T;
  const gy = n => GY - n * T;

  const platforms = [];
  const qblocks   = [];
  const enemies   = [];
  const coins     = [];
  const plants    = [];

  // --- GROUND sections ---
  const addGround = (startTile, endTile) => {
    const x = gx(startTile);
    const w = gx(endTile - startTile);
    platforms.push(new Platform(x, GY, w, 120, '#3a2a1a'));
  };

  addGround(0, 80);
  addGround(83, 117);
  addGround(119, 121);
  addGround(123, 135);
  addGround(143, 151);
  addGround(158, 190);

  // --- CEILING ---
  const ceilingY = gy(10) - T;
  const addCeiling = (startTile, endTile) => {
    platforms.push(new Platform(gx(startTile), ceilingY, gx(endTile - startTile), T, '#8b6914'));
  };
  addCeiling(6, 89);
  addCeiling(90, 135);
  addCeiling(159, 166);
  addCeiling(168, 185);

  // Left brick wall at entrance
  platforms.push(new Platform(0, gy(10), T, T * 10, '#8b6914'));

  // --- Q-BLOCKS ---
  const Q = (tx, ty, c = 'pokeball') => {
    const q = new QuestionBlock(gx(tx), gy(ty) - T, c);
    qblocks.push(q);
    return q;
  };

  Q(10, 4, 'grow');
  Q(11, 4, 'coin'); Q(12, 4, 'coin'); Q(13, 4, 'coin'); Q(14, 4, 'coin');
  Q(69, 5, 'grow');
  Q(73, 5, 'coin');

  // --- BRICKS ---
  const brick = (tx, ty, tw = 1) => {
    platforms.push(new Platform(gx(tx), gy(ty) - T, gx(tw), T, '#8b6914'));
  };

  // Section 1: small formation (~tiles 36-43)
  brick(36, 4); brick(37, 4); brick(38, 4);
  brick(39, 5); brick(40, 5); brick(41, 5);

  // Section 2: main elevated walkway — flat platforms at height 4 (reachable from ground)
  // Approach staircase at 48-51 ramps the player up to height 4,
  // then they run across the three platform groups.
  brick(52, 4, 5);   // tiles 52-56
  brick(58, 4, 5);   // tiles 58-62
  brick(64, 4, 6);   // tiles 64-69

  // Section 3: mid-level platforms
  brick(72, 4, 4);   // tiles 72-75
  brick(77, 4, 4);   // tiles 77-80
  brick(84, 4, 6);   // tiles 84-89

  // End wall columns (player passes under them at ground level)
  brick(163, 4); brick(163, 5); brick(163, 6); brick(163, 7); brick(163, 8);
  brick(164, 4); brick(164, 5); brick(164, 6); brick(164, 7); brick(164, 8);
  brick(188, 4); brick(188, 5); brick(188, 6); brick(188, 7); brick(188, 8);
  brick(189, 4); brick(189, 5); brick(189, 6); brick(189, 7); brick(189, 8);
  brick(189, 9); brick(189, 10);

  // --- STONE STAIRCASES ---
  const step = (tx, th) =>
    platforms.push(new Platform(gx(tx), GY - T * th, T, T * th, '#5a5a6a'));

  // Adjacent ascending/descending pillars — no gaps so enemies traverse naturally
  step(17, 1); step(18, 2); step(19, 3); step(20, 4); step(21, 4);
  step(22, 3); step(23, 2); step(24, 1);
  step(27, 1); step(28, 2); step(29, 3); step(30, 3); step(31, 2); step(32, 1);
  // Approach ramp leading up to the elevated brick section
  step(48, 1); step(49, 2); step(50, 3); step(51, 4);
  step(130, 1); step(131, 2); step(132, 3); step(133, 4); step(134, 4);

  // --- PIPES ---
  platforms.push(new PipeBlock(gx(100), 3, false));
  platforms.push(new PipeBlock(gx(106), 4, false));
  platforms.push(new PipeBlock(gx(112), 2, false));

  // Pipe plants
  plants.push(new PipePlant(gx(100), GY - T * 3));
  plants.push(new PipePlant(gx(106), GY - T * 4));

  // --- ENEMIES ---
  const E = (tx, type = 'ekans') => enemies.push(new Enemy(gx(tx), GY, type));
  const Ep = (tx, th, type = 'ekans') => enemies.push(new Enemy(gx(tx), gy(th), type));

  E(16); E(25); E(61); E(62);
  Ep(20, 4); Ep(22, 3);  // on adjacent step pillars — walk off and descend naturally
  E(76); E(77);
  E(96); E(98); E(100);
  E(109);
  E(131); Ep(132, 3); Ep(133, 4);
  enemies.push(new Enemy(gx(44), GY, 'koffing'));
  enemies.push(new Enemy(gx(59), GY, 'koffing'));
  enemies.push(new Enemy(gx(144), GY, 'koffing'));

  // --- COINS ---
  const C = (tx, ty) => coins.push(new Coin(gx(tx) + 6, gy(ty + 1) + 4));
  // Pokéballs float just above the height-4 platforms (height 5 = 1 tile above)
  C(36, 5); C(37, 5); C(38, 5);
  C(52, 5); C(53, 5); C(54, 5); C(55, 5);
  C(58, 5); C(59, 5); C(60, 5); C(61, 5);
  C(84, 5); C(85, 5); C(86, 5); C(87, 5); C(88, 5); C(89, 5);

  // --- FLAGPOLE ---
  const flagPoleObj = new FlagPole(gx(185));

  const pokeCenterX = gx(190);
  const LEVEL_WIDTH = 200 * T;

  return {
    platforms,
    qblocks,
    enemies,
    coins,
    plants,
    boss: null,
    flagPole: flagPoleObj,
    pokeCenterX,
    setting: 'underground',
    get solids() { return [...platforms, ...qblocks]; },
    width: LEVEL_WIDTH,
  };
}
