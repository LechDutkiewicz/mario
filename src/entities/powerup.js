import { GRAVITY, MAX_FALL_SPEED, COLORS } from '../constants.js';
import { resolveCollisions } from '../physics.js';

// kind: 'mushroom' | 'flower'
export class PowerUp {
  constructor(x, y, kind) {
    this.kind = kind;
    this.x = x;
    this.w = 28;
    this.h = 28;
    this.y = y;
    this.targetY = y - 30; // rise out of block
    this.vx = kind === 'mushroom' ? 1.4 : 0;
    this.vy = 0;
    this.dead = false;
    this.emerging = true;
    this.anim = 0;
  }

  update(solids) {
    this.anim++;
    if (this.emerging) {
      this.y -= 1;
      if (this.y <= this.targetY) this.emerging = false;
      return;
    }
    if (this.kind === 'flower') return; // flower stays put

    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    const prevX = this.x;
    resolveCollisions(this, solids);
    if (this.x === prevX && this.vx !== 0) this.vx = -this.vx;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = this.x - cam.x;
    const y = this.y;
    if (this.kind === 'mushroom') {
      // stem
      ctx.fillStyle = '#ffe7c2';
      ctx.fillRect(x + 6, y + 14, this.w - 12, 14);
      // cap
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(x + this.w / 2, y + 14, this.w / 2, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x, y + 14, this.w, 4);
      // spots
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + 8, y + 10, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 20, y + 9, 5, 0, Math.PI * 2); ctx.fill();
      // eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 9, y + 18, 3, 5);
      ctx.fillRect(x + 16, y + 18, 3, 5);
    } else {
      // fire flower
      const t = Math.floor(this.anim / 8) % 2;
      ctx.fillStyle = '#2faf2f';
      ctx.fillRect(x + 12, y + 16, 4, 12);
      ctx.fillStyle = t ? '#ff5a1d' : '#ffd23b';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + 14 + Math.cos(a) * 8, y + 10 + Math.sin(a) * 8, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = t ? '#ffd23b' : '#ff5a1d';
      ctx.beginPath(); ctx.arc(x + 14, y + 10, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
}
