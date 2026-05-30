import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions, aabb } from '../physics.js';

// Player fireball: bounces along ground, dies on wall or after lifetime.
export class Fireball {
  constructor(x, y, dir) {
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 14;
    this.vx = 6 * dir;
    this.vy = 2;
    this.dead = false;
    this.life = 160;
    this.anim = 0;
  }

  update(solids) {
    this.anim++;
    this.life--;
    if (this.life <= 0) { this.dead = true; return; }

    this.vy += GRAVITY * 0.7;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    const prevX = this.x;
    const res = resolveCollisions(this, solids);
    // bounce off ground
    if (res.onGround) this.vy = -6;
    // hit a wall -> die
    if (this.x === prevX) this.dead = true;
    if (this.y > 800) this.dead = true;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const cx = this.x - cam.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const t = Math.floor(this.anim / 4) % 2;
    ctx.fillStyle = t ? '#ff5a1d' : '#ffd23b';
    ctx.beginPath();
    ctx.arc(cx, cy, this.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t ? '#ffd23b' : '#ff5a1d';
    ctx.beginPath();
    ctx.arc(cx, cy, this.w / 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Boss projectile: flies straight, damages player.
export class BossShot {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.w = 18;
    this.h = 18;
    this.vx = vx;
    this.vy = vy;
    this.dead = false;
    this.life = 200;
    this.anim = 0;
  }

  update() {
    this.anim++;
    this.life--;
    this.x += this.vx;
    this.y += this.vy;
    if (this.life <= 0) this.dead = true;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const cx = this.x - cam.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const t = Math.floor(this.anim / 4) % 2;
    ctx.fillStyle = t ? '#a020f0' : '#d060ff';
    ctx.beginPath();
    ctx.arc(cx, cy, this.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
