// ============================================================
// WORLD 1 — Eevee's Adventure (Exact SMB 1-1 layout, Pokémon style)
// ============================================================
import { TILE, GROUND_Y, COLORS } from '../constants.js';
import { Platform, QuestionBlock, PipeBlock } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';
import { Enemy } from '../entities/enemy.js';
import { Coin }   from '../entities/coin.js';
import { PipePlant } from '../entities/pipeplant.js';

export function buildWorld1() {
  const T  = TILE;        // 32
  const GY = GROUND_Y;   // 540

  // Helper shortcuts
  const gx = n => n * T;
  const gy = n => GY - n * T;   // n tiles above ground top

  const platforms = [];
  const qblocks   = [];
  const enemies   = [];
  const coins     = [];
  const groundH   = 120;

  // ---- Ground sections (exact SMB 1-1 gaps) ----
  // addGround(start_tile, end_tile) — creates ground from start*T to end*T
  const addGround = (startTile, endTile) => {
    const x = gx(startTile);
    const w = gx(endTile - startTile);
    platforms.push(new Platform(x, GY, w, groundH, COLORS.ground));
  };

  addGround(0, 69);      // tiles 0-69
  addGround(71, 86);     // tiles 71-86 (gap at 69-71)
  addGround(89, 153);    // tiles 89-153 (gap at 86-89)
  addGround(155, 200);   // tiles 155-200 (gap at 153-155)

  // ---- Helper functions ----
  const Q = (tx, ty, c) => {
    const q = new QuestionBlock(gx(tx), gy(ty) - T);
    q.contents = c || 'pokeball';
    qblocks.push(q);
    return q;
  };

  // C(tx, ty): pokéball at tile column tx, ty tiles above ground
  const C = (tx, ty) => coins.push(new Coin(gx(tx) + 6, gy(ty + 1) + 4));

  const E = (tx, type) => enemies.push(new Enemy(gx(tx), GY, type || 'ekans'));

  // Ep: enemy standing on a platform at height ph tiles above ground
  const Ep = (tx, ph, type) => enemies.push(new Enemy(gx(tx), gy(ph), type || 'ekans'));

  // brick: single-tile-height brick block
  const brick = (tx, ty) =>
    platforms.push(new Platform(gx(tx), gy(ty) - T, T, T, COLORS.brick));

  // pipe(tx, height_in_tiles, enterable, isExit)
  const pipe = (tx, th, enterable = false, isExit = false) => {
    const p = new PipeBlock(gx(tx), th, enterable);
    if (isExit) {
      p.isExit = true;
      p.exitX = (57 + 2) * T; // just past the enterable pipe
    }
    platforms.push(p);
  };

  // step: staircase column — solid block from ground up to th tiles
  const step = (tx, th) =>
    platforms.push(new Platform(gx(tx), GY - T * th, T, T * th, COLORS.brick));

  // ============================================================
  // LAYOUT — SMB 1-1 exact
  // ============================================================

  // === Q-blocks ===
  Q(16, 4, 'coin');
  Q(21, 4, 'grow');
  Q(22, 4, 'coin');   // same height as brick row
  Q(23, 4, 'coin');
  Q(64, 5, 'grow');    // hidden-ish, treat as normal
  Q(78, 4, 'grow');
  Q(94, 4, 'coin');
  Q(100, 4, 'coin');
  Q(106, 4, 'grow');
  Q(109, 4, 'grow');
  Q(109, 5, 'grow');
  Q(112, 4, 'coin');
  Q(170, 4, 'coin');

  // === Bricks ===
  brick(20, 4);
  brick(22, 4);
  brick(24, 4);
  brick(77, 4);
  brick(79, 4);
  brick(80, 4);
  brick(81, 4);
  brick(82, 4);
  brick(83, 4); brick(84, 4); brick(85, 4); brick(86, 4); brick(87, 4);
  brick(91, 4); brick(92, 4); brick(93, 4);
  brick(94, 4);
  brick(100, 4);
  brick(101, 4);
  brick(118, 4);
  brick(121, 4); brick(122, 4); brick(123, 4);
  brick(128, 4);
  brick(129, 4);
  brick(130, 4);
  brick(131, 4);
  brick(168, 4);
  brick(169, 4);
  brick(171, 4);

  // === Pipes ===
  pipe(28, 2, false);           // first pipe, 2 tiles tall
  pipe(38, 3, false);           // 3 tiles
  pipe(46, 4, false);           // 4 tiles
  pipe(57, 4, true, false);     // enterable — goes underground
  pipe(163, 2, false, true);    // exit from underground
  pipe(179, 2, false);          // last pipe

  // === Pipe plants ===
  const plants = [];
  plants.push(new PipePlant(gx(38), GROUND_Y - T * 3));
  plants.push(new PipePlant(gx(46), GROUND_Y - T * 4));

  // === Staircases ===
  // First staircase (ascending then descending)
  step(134, 1);
  step(135, 2);
  step(136, 3);
  step(137, 4);
  // descending
  step(140, 4);
  step(141, 3);
  step(142, 2);
  step(143, 1);

  // Second staircase (ascending)
  step(148, 1);
  step(149, 2);
  step(150, 3);
  step(151, 4);
  step(152, 4);
  // After gap — descending side
  step(155, 4);
  step(156, 3);
  step(157, 2);
  step(158, 1);

  // === Enemies ===
  E(22, 'ekans');
  E(42, 'ekans');
  E(51, 'ekans');
  E(52, 'ekans');
  Ep(80, 4, 'ekans');   // on brick row
  Ep(82, 4, 'ekans');   // on brick row
  E(97, 'ekans');
  E(98, 'ekans');
  E(107, 'koffing');
  E(114, 'ekans');
  E(115, 'ekans');
  E(124, 'ekans'); E(126, 'ekans'); E(128, 'ekans'); E(130, 'ekans');
  E(174, 'ekans');
  E(175, 'ekans');

  // === Pokéballs ===
  // Above mid-section brick row (tiles 83-85, height 5) — 1 tile above = height 6
  C(83, 5); C(84, 5); C(85, 5);
  // After first gap, start of second floor section
  C(72, 1); C(73, 1); C(74, 1);
  // In second brick area
  C(91, 5); C(92, 5); C(93, 5);
  // Near the secret area
  C(66, 1); C(67, 1); C(68, 1);

  // === Underground bonus room at x=7000 ===
  const UX = 7000;
  const groundH2 = 120;
  // Floor
  platforms.push(new Platform(UX, GY, 1000, groundH2, COLORS.brick));
  // Ceiling
  platforms.push(new Platform(UX, 60, 1000, T, COLORS.brick));
  // Left wall
  platforms.push(new Platform(UX - T, 60, T, GY - 60 + T, COLORS.brick));
  // Right wall
  platforms.push(new Platform(UX + 1000, 60, T, GY - 60 + T, COLORS.brick));
  // Interior platforms
  platforms.push(new Platform(UX + 150, GY - T * 4, T * 3, T, COLORS.brick));
  platforms.push(new Platform(UX + 400, GY - T * 5, T * 3, T, COLORS.brick));
  platforms.push(new Platform(UX + 650, GY - T * 4, T * 3, T, COLORS.brick));
  // Q-blocks in underground
  qblocks.push(new QuestionBlock(UX + 200, GY - T * 5 - T, 'pokeball'));
  qblocks.push(new QuestionBlock(UX + 350, GY - T * 4 - T, 'ultraball'));
  qblocks.push(new QuestionBlock(UX + 500, GY - T * 5 - T, 'pokeball'));
  // Pokéballs scattered underground
  for (let i = 0; i < 8; i++) {
    coins.push(new Coin(UX + 80 + i * 100, GY - T * 3));
  }
  // Exit pipe
  const exitPipe = new PipeBlock(UX + 900, 3);
  exitPipe.isExit = true;
  exitPipe.exitX = (57 + 2) * T;
  platforms.push(exitPipe);

  // === Flagpole ===
  const flagPoleObj = new FlagPole(gx(198));

  const LEVEL_WIDTH = 200 * T; // 6400

  // Pokémon Center at end of level (after flagpole)
  const pokeCenterX = gx(204);

  return {
    platforms,
    qblocks,
    enemies,
    coins,
    plants,
    boss: null,
    flagPole: flagPoleObj,
    pokeCenterX,
    get solids() { return [...platforms, ...qblocks]; },
    width: Math.max(LEVEL_WIDTH, UX + 1100),
  };
}
