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
      // Rare Candy: small purple diamond with white sheen
      const cx = x + w / 2;
      const cy = y + h / 2;
      const hw = w * 0.42; // half-width
      const hh = h * 0.46; // half-height

      // Outer diamond
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx - hw, cy);
      ctx.closePath();
      ctx.fill();

      // Inner lighter diamond (sheen)
      ctx.fillStyle = '#c39bd3';
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh * 0.5);
      ctx.lineTo(cx + hw * 0.5, cy);
      ctx.lineTo(cx, cy + hh * 0.5);
      ctx.lineTo(cx - hw * 0.5, cy);
      ctx.closePath();
      ctx.fill();

      // Sparkle highlights
      ctx.fillStyle = '#e8daef';
      ctx.fillRect(cx - 2, cy - hh + 2, 4, 5);
      ctx.fillRect(cx - hh * 0.2, cy - 2, 5, 4);

      // Outline
      ctx.strokeStyle = '#6c3483'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx - hw, cy);
      ctx.closePath();
      ctx.stroke();

      // "RC" text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RC', cx, cy + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    } else {
      // TM Fire: orange disc with flame mark, animates
      const t = Math.floor(this.anim / 8) % 2;
      const cx = x + w / 2;
      const cy = y + h / 2;

      // Disc
      ctx.fillStyle = t ? '#e67e22' : '#f39c12';
      ctx.beginPath();
      ctx.arc(cx, cy, w / 2 - 1, 0, Math.PI * 2);
      ctx.fill();

      // Dark rim
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5;
      ctx.stroke();

      // Flame mark in centre
      ctx.fillStyle = t ? '#fff' : '#ff6b35';
      // Draw a simple flame shape
      ctx.beginPath();
      ctx.moveTo(cx, cy + 8);
      ctx.quadraticCurveTo(cx - 7, cy + 2, cx - 3, cy - 4);
      ctx.quadraticCurveTo(cx - 1, cy, cx, cy - 8);
      ctx.quadraticCurveTo(cx + 1, cy, cx + 3, cy - 4);
      ctx.quadraticCurveTo(cx + 7, cy + 2, cx, cy + 8);
      ctx.closePath();
      ctx.fill();

      // "TM" text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('TM', cx, cy + 13);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }
}
