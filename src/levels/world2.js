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

  // Brick formations
  brick(39, 4); brick(39, 5); brick(39, 6);
  brick(40, 4);
  brick(41, 4); brick(41, 5); brick(41, 6);
  brick(42, 6); brick(43, 6);
  brick(52, 4); brick(52, 5); brick(52, 6); brick(52, 7); brick(52, 8);
  brick(53, 4); brick(53, 5); brick(53, 6); brick(53, 7); brick(53, 8);
  brick(54, 2); brick(54, 3); brick(54, 4);
  brick(55, 2); brick(55, 3); brick(55, 4);
  brick(54, 9); brick(54, 10); brick(55, 9); brick(55, 10);
  brick(58, 4); brick(59, 4); brick(60, 4); brick(61, 4);
  brick(58, 9); brick(59, 9); brick(60, 9); brick(61, 9); brick(62, 9);
  brick(62, 4); brick(62, 5); brick(62, 6); brick(62, 7); brick(62, 8);
  brick(63, 4); brick(63, 5); brick(63, 6); brick(63, 7); brick(63, 8);
  brick(66, 9); brick(67, 9); brick(68, 9); brick(69, 9);
  brick(67, 4); brick(67, 5); brick(67, 6); brick(67, 7); brick(67, 8);
  brick(72, 4); brick(73, 4); brick(74, 4);
  brick(72, 5); brick(72, 6); brick(72, 7); brick(72, 8); brick(72, 9);
  brick(73, 5); brick(73, 6);
  brick(76, 4); brick(77, 4); brick(78, 4); brick(79, 4);
  brick(76, 9); brick(77, 9); brick(78, 9); brick(79, 9);
  brick(84, 5); brick(85, 5); brick(86, 5); brick(87, 5); brick(88, 5); brick(89, 5);
  brick(84, 6); brick(85, 6); brick(86, 6); brick(87, 6); brick(88, 6); brick(89, 6);
  brick(163, 4); brick(163, 5); brick(163, 6); brick(163, 7); brick(163, 8);
  brick(164, 4); brick(164, 5); brick(164, 6); brick(164, 7); brick(164, 8);
  brick(188, 4); brick(188, 5); brick(188, 6); brick(188, 7); brick(188, 8);
  brick(189, 4); brick(189, 5); brick(189, 6); brick(189, 7); brick(189, 8);
  brick(189, 9); brick(189, 10);

  // --- STONE STAIRCASES ---
  const step = (tx, th) =>
    platforms.push(new Platform(gx(tx), GY - T * th, T, T * th, '#5a5a6a'));

  step(17, 1); step(19, 2); step(21, 3); step(23, 4); step(25, 4); step(27, 3); step(31, 3); step(33, 2);
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

  E(16); E(29); E(61); E(62);
  Ep(17, 2); Ep(21, 4);
  E(76); E(77);
  E(96); E(98); E(100);
  E(109);
  E(131); Ep(132, 3); Ep(133, 4);
  enemies.push(new Enemy(gx(44), GY, 'koffing'));
  enemies.push(new Enemy(gx(59), GY, 'koffing'));
  enemies.push(new Enemy(gx(144), GY, 'koffing'));

  // --- COINS ---
  const C = (tx, ty) => coins.push(new Coin(gx(tx) + 6, gy(ty + 1) + 4));
  C(41, 8); C(42, 8); C(43, 8); C(44, 8);
  C(58, 5); C(59, 5); C(60, 5); C(61, 5);
  C(84, 8); C(85, 8); C(86, 8); C(87, 8); C(88, 8); C(89, 8);

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
