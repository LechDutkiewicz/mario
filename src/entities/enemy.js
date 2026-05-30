import { GRAVITY, MAX_FALL_SPEED, COLORS } from '../constants.js';
import { resolveCollisions, aabb } from '../physics.js';

// type: 'goomba' (stompable) | 'spiky' (fireball only)
export class Enemy {
  constructor(x, y, type = 'goomba') {
    this.type = type;
    this.x = x;
    this.w = 30;
    this.h = type === 'spiky' ? 34 : 28;
    this.y = y - this.h;
    this.vx = type === 'spiky' ? -0.7 : -1.1;
    this.vy = 0;
    this.dead = false;
    this.squashTimer = 0;
    this.animTimer = Math.floor(Math.random() * 30);
    this.active = false;
  }

  get stompable() { return this.type === 'goomba'; }

  squash() {
    this.squashTimer = 22;
    this.vx = 0;
  }

  kill() {
    // fireball death: flip and fall
    this.dead = true;
    this.dying = true;
    this.vy = -6;
  }

  update(solids, player) {
    if (this.dead) return;

    if (this.squashTimer > 0) {
      this.squashTimer--;
      if (this.squashTimer === 0) this.dead = true;
      return;
    }

    if (this.dying) {
      this.vy += GRAVITY;
      this.y += this.vy;
      return;
    }

    this.animTimer++;

    // Only start moving when near the player (activation)
    if (!this.active) {
      if (Math.abs(this.x - player.x) < 520) this.active = true;
      else return;
    }

    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    const prevX = this.x;
    const res = resolveCollisions(this, solids);

    // If blocked horizontally, reverse
    if (this.x === prevX + 0 && this.vx === 0) {
      // collision zeroed vx -> turn around
      this.vx = (this.type === 'spiky' ? 0.7 : 1.1) * (Math.random() < 0.5 ? -1 : 1);
    }
    if (this.x === prevX && this.vx !== 0) {
      this.vx = -this.vx;
    }
    // re-apply a steady speed and edge-turn
    const sp = this.type === 'spiky' ? 0.7 : 1.1;
    if (this.vx > 0) this.vx = sp; else if (this.vx < 0) this.vx = -sp;

    // Edge detection: if on ground and no ground ahead, turn around
    if (res.onGround) {
      const aheadX = this.vx > 0 ? this.x + this.w + 2 : this.x - 2;
      const footY = this.y + this.h + 4;
      let groundAhead = false;
      for (const s of solids) {
        if (s.dead) continue;
        if (aheadX >= s.x && aheadX <= s.x + s.w && footY >= s.y && footY <= s.y + s.h + 6) {
          groundAhead = true; break;
        }
      }
      if (!groundAhead) this.vx = -this.vx;
    }
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    if (this.squashTimer > 0) {
      // squashed goomba
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(x, y + h - 8, w, 8);
      return;
    }

    if (this.type === 'goomba') {
      this._drawGoomba(ctx, x, y, w, h);
    } else {
      this._drawSpiky(ctx, x, y, w, h);
    }
  }

  _drawGoomba(ctx, x, y, w, h) {
    const flip = this.dying ? -1 : 1;
    ctx.save();
    if (flip < 0) { ctx.translate(x, y + h); ctx.scale(1, -1); ctx.translate(-x, -y); }
    // body cap
    ctx.fillStyle = '#9c5a22';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.4, w / 2, h * 0.4, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x, y + h * 0.4, w, h * 0.35);
    // feet
    const wig = Math.floor(this.animTimer / 12) % 2;
    ctx.fillStyle = '#5a2d0c';
    ctx.fillRect(x + (wig ? 2 : 5), y + h - 8, 8, 8);
    ctx.fillRect(x + w - (wig ? 10 : 13), y + h - 8, 8, 8);
    // eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y + h * 0.32, 6, 7);
    ctx.fillRect(x + w - 12, y + h * 0.32, 6, 7);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 9, y + h * 0.34, 3, 5);
    ctx.fillRect(x + w - 10, y + h * 0.34, 3, 5);
    // angry brows
    ctx.fillRect(x + 5, y + h * 0.28, 8, 2);
    ctx.fillRect(x + w - 13, y + h * 0.28, 8, 2);
    ctx.restore();
  }

  _drawSpiky(ctx, x, y, w, h) {
    // gray rounded body
    ctx.fillStyle = '#8a8f99';
    ctx.fillRect(x, y + 10, w, h - 14);
    ctx.fillStyle = '#6b7079';
    ctx.fillRect(x, y + h - 6, w, 6);
    // spikes (triangles on top, like battlements)
    ctx.fillStyle = '#cfd4dd';
    const n = 3;
    const sw = w / n;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * sw, y + 12);
      ctx.lineTo(x + i * sw + sw / 2, y - 2);
      ctx.lineTo(x + i * sw + sw, y + 12);
      ctx.closePath();
      ctx.fill();
    }
    // eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y + 16, 6, 6);
    ctx.fillRect(x + w - 12, y + 16, 6, 6);
    ctx.fillStyle = '#c00';
    ctx.fillRect(x + 8, y + 18, 3, 3);
    ctx.fillRect(x + w - 10, y + 18, 3, 3);
  }
}
