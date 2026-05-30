import { GRAVITY, MAX_FALL_SPEED, COLORS } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { BossShot } from './projectile.js';

// Blocky yellow/orange bear boss. 3 hits to defeat.
export class Boss {
  constructor(x, y, leftBound, rightBound) {
    this.w = 90;
    this.h = 96;
    this.x = x;
    this.y = y - this.h;
    this.vx = -1.4;
    this.vy = 0;
    this.leftBound = leftBound;
    this.rightBound = rightBound;
    this.hp = 3;
    this.dead = false;
    this.defeated = false;
    this.hitFlash = 0;       // invincibility/flash after a hit
    this.shootTimer = 90;
    this.anim = 0;
    this.active = false;
    this.deathTimer = 0;
  }

  get stompable() { return true; }

  // Called when stomped or hit by fireball. Returns true if defeated.
  takeHit() {
    if (this.hitFlash > 0 || this.defeated) return false;
    this.hp--;
    this.hitFlash = 60;
    if (this.hp <= 0) {
      this.defeated = true;
      this.deathTimer = 120;
      this.vx = 0;
    }
    return this.defeated;
  }

  update(solids, player, game) {
    if (this.dead) return;
    this.anim++;
    if (this.hitFlash > 0) this.hitFlash--;

    if (this.defeated) {
      this.deathTimer--;
      this.vy += GRAVITY;
      this.y += this.vy;
      this.x += Math.sin(this.anim * 0.3) * 2;
      if (this.deathTimer <= 0) this.dead = true;
      return;
    }

    if (!this.active) {
      if (Math.abs(this.x - player.x) < 600) this.active = true;
      else return;
    }

    // gravity + pacing between bounds
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    resolveCollisions(this, solids);

    if (this.x <= this.leftBound) { this.x = this.leftBound; this.vx = Math.abs(this.vx); }
    if (this.x + this.w >= this.rightBound) { this.x = this.rightBound - this.w; this.vx = -Math.abs(this.vx); }

    // shoot toward player
    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shootTimer = 110;
      const dir = player.x < this.x ? -1 : 1;
      const sx = this.x + this.w / 2;
      const sy = this.y + 30;
      game.bossShots.push(new BossShot(sx, sy, dir * 4, -1.5));
      game.bossShots.push(new BossShot(sx, sy, dir * 5, 1));
    }
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    // flash white when recently hit
    if (this.hitFlash > 0 && Math.floor(this.hitFlash / 4) % 2) {
      ctx.globalAlpha = 0.5;
    }

    const body = COLORS.orange;
    const dark = '#b8600f';
    const light = '#ffc04d';

    // body block
    ctx.fillStyle = body;
    ctx.fillRect(x, y + 18, w, h - 18);
    // shading
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + h - 12, w, 12);
    ctx.fillStyle = light;
    ctx.fillRect(x, y + 18, w, 6);

    // head block
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x + 14, y, w - 28, 34);
    // ears
    ctx.fillStyle = dark;
    ctx.fillRect(x + 10, y - 8, 16, 16);
    ctx.fillRect(x + w - 26, y - 8, 16, 16);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x + 14, y - 4, 8, 8);
    ctx.fillRect(x + w - 22, y - 4, 8, 8);

    // eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 26, y + 8, 12, 12);
    ctx.fillRect(x + w - 38, y + 8, 12, 12);
    ctx.fillStyle = '#000';
    const look = this.vx < 0 ? 0 : 4;
    ctx.fillRect(x + 28 + look, y + 11, 6, 8);
    ctx.fillRect(x + w - 36 + look, y + 11, 6, 8);
    // angry brows
    ctx.fillStyle = dark;
    ctx.fillRect(x + 24, y + 5, 14, 3);
    ctx.fillRect(x + w - 38, y + 5, 14, 3);
    // snout
    ctx.fillStyle = dark;
    ctx.fillRect(x + w / 2 - 8, y + 22, 16, 8);

    // arms
    ctx.fillStyle = body;
    const swing = Math.sin(this.anim * 0.1) * 4;
    ctx.fillRect(x - 8, y + 30 + swing, 12, 30);
    ctx.fillRect(x + w - 4, y + 30 - swing, 12, 30);

    // belly plate
    ctx.fillStyle = light;
    ctx.fillRect(x + w / 2 - 18, y + 44, 36, 30);

    // HP pips above head
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < this.hp ? '#e23636' : '#444';
      ctx.fillRect(x + 18 + i * 20, y - 22, 14, 8);
    }
    ctx.globalAlpha = 1;
  }
}
