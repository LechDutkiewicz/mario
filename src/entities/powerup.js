import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';

// kind: 'candy' (Rare Candy → Umbreon) | 'firestone' (Fire Stone → Flareon)
export class PowerUp {
  constructor(x, y, kind) {
    if (kind === 'mushroom' || kind === 'grow') kind = 'candy';
    if (kind === 'flower' || kind === 'fire' || kind === 'tm') kind = 'firestone';
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
    if (this.kind === 'firestone') return; // Fire Stone stays in place

    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    const res = resolveCollisions(this, solids);
    if (res.hitSide) this.vx = -this.vx;  // bounce off walls
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    if (this.kind === 'candy') {
      // Rare Candy: white capsule with pink top and "R" label
      const cx = x + w / 2, cy = y + h / 2;
      // Capsule body
      ctx.fillStyle = '#f0f0f0';
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 4, w - 4, h - 8, 8);
      ctx.fill();
      // Pink top half
      ctx.fillStyle = '#e060b0';
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 4, w - 4, (h - 8) / 2, [8, 8, 0, 0]);
      ctx.fill();
      // Dividing line
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 2, cy); ctx.lineTo(x + w - 2, cy); ctx.stroke();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + 5, y + 6, 5, 3);
      // "R" label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('R', cx, cy - 1);
    } else {
      // Fire Stone: orange gem shape
      const cx = x + w / 2, cy = y + h / 2;
      const t = Math.floor(this.anim / 6) % 2;
      // Gem facets
      ctx.fillStyle = t ? '#ff6600' : '#ff8c00';
      ctx.beginPath();
      ctx.moveTo(cx, y + 2);
      ctx.lineTo(x + w - 2, cy - 2);
      ctx.lineTo(cx + 4, y + h - 2);
      ctx.lineTo(cx - 4, y + h - 2);
      ctx.lineTo(x + 2, cy - 2);
      ctx.closePath();
      ctx.fill();
      // Inner highlight facet
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(cx, y + 5);
      ctx.lineTo(cx + 5, cy - 1);
      ctx.lineTo(cx, cy + 3);
      ctx.lineTo(cx - 5, cy - 1);
      ctx.closePath();
      ctx.fill();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(cx - 2, cy - 4, 3, 2, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // Outline
      ctx.strokeStyle = '#cc4400';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, y + 2);
      ctx.lineTo(x + w - 2, cy - 2);
      ctx.lineTo(cx + 4, y + h - 2);
      ctx.lineTo(cx - 4, y + h - 2);
      ctx.lineTo(x + 2, cy - 2);
      ctx.closePath();
      ctx.stroke();
    }
  }
}
