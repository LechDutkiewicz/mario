import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';

// kind: 'candy' (Rare Candy — grow) | 'tm' (TM Fire — fire power)
// Also accepts legacy 'mushroom' / 'flower' as aliases
export class PowerUp {
  constructor(x, y, kind) {
    // normalise legacy kinds
    if (kind === 'mushroom') kind = 'candy';
    if (kind === 'flower')   kind = 'tm';
    this.kind = kind;
    this.x = x;
    this.w = 28;
    this.h = 28;
    this.y = y;
    this.targetY = y - 30;
    this.vx = kind === 'candy' ? 1.4 : 0;
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
    if (this.kind === 'tm') return; // TM stays in place

    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    const prevX = this.x;
    resolveCollisions(this, solids);
    if (this.x === prevX && this.vx !== 0) this.vx = -this.vx;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    if (this.kind === 'candy') {
      // Ultra Ball: black top, yellow bottom
      const cx = x + w / 2, cy = y + h / 2, r = 11;
      // Black top
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
      // Yellow bottom
      ctx.fillStyle = '#f0c040';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
      // Band
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(cx - r, cy - 3, r * 2, 6);
      // Yellow stripe on band
      ctx.fillStyle = '#f0c040'; ctx.fillRect(cx - r + 2, cy - 1, r * 2 - 4, 2);
      // Center button
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();
    } else {
      // Quick Ball: blue top with yellow stripe, white bottom
      const cx = x + w / 2, cy = y + h / 2, r = 11;
      // Blue top
      ctx.fillStyle = '#2980b9';
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
      // Yellow top stripe
      ctx.fillStyle = '#f1c40f'; ctx.fillRect(cx - r + 1, cy - r + 1, r * 2 - 2, 6);
      // White bottom
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
      // Speed lines (yellow diagonal lines on top)
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * 6 - 4, cy - r + 2); ctx.lineTo(cx + i * 6 + 2, cy - 4); ctx.stroke();
      }
      // Band
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(cx - r, cy - 3, r * 2, 6);
      // Button
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
