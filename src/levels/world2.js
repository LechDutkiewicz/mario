// ============================================================
// WORLD 1-2 — Underground (based on SMB 1-2 layout)
// ============================================================
import { TILE, GROUND_Y, COLORS } from '../constants.js';
import { Platform, QuestionBlock, PipeBlock, BrickBlock, MovingPlatform } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';
import { Enemy } from '../entities/enemy.js';
import { Coin } from '../entities/coin.js';
import { PipePlant } from '../entities/pipeplant.js';

export function buildWorld2() {
  const T = TILE;        // 32
  const GY = GROUND_Y;  // 540

  const gx = n => n * T;
  const gy = n => GY - n * T;

  const platforms      = [];
  const qblocks        = [];
  const enemies        = [];
  const coins          = [];
  const plants         = [];
  const movingPlatforms = [];

  // --- GROUND sections ---
  const addGround = (startTile, endTile) => {
    platforms.push(new Platform(gx(startTile), GY, gx(endTile - startTile), 120, '#3a2a1a'));
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
  // Q-blocks sit 1 tile above height-4 platforms; leave their tile column open
  Q(69, 5, 'grow');
  Q(73, 5, 'coin');

  // --- BREAKABLE BRICKS ---
  // Individual BrickBlock tiles (big player breaks them, small player bounces)
  const brick = (tx, ty) => {
    const b = new BrickBlock(gx(tx), gy(ty) - T);
    platforms.push(b);
    return b;
  };
  // Solid (unbreakable) brick-textured platform spanning multiple tiles
  const solidRow = (tx, ty, tw) => {
    platforms.push(new Platform(gx(tx), gy(ty) - T, gx(tw), T, '#8b6914'));
  };

  // Section 1: small formation near Q-blocks (tiles 36-41)
  solidRow(36, 4, 3);  // tiles 36-38 — solid platform the player runs on
  brick(39, 5); brick(40, 5); brick(41, 5);  // breakable bricks above

  // Section 2: main elevated walkway — flat at height 4, Q-block columns left open
  solidRow(52, 4, 5);   // tiles 52-56
  solidRow(58, 4, 5);   // tiles 58-62
  solidRow(64, 4, 5);   // tiles 64-68  (tile 69 left open → Q(69,5) accessible)
  solidRow(70, 4, 2);   // tiles 70-71

  // Breakable bricks scattered above the walkway
  brick(53, 5); brick(55, 5);
  brick(58, 5); brick(61, 5);

  // Section 3: mid-level platforms with breakable bricks
  solidRow(72, 4, 2);   // tiles 72-73  (tile 73 has Q(73,5) — need tile 73 open)
  // tile 73 intentionally absent from solidRow; player jumps up to hit Q(73,5)
  solidRow(74, 4, 2);   // tiles 74-75
  solidRow(77, 4, 4);   // tiles 77-80
  solidRow(84, 4, 6);   // tiles 84-89

  brick(72, 5); brick(75, 5);
  brick(77, 5); brick(80, 5);

  // End wall columns — solid (stone feel, player passes under at ground level)
  solidRow(163, 4, 2); solidRow(163, 5, 2); solidRow(163, 6, 2);
  solidRow(163, 7, 2); solidRow(163, 8, 2);
  solidRow(188, 4, 2); solidRow(188, 5, 2); solidRow(188, 6, 2);
  solidRow(188, 7, 2); solidRow(188, 8, 2);
  solidRow(189, 9, 1); solidRow(189, 10, 1);

  // --- STONE STAIRCASES ---
  const step = (tx, th) =>
    platforms.push(new Platform(gx(tx), GY - T * th, T, T * th, '#5a5a6a'));

  // Adjacent ascending/descending pillars — no gaps so enemies traverse naturally
  step(17, 1); step(18, 2); step(19, 3); step(20, 4); step(21, 4);
  step(22, 3); step(23, 2); step(24, 1);
  step(27, 1); step(28, 2); step(29, 3); step(30, 3); step(31, 2); step(32, 1);
  // Approach ramp to the elevated brick section
  step(48, 1); step(49, 2); step(50, 3); step(51, 4);
  step(130, 1); step(131, 2); step(132, 3); step(133, 4); step(134, 4);

  // --- PIPES ---
  platforms.push(new PipeBlock(gx(100), 3, false));
  platforms.push(new PipeBlock(gx(106), 4, false));
  platforms.push(new PipeBlock(gx(112), 2, false));

  // Pipe plants
  plants.push(new PipePlant(gx(100), GY - T * 3));
  plants.push(new PipePlant(gx(106), GY - T * 4));

  // --- MOVING PLATFORMS (lifts) over large gaps ---
  // Gap at tiles 135-143 (8 tiles = 256px): horizontal lift
  movingPlatforms.push(new MovingPlatform(
    gx(135), GY - T,   // start just above ground level
    T * 3, T / 2,       // 3 tiles wide, half-tile tall
    'x', 1.2, gx(7)    // horizontal, speed 1.2, range 7 tiles
  ));
  // Gap at tiles 151-158 (7 tiles = 224px): horizontal lift
  movingPlatforms.push(new MovingPlatform(
    gx(151), GY - T,
    T * 3, T / 2,
    'x', 1.0, gx(6)
  ));

  // --- ENEMIES ---
  const E = (tx, type = 'ekans') => enemies.push(new Enemy(gx(tx), GY, type));
  const Ep = (tx, th, type = 'ekans') => enemies.push(new Enemy(gx(tx), gy(th), type));

  E(16); E(25); E(61); E(62);
  Ep(20, 4); Ep(22, 3);  // on staircase pillars — walk off and descend naturally
  E(76); E(77);
  E(96); E(98); E(100);
  E(109);
  E(131); Ep(132, 3); Ep(133, 4);
  enemies.push(new Enemy(gx(44), GY, 'koffing'));
  enemies.push(new Enemy(gx(59), GY, 'koffing'));
  enemies.push(new Enemy(gx(144), GY, 'koffing'));
  enemies.push(new Enemy(gx(152), GY, 'koffing'));

  // --- COINS ---
  const C = (tx, ty) => coins.push(new Coin(gx(tx) + 6, gy(ty + 1) + 4));
  // Pokéballs float 1 tile above the height-4 platforms
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
    movingPlatforms,
    boss: null,
    flagPole: flagPoleObj,
    pokeCenterX,
    setting: 'underground',
    get solids() { return [...platforms, ...qblocks, ...movingPlatforms]; },
    width: LEVEL_WIDTH,
  };
}
