import { GROUND_Y, LEVEL_WIDTH, COLORS } from './constants.js';
import { Enemy } from './entities/enemy.js';
import { Coin } from './entities/coin.js';
import { Boss } from './entities/boss.js';

// A solid platform rectangle.
class Platform {
  constructor(x, y, w, h, color) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.color = color;
    this.dead = false;
    this.kind = 'platform';
  }
  draw(r, cam) {
    r.platform(Math.floor(this.x - cam.x), Math.floor(this.y), this.w, this.h, this.color);
  }
}

// Question block: bump from below to release a coin or power-up, then becomes empty.
class QuestionBlock {
  constructor(x, y, contents = 'coin') {
    this.x = x; this.y = y; this.w = 36; this.h = 36;
    this.contents = contents; // 'coin' | 'mushroom' | 'flower'
    this.used = false;
    this.dead = false;
    this.bump = 0;
    this.anim = Math.floor(Math.random() * 60);
    this.kind = 'qblock';
  }

  onBump(game) {
    if (this.used) return;
    this.used = true;
    this.bump = 8;
    if (this.contents === 'coin') {
      game.collectBlockCoin(this.x + this.w / 2 - 9, this.y - 4);
    } else {
      game.spawnPowerUp(this.x + 4, this.y - 4, this.contents);
    }
  }

