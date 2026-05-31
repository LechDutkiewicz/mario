// ============================================================
// WORLD 1 — Eevee's Adventure (SMB 1-1 Pokémon style)
// ============================================================
import { TILE, GROUND_Y, COLORS, LEVEL_WIDTH } from '../constants.js';
import { Platform, QuestionBlock, PipeBlock } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';
import { Enemy } from '../entities/enemy.js';
import { Coin }   from '../entities/coin.js';
import { Boss }   from '../entities/boss.js';

export function buildWorld1() {
  const T  = TILE;
  const GY = GROUND_Y;
  const levelWidth = LEVEL_WIDTH; // 6400

  // Helper shortcuts
  const gx = n => n * T;
  const gy = n => GY - n * T;   // n tiles above ground top

  const platforms = [];
  const qblocks   = [];
  const enemies   = [];
  const coins     = [];
  const groundH   = 120;

  // Ground — three segments with two small gaps (tiles)
  const addGround = (tx, tw) =>
    platforms.push(new Platform(gx(tx), GY, gx(tw), groundH, COLORS.ground));

  addGround(0, 52);     // x=0..1664
  addGround(54, 30);    // x=1728..2688  (gap at tile 52-53)
  addGround(86, 114);   // x=2752..6400  (gap at tile 84-85)

  // --- Helper functions ---
  const P = (tx, ty, tw, c) =>
    platforms.push(new Platform(gx(tx), gy(ty), gx(tw), T, c));
  const Q = (tx, ty, c) => {
    const q = new QuestionBlock(gx(tx), gy(ty) - (T + 4));
    q.contents = c || 'pokeball';
    qblocks.push(q);
    return q;
  };
  const C = (tx, ty) => coins.push(new Coin(gx(tx) + 6, gy(ty) - 24));
  const E = (tx, type) => enemies.push(new Enemy(gx(tx), GY, type || 'ekans'));
  const Ep = (tx, ty, type) => enemies.push(new Enemy(gx(tx), gy(ty), type || 'ekans'));

  const brick = (tx, ty, tw) =>
    platforms.push(new Platform(gx(tx), gy(ty) - T, gx(tw), T, COLORS.brick));

  const pipe = (tx, th) => {
    platforms.push(new PipeBlock(gx(tx), th));
  };

  const step = (tx, th) =>
    platforms.push(new Platform(gx(tx), GY - T * th, T, T * th, COLORS.brick));

  // ============================================================
  // LAYOUT (matches SMB 1-1 spirit with Pokémon flavour)
  // ============================================================

  // === Zone 1: Opening (tile 0-27) ===
  Q(16, 5, 'candy');                           // Rare Candy
  brick(20, 5, 1);
  Q(21, 5, 'pokeball');
  brick(22, 5, 1);
  Q(23, 5, 'pokeball');
  brick(24, 5, 1);

  E(22, 'ekans');
  E(24, 'ekans');

  // === Zone 2: First pipes (tile 28-56) ===
  pipe(28, 2);
  pipe(38, 3);

  E(34, 'ekans');
  E(36, 'ekans');

  Ep(40, 3, 'koffing');

  // === Zone 3: Mid section (tile 57-83) ===
  pipe(57, 4);
  pipe(63, 2);
  pipe(78, 4);

  E(47, 'ekans');
  E(48, 'ekans');
  E(69, 'ekans');
  E(71, 'ekans');

  Q(64, 5, 'pokeball');
  Q(65, 5, 'tm');       // TM Fire!
  Q(66, 5, 'pokeball');

  Ep(58, 4, 'koffing');
  Ep(78, 4, 'koffing');

  // Pokéballs in open air
  for (let i = 0; i < 5; i++) C(86 + i, 5);

  // === Zone 4: After second gap (tile 86-134) ===
  E(90, 'ekans');
  E(92, 'ekans');
  E(94, 'ekans');
  E(98, 'ekans');
  E(102, 'ekans');

  Q(96, 5, 'candy');    // another Rare Candy mid-level
  brick(100, 5, 3);
  Q(103, 5, 'pokeball');

  Ep(110, 4, 'koffing');

  // Some brick platforms mid level
  P(120, 4, 3, COLORS.brick);
  P(126, 6, 4, COLORS.brick);
  P(130, 4, 3, COLORS.brick);

  C(120, 5); C(121, 5); C(122, 5);
  C(127, 7); C(128, 7); C(129, 7); C(130, 7);

  E(116, 'ekans');
  E(118, 'ekans');
  Ep(127, 6, 'ekans');
  Ep(130, 4, 'koffing');

  Q(121, 7, 'tm');       // TM Fire before final climb

  // === Zone 5: Ascending staircase (tile 135-151) ===
  for (let i = 0; i < 8; i++) step(135 + i, i + 1);
  for (let i = 0; i < 4; i++) step(145 + i, 4 - i);

  // === Flagpole ===
  const flagPoleObj = new FlagPole(gx(152));

  return {
    platforms,
    qblocks,
    enemies,
    coins,
    boss: null,
    flagPole: flagPoleObj,
    get solids() { return [...platforms, ...qblocks]; },
    width: levelWidth,
  };
}
