import {
  CANVAS_WIDTH, CANVAS_HEIGHT, STATE, POWER, COLORS,
  SCORE_COIN, SCORE_STOMP, SCORE_FIRE, SCORE_BOSS, GROUND_Y,
} from './constants.js';
import { Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { Player } from './entities/player.js';
import { PowerUp } from './entities/powerup.js';
import { Coin } from './entities/coin.js';
import { Fireball } from './entities/projectile.js';
import { buildLevel } from './level.js';
import { aabb } from './physics.js';

export class Game {
  constructor(ctx, input) {
    this.ctx = ctx;
    this.input = input;
    this.r = new Renderer(ctx);
    this.cam = new Camera();
    this.state = STATE.MENU;
    this.score = 0;
    this.lives = 3;
    this.resetLevel(true);
  }

  resetLevel(fullReset) {
    this.level = buildLevel();
    this.player = new Player(80, GROUND_Y - 60);
    this.cam.x = 0;
    this.fireballs = [];
    this.bossShots = [];
    this.powerups = [];
    this.particles = [];
    this.coinsCollected = this.coinsCollected || 0;
    if (fullReset) {
      this.score = 0;
      this.lives = 3;
      this.coinsCollected = 0;
    }
  }

  start() {
    this.state = STATE.PLAYING;
    this.resetLevel(true);
  }

  // ---- spawning hooks called by blocks/player ----
  spawnFireball(player) {
    const x = player.facing > 0 ? player.x + player.w : player.x - 14;
    this.fireballs.push(new Fireball(x, player.y + player.h * 0.4, player.facing));
  }

  collectBlockCoin(x, y) {
    this.coinsCollected++;
    this.score += SCORE_COIN;
    this.level.coins.push(Coin.pop(x, y));
  }

  spawnPowerUp(x, y, kind) {
    this.powerups.push(new PowerUp(x, y, kind));
  }

  get coins() { return this.level.coins; }

  // ---------------- main update ----------------
  update() {
    const input = this.input;

    if (this.state === STATE.MENU) {
      if (input.justPressed('Enter') || input.justPressed('Space')) this.start();
      return;
    }
    if (this.state === STATE.GAME_OVER || this.state === STATE.WIN) {
      if (input.justPressed('Enter')) { this.state = STATE.PLAYING; this.resetLevel(true); }
      return;
    }
    if (this.state === STATE.PLAYING && input.justPressed('KeyP')) {
      this.state = STATE.PAUSED; return;
    }
    if (this.state === STATE.PAUSED) {
      if (input.justPressed('KeyP')) this.state = STATE.PLAYING;
      return;
    }

    const lvl = this.level;
    const solids = lvl.solids;
    const p = this.player;

    p.update(input, solids, this);
    this.cam.follow(p);

    for (const q of lvl.qblocks) q.update();

    // coins
    for (const c of lvl.coins) {
      c.update();
      if (!c.dead && !c.popping && aabb(p, c)) {
        c.dead = true;
        this.coinsCollected++;
        this.score += SCORE_COIN;
      }
    }
    lvl.coins = lvl.coins.filter((c) => !c.dead);

    // powerups
    for (const pu of this.powerups) {
      pu.update(solids);
      if (!pu.dead && aabb(p, pu)) {
        pu.dead = true;
        p.powerUp(pu.kind);
        this.score += 1000;
      }
    }
    this.powerups = this.powerups.filter((pu) => !pu.dead);

    // fireballs
    for (const fb of this.fireballs) fb.update(solids);
    this.fireballs = this.fireballs.filter((fb) => !fb.dead);

    // enemies
    for (const e of lvl.enemies) {
      e.update(solids, p);
      if (e.dead || e.dying || e.squashTimer > 0) continue;

      // fireball hit
      for (const fb of this.fireballs) {
        if (!fb.dead && aabb(fb, e)) {
          fb.dead = true;
          e.kill();
          this.score += SCORE_FIRE;
          break;
        }
      }
      if (e.dead || e.squashTimer > 0) continue;

      // player vs enemy
      if (!p.dead && aabb(p, e)) {
        const stomping = p.vy > 0 && (p.y + p.h) - e.y < 22;
        if (stomping && e.stompable) {
          e.squash();
          p.vy = -8; // bounce
          this.score += SCORE_STOMP;
        } else {
          this._hurtPlayer();
        }
      }
    }
    lvl.enemies = lvl.enemies.filter((e) => !e.dead || e.dying);
    // remove fully-dead flippers once offscreen below
    lvl.enemies = lvl.enemies.filter((e) => !(e.dead && e.y > 800));

    // boss
    const boss = lvl.boss;
    if (boss && !boss.dead) {
      boss.update(solids, p, this);

      // fireball -> boss
      for (const fb of this.fireballs) {
        if (!fb.dead && aabb(fb, boss) && !boss.defeated) {
          fb.dead = true;
          if (boss.takeHit()) this.score += SCORE_BOSS;
        }
      }
      // player vs boss
      if (!p.dead && !boss.defeated && aabb(p, boss)) {
        const stomping = p.vy > 0 && (p.y + p.h) - boss.y < 30;
        if (stomping) {
          if (boss.takeHit()) this.score += SCORE_BOSS;
          p.vy = -11;
        } else {
          this._hurtPlayer();
        }
      }
    }
    if (boss && boss.dead) { this.state = STATE.WIN; return; }

    // boss shots
    for (const bs of this.bossShots) {
      bs.update();
      if (!bs.dead && !p.dead && aabb(p, bs)) { bs.dead = true; this._hurtPlayer(); }
    }
    this.bossShots = this.bossShots.filter((bs) => !bs.dead);

    // player death handling
    if (p.dead && p.deathTimer <= 0) {
      this._loseLife();
    }
  }

  _hurtPlayer() {
    const died = this.player.takeDamage();
    if (died) { /* death animation runs; life lost when timer ends */ }
  }

  _loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      this.state = STATE.GAME_OVER;
    } else {
      // respawn, keep score & remaining level progress reset
      this.resetLevel(false);
    }
  }

  // ---------------- render ----------------
  render() {
    const r = this.r;
    const ctx = this.ctx;
    r.clear();
    r.drawBackground(this.cam.x);

    if (this.state === STATE.MENU) { this._drawMenu(); return; }

    const lvl = this.level;
    for (const pl of lvl.platforms) pl.draw(r, this.cam);
    for (const q of lvl.qblocks) q.draw(r, this.cam);
    for (const c of lvl.coins) c.draw(r, this.cam);
    for (const pu of this.powerups) pu.draw(r, this.cam);
    for (const e of lvl.enemies) e.draw(r, this.cam);
    if (lvl.boss && !lvl.boss.dead) lvl.boss.draw(r, this.cam);
    for (const fb of this.fireballs) fb.draw(r, this.cam);
    for (const bs of this.bossShots) bs.draw(r, this.cam);
    this.player.draw(r, this.cam);

    this._drawHUD();

    if (this.state === STATE.PAUSED) this._overlay('PAUSED', 'Press P to resume');
    if (this.state === STATE.GAME_OVER) this._overlay('GAME OVER', 'Press ENTER to restart');
    if (this.state === STATE.WIN) this._drawWin();
  }

  _drawHUD() {
    const ctx = this.ctx;
    // hearts
    for (let i = 0; i < 3; i++) {
      this._heart(24 + i * 34, 28, i < this.lives);
    }
    // score
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    const sTxt = 'SCORE ' + String(this.score).padStart(6, '0');
    ctx.strokeText(sTxt, CANVAS_WIDTH - 230, 36);
    ctx.fillText(sTxt, CANVAS_WIDTH - 230, 36);
    // coins
    const cTxt = '🪙 x' + this.coinsCollected;
    ctx.font = 'bold 20px monospace';
    ctx.strokeText('COINS ' + this.coinsCollected, CANVAS_WIDTH - 230, 62);
    ctx.fillText('COINS ' + this.coinsCollected, CANVAS_WIDTH - 230, 62);
    // power label
    const pw = this.player.power;
    const label = pw === POWER.FIRE ? 'FIRE' : pw === POWER.BIG ? 'BIG' : 'SMALL';
    ctx.fillStyle = pw === POWER.FIRE ? '#ff5a1d' : '#fff';
    ctx.strokeText(label, 24, 64);
    ctx.fillText(label, 24, 64);
  }

  _heart(x, y, full) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = full ? '#e23636' : 'rgba(0,0,0,0.35)';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-12, -8, -12, 8, 0, 14);
    ctx.bezierCurveTo(12, 8, 12, -8, 0, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _overlay(title, sub) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px monospace';
    ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.font = 'bold 22px monospace';
    ctx.fillText(sub, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    ctx.fillText('SCORE ' + this.score, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 74);
    ctx.textAlign = 'left';
  }

  _drawWin() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20,10,60,0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 60px monospace';
    ctx.fillText('YOU WIN!', CANVAS_WIDTH / 2, 220);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('The boss is defeated!', CANVAS_WIDTH / 2, 280);
    ctx.fillText('Final Score: ' + this.score, CANVAS_WIDTH / 2, 330);
    ctx.fillText('Coins: ' + this.coinsCollected, CANVAS_WIDTH / 2, 366);
    ctx.font = 'bold 22px monospace';
    ctx.fillText('Press ENTER to play again', CANVAS_WIDTH / 2, 430);
    ctx.textAlign = 'left';
  }

  _drawMenu() {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    // title
    ctx.fillStyle = COLORS.red;
    ctx.font = 'bold 64px monospace';
    ctx.fillText('SUPER MARIO', CANVAS_WIDTH / 2, 180);
    ctx.fillStyle = COLORS.green;
    ctx.fillText('DRAWING WORLD', CANVAS_WIDTH / 2, 250);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('Press ENTER or SPACE to START', CANVAS_WIDTH / 2, 340);

    ctx.font = '18px monospace';
    ctx.fillStyle = '#eee';
    const lines = [
      'Arrow keys: move    Space/Up: jump',
      'Shift: run          Left Alt: shoot fireball (with flower)',
      'P: pause',
      '',
      'Stomp goombas. Spiky enemies need fireballs!',
      'Beat the bear boss to win.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, CANVAS_WIDTH / 2, 400 + i * 28));
    ctx.textAlign = 'left';
  }
}