  update() {
    this.anim++;
    if (this.bump > 0) this.bump--;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const yOff = this.bump > 0 ? -Math.sin((this.bump / 8) * Math.PI) * 8 : 0;
    const y = Math.floor(this.y + yOff);
    const w = this.w, h = this.h;
    if (this.used) {
      // empty/used brick
      ctx.fillStyle = '#a8772f';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#7a531c';
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.strokeStyle = '#5a3c12'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      return;
    }
    const t = Math.floor(this.anim / 18) % 3;
    ctx.fillStyle = t === 2 ? '#d98e10' : COLORS.qblock;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w, 4);
    ctx.strokeStyle = '#7a531c'; ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    // corner rivets
    ctx.fillStyle = '#7a531c';
    for (const [cx, cy] of [[5,5],[w-9,5],[5,h-9],[w-9,h-9]]) ctx.fillRect(x+cx, y+cy, 4, 4);
    // ?
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

export function buildLevel() {
  const platforms = [];
  const qblocks = [];
  const enemies = [];
  const coins = [];
  let boss = null;

  // Ground (with a couple of pits)
  const groundH = 600 - GROUND_Y + 60;
  const addGround = (x, w) => platforms.push(new Platform(x, GROUND_Y, w, groundH, COLORS.ground));
  addGround(0, 1500);
  addGround(1560, 1000);          // small pit at 1500-1560
  addGround(2620, 1300);          // pit at 2560-2620
  addGround(3980, LEVEL_WIDTH - 3980);

  const P = (x, y, w, h, c) => platforms.push(new Platform(x, y, w, h, c));
  const Q = (x, y, c) => { const q = new QuestionBlock(x, y, c); qblocks.push(q); return q; };
  const C = (x, y) => coins.push(new Coin(x, y));
  const E = (x, type) => enemies.push(new Enemy(x, GROUND_Y, type));
  const Eon = (x, y, type) => enemies.push(new Enemy(x, y, type)); // on a platform top

  // ---- START ZONE (0-400): tall red/pink wall, 3 spiky enemies ----
  P(0, 200, 60, GROUND_Y - 200, COLORS.red);     // tall left wall
  P(0, 200, 60, 40, COLORS.pink);                 // pink cap
  P(140, 440, 90, 24, COLORS.orange);
  P(280, 360, 90, 24, COLORS.green);
  E(220, 'spiky');
  E(330, 'spiky');
  E(120, 'spiky');
  C(160, 400); C(190, 400); C(310, 320);

  // ---- MID ZONE (400-2200): colored floating platforms, goombas, coins, ?blocks ----
  P(450, 430, 110, 24, COLORS.blue);
  P(620, 350, 110, 24, COLORS.purple);
  P(820, 430, 120, 24, COLORS.cyan);
  P(1050, 360, 120, 24, COLORS.pink);
  P(1280, 300, 120, 24, COLORS.green);
  P(1620, 430, 140, 24, COLORS.orange);   // platform over the first pit landing
  P(1850, 350, 120, 24, COLORS.blue);

  Q(560, 360, 'coin');
  Q(600, 360, 'mushroom');
  Q(640, 360, 'coin');
  Q(1120, 270, 'coin');
  Q(1300, 210, 'flower');

  for (let i = 0; i < 5; i++) C(470 + i * 22, 395);
  for (let i = 0; i < 4; i++) C(840 + i * 22, 395);
  for (let i = 0; i < 4; i++) C(1070 + i * 22, 320);
  for (let i = 0; i < 4; i++) C(1290 + i * 22, 260);

  E(700, 'goomba');
  E(900, 'goomba');
  E(1180, 'goomba');
  E(1700, 'goomba');
  Eon(1290, GROUND_Y - 230, 'goomba');

  // ---- QUESTION BLOCK COLUMN (2200-2400): tall orange column of ?blocks ----
  // Tall orange support column + stacked question blocks on top.
  P(2240, GROUND_Y - 220, 50, 220, COLORS.orange);
  for (let i = 0; i < 4; i++) {
    Q(2235, GROUND_Y - 220 - 40 - i * 40, i === 1 ? 'mushroom' : 'coin');
  }
  // staircase of ? blocks beside it
  Q(2120, GROUND_Y - 90, 'coin');
  Q(2160, GROUND_Y - 130, 'coin');
  C(2120, GROUND_Y - 130); C(2160, GROUND_Y - 170);

  // ---- MID-RIGHT ZONE (2500-4500): blue vertical platform with coins, enemies, power-ups ----
  // Tall blue vertical platform with a coin trail beside it.
  P(2760, GROUND_Y - 280, 56, 280, COLORS.blue);
  P(2700, GROUND_Y - 60, 60, 60, COLORS.cyan);    // step to climb up
  for (let i = 0; i < 6; i++) C(2640, GROUND_Y - 60 - i * 36);
  Eon(2760, GROUND_Y - 280, 'spiky');

  P(2960, 420, 120, 24, COLORS.pink);
  P(3160, 350, 120, 24, COLORS.green);
  P(3380, 280, 120, 24, COLORS.purple);
  P(3620, 380, 140, 24, COLORS.orange);
  P(3880, 320, 120, 24, COLORS.cyan);

  Q(3010, 330, 'flower');
  Q(3420, 190, 'coin');
  Q(3460, 190, 'coin');

  for (let i = 0; i < 4; i++) C(2980 + i * 22, 385);
  for (let i = 0; i < 4; i++) C(3180 + i * 22, 315);
  for (let i = 0; i < 4; i++) C(3640 + i * 22, 345);
  for (let i = 0; i < 4; i++) C(3900 + i * 22, 285);

  E(3050, 'goomba');
  E(3250, 'goomba');
  E(3500, 'spiky');
  E(3700, 'goomba');
  E(3900, 'goomba');
  Eon(3160, GROUND_Y - 280, 'goomba');
  Eon(3620, GROUND_Y - 240, 'goomba');

  // bridge platforms over second pit region just in case
  P(4150, 430, 120, 24, COLORS.green);
  for (let i = 0; i < 4; i++) C(4170 + i * 22, 395);
  E(4300, 'spiky');

  // ---- BOSS ZONE (4500-6000): castle structure + boss arena ----
  const arenaLeft = 4600;
  const arenaRight = 5950;
  // castle back wall + battlements
  P(5700, 180, 250, GROUND_Y - 180, COLORS.brick);
  for (let i = 0; i < 5; i++) P(5700 + i * 50, 150, 30, 40, COLORS.brick);
  // castle doorway shade
  P(5790, GROUND_Y - 110, 70, 110, '#3a2410');
  // entry pillars
  P(4560, GROUND_Y - 140, 40, 140, COLORS.red);
  P(4560, GROUND_Y - 140, 40, 24, COLORS.pink);
  // a couple of platforms to allow a stomping approach on the boss
  P(4900, 380, 130, 24, COLORS.purple);
  P(5180, 330, 130, 24, COLORS.blue);
  P(5420, 380, 130, 24, COLORS.orange);
  for (let i = 0; i < 4; i++) C(4920 + i * 24, 345);
  for (let i = 0; i < 4; i++) C(5200 + i * 24, 295);
  Q(5180, 250, 'flower');   // give the player fire power before the boss

  E(4720, 'goomba');
  E(5000, 'spiky');

  boss = new Boss(5450, GROUND_Y, arenaLeft, arenaRight);

  return {
    platforms, qblocks, enemies, coins, boss,
    // solids = everything the player/enemies collide with
    get solids() { return [...platforms, ...qblocks]; },
    width: LEVEL_WIDTH,
  };
}

export { Platform, QuestionBlock };
